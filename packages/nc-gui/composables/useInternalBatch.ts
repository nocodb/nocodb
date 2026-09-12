/**
 * useInternalBatch — explicit helpers that coalesce internal-API calls
 * into a single backend `batch` envelope.
 *
 *   const { internalGet, internalPost } = useInternalBatch()
 *   const cols = await internalGet(ws, base, { operation: 'viewColumnList', viewId })
 *   const res  = await internalPost(ws, base, { operation: 'columnAdd', tableId }, payload)
 *
 * Callers explicitly route through these helpers when they want
 * batching — no SDK monkey-patching, no implicit interception of every
 * `$api.internal.*` call. Behaviour:
 *
 *   • If `operation` is in `BATCHABLE_INTERNAL_OPERATIONS` (defined in
 *     nocodb-sdk so both ends stay in sync), the call is queued into a
 *     per-(workspaceId, baseId) batcher with a ~50ms leading-edge
 *     debounce. Up to `INTERNAL_BATCH_MAX_SIZE` ops per envelope.
 *   • Otherwise the call falls through to the original SDK method.
 *   • Pass `_batch: true` on `params` to force-batch a non-allowlisted
 *     op; `_batch: false` to force-immediate for an allowlisted one.
 *     The marker is stripped before the request leaves.
 *   • Pass a trailing axios `RequestParams` (custom headers,
 *     AbortSignal, response type, etc.) to bypass batching — the
 *     envelope can't carry those faithfully.
 */

import { BATCHABLE_INTERNAL_OPERATIONS, INTERNAL_BATCH_MAX_SIZE } from 'nocodb-sdk'

// Leading-edge debounce: the timer starts on the first queued call and
// flushes after this window, regardless of how many more calls arrive.
// Long enough to catch fan-outs that span multiple Vue effect ticks,
// async `await until(...)` hops in composables, and the gap between
// sibling components mounting on the same page — short enough that
// single-request flows (clicks, navigation) don't feel laggy.
const FLUSH_WINDOW_MS = 50

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

      if (this.queue.length >= INTERNAL_BATCH_MAX_SIZE) {
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
        // Mimic the shape the SDK produces for individual failed calls
        // so existing `extractSdkResponseErrorMsg(e)` call sites still
        // work.
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

// One batcher per (workspaceId, baseId, $api instance). Cross-target
// requests can't be merged because the URL itself encodes ws and base.
const batchers = new WeakMap<object, Map<string, Batcher>>()

function getBatcher(api: any, workspaceId: string, baseId: string): Batcher {
  let perApi = batchers.get(api)
  if (!perApi) {
    perApi = new Map()
    batchers.set(api, perApi)
  }
  const key = `${workspaceId}::${baseId}`
  let b = perApi.get(key)
  if (!b) {
    b = new Batcher(async (ops) => {
      const res: any = await api.internal.postOperation(workspaceId, baseId, { operation: 'batch' as any }, {
        operations: ops,
      } as any)
      return (res?.results as BatchResult[]) ?? []
    })
    perApi.set(key, b)
  }
  return b
}

// Memoised per (operation) so a fan-out from a misconfigured caller doesn't
// spam the console with the same line N times per page mount.
const warnedDowngradeOps = new Set<string>()

function shouldBatch(
  workspaceId: string | undefined | null,
  baseId: string | undefined | null,
  params: { operation?: string; _batch?: boolean } | null | undefined,
  requestParams: any,
): boolean {
  if (!workspaceId || !baseId) return false
  if (requestParams) {
    // Allowlisted op + caller-supplied requestParams (custom headers,
    // AbortSignal, response type, etc.) → silent fall through to the
    // single-shot SDK call, losing batching. Surface this in dev so
    // someone adding an AbortSignal to an otherwise-batched call notices
    // they've opted out. Production builds stay quiet — this is a hint to
    // the implementer, not an error.
    if (
      process.env.NODE_ENV !== 'production' &&
      params?.operation &&
      params._batch !== false &&
      BATCHABLE_INTERNAL_OPERATIONS.has(params.operation) &&
      !warnedDowngradeOps.has(params.operation)
    ) {
      warnedDowngradeOps.add(params.operation)

      console.warn(
        `[useInternalBatch] '${params.operation}' is on the batch allowlist ` +
          `but was called with requestParams; the call won't be batched. ` +
          `Move custom headers / AbortSignal / responseType onto the op's ` +
          `query/payload, or pass _batch: false to silence this warning.`,
      )
    }
    return false
  }
  if (!params?.operation) return false
  if (params.operation === 'batch') return false
  if (params._batch === false) return false
  if (params._batch === true) return true
  return BATCHABLE_INTERNAL_OPERATIONS.has(params.operation)
}

function stripBatchMarker<T extends Record<string, any>>(p: T): T {
  if (p && '_batch' in p) {
    const { _batch: _, ...rest } = p
    return rest as T
  }
  return p
}

export function useInternalBatch() {
  const { $api } = useNuxtApp()

  function internalGet<T = any>(
    workspaceId: string,
    baseId: string,
    params: { operation: string; _batch?: boolean; [k: string]: any },
    requestParams?: any,
  ): Promise<T> {
    const queued = shouldBatch(workspaceId, baseId, params, requestParams)
    const clean = stripBatchMarker(params)
    if (!queued) {
      return $api.internal.getOperation(workspaceId, baseId, clean as any, requestParams) as Promise<T>
    }
    const { operation, ...query } = clean
    return getBatcher($api, workspaceId, baseId).call({ operation, query })
  }

  function internalPost<T = any>(
    workspaceId: string,
    baseId: string,
    params: { operation: string; _batch?: boolean; [k: string]: any },
    data?: any,
    requestParams?: any,
  ): Promise<T> {
    const queued = shouldBatch(workspaceId, baseId, params, requestParams)
    const clean = stripBatchMarker(params)
    if (!queued) {
      return $api.internal.postOperation(workspaceId, baseId, clean as any, data, requestParams) as Promise<T>
    }
    const { operation, ...query } = clean
    return getBatcher($api, workspaceId, baseId).call({
      operation,
      query,
      payload: data,
    })
  }

  return { internalGet, internalPost }
}
