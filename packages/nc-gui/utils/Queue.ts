export interface RateLimitOptions {
  enabled: boolean
  maxRequestsPerWindow: number
  windowSizeMs: number
}

export interface QueueOptions {
  maxConcurrent: number
  rateLimit?: Partial<RateLimitOptions>
  autoStart?: boolean
  priorityLevels?: number
  retryOptions?: RetryOptions
  timeout?: number
}
export interface RetryOptions {
  maxRetries: number
  retryDelay: number | ((attempt: number) => number)
  retryCondition?: (error: any) => boolean
}

export interface QueueTask<T> {
  id: string
  task: () => Promise<T>
  priority: number
  addedAt: number
  attempts: number
  timeout?: number
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export enum QueueEvents {
  TASK_ADDED = 'taskAdded',
  TASK_STARTED = 'taskStarted',
  TASK_COMPLETED = 'taskCompleted',
  TASK_FAILED = 'taskFailed',
  TASK_RETRIED = 'taskRetried',
  QUEUE_IDLE = 'queueIdle',
  QUEUE_PAUSED = 'queuePaused',
  QUEUE_RESUMED = 'queueResumed',
}

export type QueueEventCallback = (data: any) => void

export class Queue {
  private queue: QueueTask<any>[] = []
  private runningCount = 0
  private requestTimestamps: number[] = []
  private rateLimitOptions: RateLimitOptions
  private taskCounter = 0
  private paused = false
  private eventListeners: Map<QueueEvents, QueueEventCallback[]> = new Map()
  private options: QueueOptions

  constructor(options: Partial<QueueOptions> = {}) {
    this.options = {
      maxConcurrent: 4,
      autoStart: true,
      priorityLevels: 1,
      ...options,
    }

    this.rateLimitOptions = {
      enabled: false,
      maxRequestsPerWindow: 10,
      windowSizeMs: 1000,
      ...(this.options.rateLimit || {}),
    }
  }

