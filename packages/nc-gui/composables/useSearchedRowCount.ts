import axios, { CanceledError } from 'axios'
import { NcErrorType, SEARCH_STATE_FIELD, type SearchState, type TableType, type ViewType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

/**
 * Every searched request holds one of the server's per-base search slots
 * (NC_SEARCH_MAX_CONCURRENT, 12) for its whole round trip. A grouped view fans
 * out one group request per expanded parent, so cap our own concurrency here
 * rather than let the server queue them and 429 the overflow.
 */
const SEARCH_CONCURRENCY = 4
let inFlight = 0
const waiters: Array<() => void> = []

/** An aborted `signal` drops the request from the queue, so a superseded term never holds a slot. */
export async function withSearchSlot<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw new CanceledError()
  if (inFlight < SEARCH_CONCURRENCY) {
    inFlight++
  } else {
    // The finishing request hands its slot over (see finally), so no increment here.
    await new Promise<void>((resolve, reject) => {
      function waiter() {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }
      function onAbort() {
        waiters.splice(waiters.indexOf(waiter), 1)
        reject(new CanceledError())
      }
      waiters.push(waiter)
      signal?.addEventListener('abort', onAbort, { once: true })
    })
  }
  try {
    return await fn()
  } finally {
    const next = waiters.shift()
    if (next) next()
    else inFlight--
  }
}

/** A search that timed out (408) or hit the search slots' limit (429); the general throttler's 429 has no code. */
export const searchLimitKind = (error: any): 'timeout' | 'limit' | undefined =>
  error?.response?.status === 408
    ? 'timeout'
    : error?.response?.status === 429 && error?.response?.data?.error === NcErrorType.ERR_TOO_MANY_REQUESTS
    ? 'limit'
    : undefined

/**
 * Searched requests for a grouped view, and the row-level counts the search box
 * shows ("N of M") while grouped. The group requests count groups, not rows, and
 * `useInfiniteData` only latches these at the ungrouped root path.
 */
export function useSearchedRowCount(
  view: Ref<ViewType | undefined>,
  meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
  where?: ComputedRef<string | undefined>,
  opts: {
    isPublic?: boolean
    hasInterfaceDataApi?: boolean
    /** The grid's hide-empty-groups predicate, so the badge doesn't count rows it hides. */
    appendHideEmptyWhere?: (where?: string) => string | undefined
  } = {},
) {
  const { $api } = useNuxtApp()
  const { base } = storeToRefs(useBase())

  const {
    nestedFilters,
    searchQueryParams,
    searchAbortSignal,
    totalRowsWithSearchQuery,
    totalRowsWithoutSearchQuery,
    fetchTotalRowsWithSearchQuery,
    whereQueryFromUrl,
    searchState,
    searchCountPending,
    searchError,
  } = useSmartsheetStoreOrThrow()

  watch(
    () => searchQueryParams.value.search,
    () => (searchError.value = undefined),
  )

  /**
   * All-fields search runs only on the internal operations; the v1 data API
   * ignores `search` by design. Called directly rather than through a batching
   * helper, which would hide the operation name the search guard keys on.
   */
  function searchOperation(
    operation: 'dataList' | 'dataGroupBy' | 'dataGroupByCount',
    query: Record<string, any>,
    signal = searchAbortSignal.value,
  ): Promise<any> {
    return withSearchSlot(
      () =>
        $api.internal.getOperation(
          (meta.value as any)!.fk_workspace_id!,
          meta.value!.base_id!,
          {
            operation,
            tableId: meta.value!.id!,
            viewId: view.value!.id!,
            baseId: meta.value!.base_id!,
            ...query,
          },
          { signal },
        ),
      signal,
    )
  }

  /** True for a superseded request or a search limit (shown in the search box): the caller shows nothing else. */
  function handleSearchError(error: any) {
    if (axios.isCancel(error)) return true
    const kind = searchQueryParams.value.search ? searchLimitKind(error) : undefined
    if (!kind) return false
    searchError.value = kind
    return true
  }

  async function syncSearchedRowCount() {
    if (opts.isPublic || opts.hasInterfaceDataApi || !view.value?.id || !meta.value?.id) return

    // Taken now: a term typed meanwhile has its own signal and its own sync.
    const term = searchQueryParams.value.search
    const signal = searchAbortSignal.value
    const superseded = () => !!signal?.aborted || searchQueryParams.value.search !== term

    if (!term) {
      searchState.value = undefined
      return
    }

    const filterArrJson = JSON.stringify(nestedFilters.value ?? [])
    const scoped = (w?: string) => (opts.appendHideEmptyWhere ? opts.appendHideEmptyWhere(w) : w)

    searchCountPending.value++
    try {
      const { pageInfo } = await searchOperation(
        'dataList',
        { where: scoped(where?.value), ...searchQueryParams.value, limit: 1, filterArrJson },
        signal,
      )
      if (superseded()) return

      totalRowsWithSearchQuery.value = pageInfo?.totalRows ?? 0
      searchState.value = (pageInfo as Record<string, unknown> | undefined)?.[SEARCH_STATE_FIELD] as SearchState | undefined

      if (!fetchTotalRowsWithSearchQuery.value) return

      // Denominator: the same view without the search term.
      const { count } = await $api.dbViewRow.count(
        'noco',
        base.value.id!,
        meta.value.id,
        view.value.id,
        { where: scoped(whereQueryFromUrl.value as string), filterArrJson } as any,
        { signal },
      )
      if (superseded()) return

      totalRowsWithoutSearchQuery.value = count as number
    } catch (e) {
      if (!handleSearchError(e)) throw e
    } finally {
      searchCountPending.value--
    }
  }

  return { syncSearchedRowCount, searchOperation, handleSearchError }
}
