/**
 * Creates a throttled function that ensures the last call is always executed
 *
 * @param fn - The function to throttle
 * @param delay - Minimum time between executions in milliseconds
 * @returns Throttled function
 *
 * @example
 * const updateUI = throttleWithLast(async (state) => {
 *   await saveToDatabase(state);
 * }, 1000);
 *
 * // Calls 1-9 may be dropped, but call 10 will execute
 * for (let i = 0; i < 10; i++) {
 *   updateUI(state);
 * }
 */
export function throttleWithLast<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => ReturnType<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  let isExecuting = false;
  let lastExecution = 0;

  const execute = async (
    ...args: Parameters<T>
  ): Promise<Awaited<ReturnType<T>>> => {
    isExecuting = true;
    lastExecution = Date.now();
    lastArgs = null;

    try {
      return await fn(...args);
    } finally {
      isExecuting = false;

      // Execute pending call if exists
      if (lastArgs) {
        const pendingArgs = lastArgs;
        lastArgs = null;

        const timeSinceLastExec = Date.now() - lastExecution;
        const remainingDelay = Math.max(0, delay - timeSinceLastExec);

        timeoutId = setTimeout(() => {
          execute(...pendingArgs);
        }, remainingDelay);
      }
    }
  };

  return ((...args: Parameters<T>): ReturnType<T> => {
    // Store the latest args
    lastArgs = args;

    // Clear pending timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    // If currently executing, the args will be picked up after current execution
    if (isExecuting) {
      return Promise.resolve(
        undefined as Awaited<ReturnType<T>>,
      ) as ReturnType<T>;
    }

    const timeSinceLastExec = Date.now() - lastExecution;

    // Execute immediately if enough time has passed
    if (timeSinceLastExec >= delay) {
      return execute(...args) as ReturnType<T>;
    }

    // Schedule execution for remaining delay
    const remainingDelay = delay - timeSinceLastExec;

    return new Promise((resolve) => {
      timeoutId = setTimeout(async () => {
        const result = await execute(...args);
        resolve(result);
      }, remainingDelay);
    }) as ReturnType<T>;
  }) as (...args: Parameters<T>) => ReturnType<T>;
}
