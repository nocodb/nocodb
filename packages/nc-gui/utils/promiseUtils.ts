/**
 * Polls a getter function until it returns a truthy value or meets a condition
 * @param getter - Function that returns the value to check
 * @param condition - Optional condition function. If not provided, checks for truthy value
 * @param options - Configuration options
 * @returns Promise that resolves with the final value
 */
export async function waitForValueExists<T>(
  getter: () => T,
  condition?: (value: T) => boolean,
  options: {
    interval?: number
    timeout?: number
  } = {},
): Promise<T> {
  const { interval = 100, timeout } = options

  return new Promise((resolve, reject) => {
    const startTime = Date.now()

    const checkValue = () => {
      const value = getter()
      const isComplete = condition ? condition(value) : !!value

      if (isComplete) {
        resolve(value)
        return
      }

      // Check timeout
      if (timeout && Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for value after ${timeout}ms`))
        return
      }

      setTimeout(checkValue, interval)
    }

    checkValue()
  })
}
