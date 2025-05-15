export class Queue {
  private queue: Array<() => Promise<void>> = []
  private runningCount = 0
  private maxConcurrent: number

  constructor(maxConcurrent = 4) {
    this.maxConcurrent = maxConcurrent
  }

  async add<T>(task: () => Promise<T>): Promise<T> {
    // Create a promise that will resolve when the task is completed
    return new Promise<T>((resolve, reject) => {
      // Wrap the original task in a function that manages queue state
      const wrappedTask = async () => {
        this.runningCount++
        try {
          const result = await task()
          resolve(result)
          return result
        } catch (error) {
          reject(error)
          throw error
        } finally {
          this.runningCount--
          this.runNext()
        }
      }

      // Add the wrapped task to the queue
      this.queue.push(wrappedTask)

      // If we're under the concurrency limit, run the next task(s)
      if (this.runningCount < this.maxConcurrent) {
        this.runNext()
      }
    })
  }

  private runNext() {
    if (this.queue.length === 0) return
    if (this.runningCount >= this.maxConcurrent) return

    const nextTask = this.queue.shift()
    if (nextTask) {
      // Execute the task (which will handle its own promise resolution)
      nextTask().catch(() => {
        // Errors are already handled in the wrappedTask
      })
    }
  }
}
