/**
 * installInternalApiBatch — coalesce a curated set of `$api.internal.*`
 * calls into a single backend `batch` envelope.
 *
 * Page-load traces show the same (workspaceId, baseId) target receiving
 * 5-16 sequential internal-API requests for view-metadata reads and
 * dashboard widgets. Each one re-runs auth + context resolution
 * server-side; in aggregate that dominated LCP. Bundling them into one
 * HTTP request collapses that overhead.
 *
 * Scope: only the operations listed in `BATCHABLE_OPERATIONS` below are
 * routed through the batcher. Everything else goes straight to the
 * original SDK method. The list is intentionally narrow — read-only,
 * view-mount / dashboard-mount side-effect calls that fire as a fan-out
 * on the same page render. Writes, mutations, navigation-critical
 * reads, and large-response operations are deliberately excluded so
 * batching never adds latency to those paths.
 *
 * Two automatic bypass conditions apply even for allowlisted ops:
 *   1. **Custom axios config** — if a caller passes a trailing
 *      RequestParams (custom headers, AbortSignal, response type, etc.)
 *      we can't reflect those inside the envelope, so the call falls
 *      through to the original SDK method.
 *   2. **The `batch` envelope itself** — the batcher uses
 *      `originalPost(..., {operation:'batch'}, ...)` to ship the bundle.
 *      Detected and bypassed to avoid an infinite loop.
 *
 * Adding more ops later: append to `BATCHABLE_OPERATIONS`. Each entry
 * should be a read operation that (a) frequently fires alongside its
 * siblings within ~50ms, (b) returns a small payload, and (c) doesn't
 * gate first-paint UX.
 */


// Leading-edge debounce: the timer starts on the first queued call and
// flushes after this window, regardless of how many more calls arrive.
// Long enough to catch fan-outs that span multiple Vue effect ticks,
// async `await until(...)` hops in composables, and the gap between
// sibling components mounting on the same page — short enough that
// single-request flows (clicks, navigation) don't feel laggy.
const FLUSH_WINDOW_MS = 50

const MAX_BATCH_SIZE = 25 // mirrors BATCH_MAX_SIZE on the backend

/**
 * Operations the wrapper coalesces into a `batch` envelope. Every other
 * `$api.internal.*` call passes through to the original SDK method.
 *
 * Keep this list narrow: read-only, view-mount / dashboard-mount
 * side-effect fetches that fire as a fan-out within one render. Don't
 * add writes, mutations, or anything UX-critical here — the ~50ms
 * debounce window would add visible latency to those.
 */
const BATCHABLE_OPERATIONS = new Set<string>([
  // View metadata fan-out (5+ calls on every view mount)
  'viewColumnList',
  'filterList',
  'filterChildrenList',
  'sortList',
  'viewRowColorInfo',
  'viewList',
  'viewSectionList', // fires alongside the view metadata cluster

  // Sibling filter lists fired alongside the above. Each renders a
  // different scope of filters (column-button, link, widget, hook, RLS
  // policy) but all are read-only fan-out reads.
  'buttonFilterList',
  'linkFilterList',
  'widgetFilterList',
  'hookFilterList',
  'rlsPolicyFilterList',

  // View-type detail reads (gallery/kanban/etc fire one of these on mount)
  'formViewGet',
  'galleryViewGet',
  'kanbanViewGet',
  'mapViewGet',
  'calendarViewGet',
  'timelineViewGet',

  // Dashboard widgets fan-out (16+ calls on dashboard mount)
  'widgetDataGet',
  'widgetList',
  'widgetGet',
  'dashboardGet', // sibling read on dashboard mount

  // Per-row reads that fan out across a visible viewport
  //   - commentCount: useInfiniteData fires one per row that needs a
  //     comment-count badge; commonly 25-50 in flight on view scroll
  //   - recordAuditList: row-detail panel; small fan-out but cheap
  'commentCount',
  'recordAuditList',

  // Schema-hash polling — useGridViewData, useMultiSelect, Fields.vue,
  // useCopyPaste, usePredictFields all poll this independently to detect
  // schema drift. Payload is a single hash string; perfect to coalesce.
  'columnsHash',

  // Aggregate fan-out: dataAggregate fires once per field with an
  // aggregation configured on grid views. Excluded `bulkAggregate`
  // intentionally — its response can be large enough to balloon a batch.
  'dataAggregate',

  // Base-load reads that frequently coincide
  'baseVariableList',
])

interface SubOp {
  operation: string
  query?: Record<string, any>
  payload?: any
}

interface BatchResult {
  status: number
  data?: any
  error?: { message: string; error?: string }
}

interface PendingCall {
  op: SubOp
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

class Batcher {
  private queue: PendingCall[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly send: (ops: SubOp[]) => Promise<BatchResult[]>) {}

