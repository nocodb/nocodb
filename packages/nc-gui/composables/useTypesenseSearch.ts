import type { Client } from 'typesense'
import type { MaybeRefOrGetter } from 'vue'
export const useTypesenseSearch = (
  client: Client,
  typesenseCollection: string,
  delayMs = 100,
  allowEmpty: MaybeRefOrGetter<boolean> = false,
  key?: string,
) => {
  const search = ref('')
  const results = ref<'empty' | SortedResult[]>('empty')
  const error = ref<any>()
  const isLoading = ref(false)

  const cache = new Map<string, 'empty' | SortedResult[]>()

  let currentRequestId = 0

  const cacheKey = computed(() => {
    return key ?? JSON.stringify([search.value])
  })

  const debouncedSearch = useDebounceFn(async () => {
    const newCacheKey = cacheKey.value

    // Not cached: allowEmpty can turn on later for the same (empty) key.
    if (search.value.length === 0 && !toValue(allowEmpty)) {
      ++currentRequestId
      isLoading.value = false
      error.value = undefined
      results.value = 'empty'
      return
    }

    const cached = cache.get(newCacheKey)
    if (cached !== undefined) {
      isLoading.value = false
      error.value = undefined
      results.value = cached
      return
    }

    isLoading.value = true
    const requestId = ++currentRequestId

    try {
      const result = await searchDocs(client, typesenseCollection, search.value)

      if (requestId === currentRequestId) {
        cache.set(newCacheKey, result)
        error.value = undefined
        results.value = result
      }
    } catch (err) {
      if (requestId === currentRequestId) {
        error.value = err
      }
    } finally {
      if (requestId === currentRequestId) {
        isLoading.value = false
      }
    }
  }, delayMs)

  watch(
    [search, () => toValue(allowEmpty)],
    () => {
      debouncedSearch()
    },
    { immediate: true },
  )

  return {
    search,
    query: {
      isLoading,
      data: results,
      error,
    },
  }
}
