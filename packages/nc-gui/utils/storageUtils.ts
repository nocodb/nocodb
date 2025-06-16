/**
 * Returns an object with methods to manage the last visited base.
 *
 * @returns An object containing:
 *   - `key`: The key used for storage.
 *   - `get`: A function to retrieve the last visited base.
 *   - `set`: A function to set the last visited base.
 *
 * @example
 * ```typescript
 * const lastVisitedBase = ncLastVisitedBase();
 * lastVisitedBase.set('my-base');
 * const lastVisited = lastVisitedBase.get();
 * console.log(lastVisited); // Output: 'my-base'
 * ```
 */
export const ncLastVisitedBase = (): {
  key: string
  get: () => string | null
  set: (value: string | null | undefined) => void
} => {
  const key = 'ncLastVisitedBase'

  return {
    key,
    get: () => {
      return sessionStorage.getItem(key)
    },
    set: (value: string | null | undefined) => {
      if (!value) return

      sessionStorage.setItem(key, value)
    },
  }
}