  /**
   * Add a task to the queue
   * @param task The task function to execute
   * @param options Optional configuration for this specific task
   * @returns Promise that resolves with the task result
   */
  async add<T>(
    task: () => Promise<T>,
    options: {
      priority?: number
      id?: string
      timeout?: number
    } = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = options.id || `task-${++this.taskCounter}`
      const priority =
        options.priority !== undefined ? Math.min(Math.max(0, options.priority), (this.options.priorityLevels || 1) - 1) : 0

      const queueTask: QueueTask<T> = {
        id,
        task,
        priority,
        addedAt: Date.now(),
        attempts: 0,
        timeout: options.timeout,
        resolve,
        reject,
      }

      // Add task to queue with priority sorting
      this.queue.push(queueTask)
      this.sortQueue()

      this.emit(QueueEvents.TASK_ADDED, { id, priority })

      // If autoStart is enabled and we're not paused, try to run tasks
      if (this.options.autoStart && !this.paused) {
        this.tryRunNext()
      }
    })
  }

  /**
   * Add multiple tasks to the queue at once
   * @param tasks Array of tasks to add
   * @param options
   * @returns Promise that resolves when all tasks are completed
   */
  async addBatch<T>(
    tasks: Array<() => Promise<T>>,
    options: {
      priority?: number
      concurrency?: number
    } = {},
  ): Promise<T[]> {
    const promises = tasks.map((task) =>
      this.add(task, {
        priority: options.priority,
      }),
    )

    return Promise.all(promises)
  }

  /**
   * Execute a task from the queue
   * @param queueTask The task to execute
   */
  private async executeTask<T>(queueTask: QueueTask<T>): Promise<void> {
    const { id, task, resolve, reject } = queueTask
    queueTask.attempts++

    this.runningCount++
    this.emit(QueueEvents.TASK_STARTED, { id, attempts: queueTask.attempts })

    try {
      // Check if we need to wait for rate limit
      await this.waitForRateLimit()

      // Record this request timestamp for rate limiting
      if (this.rateLimitOptions.enabled) {
        this.requestTimestamps.push(Date.now())
      }

      // Execute the task with optional timeout
      let result: T
      if (this.options.timeout || queueTask.timeout) {
        const timeoutMs = queueTask.timeout || this.options.timeout
        result = await this.withTimeout(task(), timeoutMs!)
      } else {
        result = await task()
      }

      // Task completed successfully
      resolve(result)
      this.emit(QueueEvents.TASK_COMPLETED, { id })
    } catch (error) {
      // Check if we should retry the task
      if (this.shouldRetry(queueTask, error)) {
        this.handleRetry(queueTask, error)
      } else {
        // No more retries, reject the promise
        reject(error)
        this.emit(QueueEvents.TASK_FAILED, { id, error, attempts: queueTask.attempts })
      }
    } finally {
      this.runningCount--

      // If the queue is empty and no tasks are running, emit idle event
      if (this.queue.length === 0 && this.runningCount === 0) {
        this.emit(QueueEvents.QUEUE_IDLE, {})
      }

      // Try to run next task if not paused
      if (!this.paused) {
        this.tryRunNext()
      }
    }
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => setTimeout(() => reject(new Error(`Task timed out after ${timeoutMs}ms`)), timeoutMs)),
    ])
  }

  /**
   * Determine if a task should be retried
   */
  private shouldRetry(queueTask: QueueTask<any>, error: any): boolean {
    const retryOptions = this.options.retryOptions
    if (!retryOptions) return false

    const underMaxRetries = queueTask.attempts <= retryOptions.maxRetries

    // If there's a retry condition function, use it
    if (retryOptions.retryCondition) {
      return underMaxRetries && retryOptions.retryCondition(error)
    }

    return underMaxRetries
  }

  /**
   * Handle retrying a failed task
   */
  private handleRetry(queueTask: QueueTask<any>, error: any) {
    const retryOptions = this.options.retryOptions!

    // Calculate delay based on retry count
    let delay: number
    if (typeof retryOptions.retryDelay === 'function') {
      delay = retryOptions.retryDelay(queueTask.attempts)
    } else {
      delay = retryOptions.retryDelay
    }

    this.emit(QueueEvents.TASK_RETRIED, {
      id: queueTask.id,
      attempts: queueTask.attempts,
      delay,
      error,
    })

    // Add task back to queue after delay
    setTimeout(() => {
      this.queue.push(queueTask)
      this.sortQueue()
      this.tryRunNext()
    }, delay)
  }

  /**
   * Wait for rate limit if necessary
   */
  private async waitForRateLimit(): Promise<void> {
    // Skip rate limiting if disabled
    if (!this.rateLimitOptions.enabled) {
      return
    }

    // Clean up old timestamps outside the window
    const now = Date.now()
    const windowStart = now - this.rateLimitOptions.windowSizeMs
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => timestamp > windowStart)

    // If we're at the rate limit, wait until we can proceed
    if (this.requestTimestamps.length >= this.rateLimitOptions.maxRequestsPerWindow) {
      const oldestTimestamp = this.requestTimestamps[0]

      // Check if oldestTimestamp is defined
      if (oldestTimestamp !== undefined) {
        const timeToWait = oldestTimestamp + this.rateLimitOptions.windowSizeMs - now

        if (timeToWait > 0) {
          await new Promise((resolve) => setTimeout(resolve, timeToWait))
          // Recursively check again after waiting
          return this.waitForRateLimit()
        }
      }
    }
  }

  /**
   * Sort the queue by priority (higher values first)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // First sort by priority (descending)
      if (b.priority !== a.priority) {
        return b.priority - a.priority
      }
      // Then by age (older tasks first)
      return a.addedAt - b.addedAt
    })
  }

  /**
   * Try to run the next task from the queue
   */
  private tryRunNext(): void {
    // Schedule this to run on the next tick to avoid stack overflow
    // when many tasks are added at once
    setTimeout(() => this.runNext(), 0)
  }

  /**
   * Run the next task from the queue if possible
   */
  private runNext(): void {
    if (this.paused || this.queue.length === 0) return
    if (this.runningCount >= this.options.maxConcurrent) return

    const nextTask = this.queue.shift()
    if (nextTask) {
      this.executeTask(nextTask).catch(() => {
        // Errors are already handled in executeTask
      })
    }
  }

  /**
   * Pause the queue - stops processing new tasks but allows running tasks to complete
   */
  public pause(): void {
    if (this.paused) return
    this.paused = true
    this.emit(QueueEvents.QUEUE_PAUSED, {})
  }

  /**
   * Resume processing tasks from the queue
   */
  public resume(): void {
    if (!this.paused) return
    this.paused = false
    this.emit(QueueEvents.QUEUE_RESUMED, {})

    // Try to run tasks if any are queued
    for (let i = 0; i < this.options.maxConcurrent; i++) {
      this.tryRunNext()
    }
  }

  /**
   * Clear all pending tasks from the queue
   * @returns The number of tasks cleared
   */
  public clear(): number {
    const count = this.queue.length
    this.queue = []
    return count
  }

  /**
   * Remove a specific task from the queue by ID
   * @param id The ID of the task to remove
   * @returns True if the task was found and removed
   */
  public remove(id: string): boolean {
    const initialLength = this.queue.length
    this.queue = this.queue.filter((task) => task.id !== id)
    return this.queue.length < initialLength
  }

  /**
   * Register an event listener
   * @param event The event to listen for
   * @param callback Function to call when event occurs
   */
  public on(event: QueueEvents, callback: QueueEventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  /**
   * Remove an event listener
   * @param event The event to remove listener from
   * @param callback The callback to remove
   */
  public off(event: QueueEvents, callback: QueueEventCallback): void {
    if (!this.eventListeners.has(event)) return

    const listeners = this.eventListeners.get(event)!
    const index = listeners.indexOf(callback)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }

  /**
   * Emit an event
   * @param event The event to emit
   * @param data Data to pass to callbacks
   */
  private emit(event: QueueEvents, data: any): void {
    if (!this.eventListeners.has(event)) return

    for (const callback of this.eventListeners.get(event)!) {
      try {
        callback(data)
      } catch (error) {
        console.error(`Error in ${event} event handler:`, error)
      }
    }
  }
}
