import { useStorage, useTimeoutFn } from '@vueuse/core'

export class SharedExecutionError extends Error {
  constructor(message?: string) {
    super(message)
  }
}

interface SharedExecutionOptions {
  timeout?: number // Maximum time a lock can be held before it's considered stale - default 5000ms
  storageDelay?: number // Delay before reading from storage to allow for changes to propagate - default 50ms
  debug?: boolean // Enable or disable debug logging
}

const tabId = `tab-${Math.random().toString(36).slice(2, 9)}`

/**
 * Creates a composable that ensures a function is executed only once across all tabs
 * @param key Unique key to identify the function
 * @param fn Function to be executed
 * @param options Optional configuration (timeout, storageDelay)
 * @returns A wrapped function that ensures single execution across tabs
 */
export function useSharedExecutionFn<T>(key: string, fn: () => Promise<T> | T, options: SharedExecutionOptions = {}) {
  const { timeout = 5000, storageDelay = 50, debug = false } = options

  const storageResultKey = `nc-shared-execution-${key}-result`
  const storageLockKey = `nc-shared-execution-${key}-lock`
  const storageResultState = useStorage<{
    status?: 'success' | 'error'
    result?: T
    error?: any
  }>(storageResultKey, {})

  const debugLog = (...args: any[]) => {
    if (debug) console.log(`[${tabId}]`, ...args)
  }

  debugLog(`Tab initialized with ID: ${tabId}`)

  const getLock = (): { timestamp: number; tabId: string } | null => {
    try {
      return JSON.parse(localStorage.getItem(storageLockKey) || 'null')
    } catch (error) {
      debugLog(`Error reading lock:`, error)
      return null
    }
  }

  const acquireLock = async (): Promise<boolean> => {
    let currentLock = getLock()
    const now = Date.now()

    if (!currentLock) {
      localStorage.setItem(storageLockKey, JSON.stringify({ timestamp: now, tabId }))

      // Allow storage updates to propagate - which will determine strictness of lock
      await new Promise((resolve) => setTimeout(resolve, storageDelay))

      currentLock = getLock()
      if (currentLock?.tabId === tabId) {
        debugLog(`Lock acquired successfully`)
        return true
      }

      debugLog(`Lock acquired by ${currentLock?.tabId}`)
      return false
    }

    const lockIsStale = now - currentLock.timestamp > timeout
    if (lockIsStale) {
      localStorage.setItem(storageLockKey, JSON.stringify({ timestamp: now, tabId }))

      // Allow storage updates to propagate - which will determine strictness of lock
      await new Promise((resolve) => setTimeout(resolve, storageDelay))

      currentLock = getLock()
      if (currentLock?.tabId === tabId) {
        debugLog(`Stale lock acquired successfully`)
        return true
      }

      debugLog(`Stale lock acquired by ${currentLock?.tabId}`)
      return false
    }

    debugLog(`Lock is held by ${currentLock?.tabId}`)
    return false
  }

  const releaseLock = (): void => {
    const currentLock = getLock()
    if (currentLock?.tabId === tabId) {
      debugLog(`Releasing lock.`)
      localStorage.removeItem(storageLockKey)
    }
  }

  const sharedExecutionFn = async (): Promise<T> => {
    debugLog(`sharedExecutionFn called`)

    if (!(await acquireLock())) {
      const currentLock = getLock()
      return new Promise((resolve, reject) => {
        let timedOut = false

        const { start: startTimeout, stop: stopTimeout } = useTimeoutFn(
          () => {
            timedOut = true
            localStorage.removeItem(storageLockKey)
            reject(new SharedExecutionError(`Timeout waiting for result on key ${key}`))
          },
          currentLock?.timestamp ? timeout - (Date.now() - currentLock.timestamp) : timeout,
        )

        startTimeout()

        if (storageResultState.value.status) {
          storageResultState.value = { ...storageResultState.value, status: undefined }
        }

        until(() => storageResultState.value)
          .toMatch((v) => v.status === 'success' || v.status === 'error')
          .then((res) => {
            if (timedOut) return

            stopTimeout()
            const { result, error } = res
            result ? resolve(result) : reject(error)
          })
      })
    }

    try {
      storageResultState.value = { ...storageResultState.value, status: undefined }
      const result = await fn()
      storageResultState.value = { status: 'success', result }
      return result
    } catch (error) {
      storageResultState.value = { status: 'error', error }
      throw error
    } finally {
      releaseLock()
      debugLog(`Function execution completed (success or failure).`)
    }
  }

  useEventListener('beforeunload', releaseLock)

  return sharedExecutionFn
}