  call(op: SubOp): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ op, resolve, reject })

      if (this.queue.length >= MAX_BATCH_SIZE) {
        // Flush synchronously on cap — don't wait for the debounce window.
        this.flush().catch(() => {
          /* per-call rejections already dispatched */
        })
        return
      }

      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.flush().catch(() => {
            /* per-call rejections already dispatched */
          })
        }, FLUSH_WINDOW_MS)
      }
    })
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const batch = this.queue.splice(0)
    if (batch.length === 0) return

    let results: BatchResult[]
    try {
      results = await this.send(batch.map((b) => b.op))
    } catch (e) {
      // Transport-level failure: reject every caller — the whole batch
      // never reached the server, so we can't tell which sub-ops would
      // have succeeded.
      for (const b of batch) b.reject(e)
      return
    }

    // Server contract: `results[i]` corresponds to `operations[i]` from
    // the request. Length mismatch would mean the contract is broken —
    // reject every caller rather than silently misalign success/failure.
    if (!Array.isArray(results) || results.length !== batch.length) {
      const mismatch = new Error(
        `Batch response length ${Array.isArray(results) ? results.length : 'n/a'} ` +
          `does not match request length ${batch.length}`,
      )
      for (const b of batch) b.reject(mismatch)
      return
    }

    for (let i = 0; i < batch.length; i++) {
      const b = batch[i]
      const r = results[i]
      if (r && r.status >= 200 && r.status < 300) {
        b.resolve(r.data)
      } else {
        // Mimic the shape the SDK produces for individual failed calls so
        // existing `extractSdkResponseErrorMsg(e)` call sites still work.
        const err: any = new Error(r?.error?.message ?? 'Internal error')
        err.response = {
          status: r?.status ?? 500,
          data: { message: r?.error?.message, error: r?.error?.error },
        }
        if (r?.error?.error) err.error = r.error.error
        b.reject(err)
      }
    }
  }
}

/**
 * Install the batcher onto an SDK `Api` instance. Called once from the
 * api plugin. Safe to call repeatedly — guarded by a marker so we don't
 * double-wrap.
 */
export function installInternalApiBatch(api: any): void {
  if (!api?.internal?.getOperation || !api?.internal?.postOperation) return
  if (api.internal.__nc_batched__) return
  api.internal.__nc_batched__ = true

  const originalGet = api.internal.getOperation.bind(api.internal)
  const originalPost = api.internal.postOperation.bind(api.internal)

  // One batcher per (workspaceId, baseId). Cross-target requests can't be
  // merged because the URL itself encodes both — keyed map keeps them apart.
  const batchers = new Map<string, Batcher>()

  function getBatcher(workspaceId: string, baseId: string): Batcher {
    const key = `${workspaceId}::${baseId}`
    let b = batchers.get(key)
    if (!b) {
      b = new Batcher(async (ops) => {
        // Important: use the ORIGINAL post, not the wrapped one. Sending
        // the batch envelope through the wrapper would re-queue it into
        // a new batch and loop indefinitely.
        const res: any = await originalPost(
          workspaceId,
          baseId,
          { operation: 'batch' as any },
          { operations: ops } as any,
        )
        return (res?.results as BatchResult[]) ?? []
      })
      batchers.set(key, b)
    }
    return b
  }

  /**
   * Decide whether a single call should be queued into a batch. Three
   * inputs feed in:
   *   • the operation name (matched against the allowlist),
   *   • the explicit `_batch` marker on `params` — `true` forces batching
   *     of a non-allowlisted op, `false` forces an immediate call for
   *     an allowlisted op,
   *   • the trailing axios-config arg — if present, always immediate
   *     because the envelope can't carry it faithfully.
   */
  function shouldBatch(
    workspaceId: string,
    baseId: string,
    params: { operation?: string; _batch?: boolean } | null | undefined,
    requestParams: any,
  ): boolean {
    if (!workspaceId || !baseId) return false
    if (requestParams) return false
    if (!params?.operation) return false
    if (params.operation === 'batch') return false
    if (params._batch === false) return false // explicit opt-out
    if (params._batch === true) return true // explicit opt-in
    return BATCHABLE_OPERATIONS.has(params.operation)
  }

  // The `_batch` marker is a client-side hint — strip it before the
  // request leaves so the backend doesn't see `_batch=true` in its
  // query/body.
  function stripBatchMarker<T extends Record<string, any>>(p: T): T {
    if (p && '_batch' in p) {
      const { _batch: _, ...rest } = p
      return rest as T
    }
    return p
  }

  api.internal.getOperation = function batchedGet(
    workspaceId: string,
    baseId: string,
    params: { operation: string; [k: string]: any },
    requestParams?: any,
  ) {
    const queued = shouldBatch(workspaceId, baseId, params, requestParams)
    const clean = stripBatchMarker(params)
    if (!queued) {
      return originalGet(workspaceId, baseId, clean, requestParams)
    }
    const { operation, ...query } = clean
    return getBatcher(workspaceId, baseId).call({ operation, query })
  }

  api.internal.postOperation = function batchedPost(
    workspaceId: string,
    baseId: string,
    params: { operation: string; [k: string]: any },
    data?: any,
    requestParams?: any,
  ) {
    const queued = shouldBatch(workspaceId, baseId, params, requestParams)
    const clean = stripBatchMarker(params)
    if (!queued) {
      return originalPost(workspaceId, baseId, clean, data, requestParams)
    }
    const { operation, ...query } = clean
    return getBatcher(workspaceId, baseId).call({
      operation,
      query,
      payload: data,
    })
  }
}
