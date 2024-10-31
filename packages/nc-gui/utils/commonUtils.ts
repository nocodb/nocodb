export const modalSizes = {
  xs: {
    width: 'min(calc(100vw - 32px), 448px)',
    height: 'min(90vh, 448px)',
  },
  sm: {
    width: 'min(calc(100vw - 32px), 640px)',
    height: 'min(90vh, 424px)',
  },
  md: {
    width: 'min(80vw, 900px)',
    height: 'min(90vh, 540px)',
  },
  lg: {
    width: 'min(80vw, 1280px)',
    height: 'min(90vh, 864px)',
  },
}

/**
 * Creates a promise that resolves after a specified delay.
 *
 * @param ms - The delay in milliseconds.
 * @returns A promise that resolves after the specified delay.
 *
 * @example
 * ```ts
 * // Wait for 2 seconds
 * await delay(2000);
 * console.log('2 seconds have passed');
 * ```
 */
export const ncDelay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
