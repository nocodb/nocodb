import type { DebounceFilterOptions, MaybeRefOrGetter } from '@vueuse/core'

type FunctionArgs = (...args: any[]) => any

// Default function to generate a cache key
function defaultGetCacheKey(): string {
  return 'default'
}

/**
 * Creates a cached debounced version of the given function.
 *
 * @param fn - The function to debounce.
 * @param ms - The debounce delay in milliseconds. Default is 500ms.
 * @param getCacheKey - Function to generate a unique cache key based on the arguments.
 * @param options - Additional options for debouncing.
 *
 * @returns A debounced version of the input function with caching.
 */
export function useCachedDebouncedFunction<T extends FunctionArgs>(
  fn: T,
  ms: MaybeRefOrGetter<number> = 500,
  getCacheKey: (...args: Parameters<T>) => string | number = defaultGetCacheKey,
  options: DebounceFilterOptions = {},
): (...args: Parameters<T>) => ReturnType<T> {
  // Cache to store debounced functions based on a unique key
  const debounceCache = new Map<string | number, any>()

  return (...args: Parameters<T>): ReturnType<T> => {
    // Generate a unique key for the given arguments
    const key = getCacheKey(...args)

    // If the debounced function for the given key is not in the cache, create and cache it
    if (!debounceCache.has(key)) {
      const debouncedFn = useDebounceFn(fn, ms, options)
      debounceCache.set(key, debouncedFn)
    }

    // Retrieve the cached debounced function
    const debouncedFn = debounceCache.get(key)

    // Call and return the result of the debounced function
    return debouncedFn!(...args)
  }
}
