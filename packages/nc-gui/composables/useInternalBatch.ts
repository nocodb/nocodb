/**
 * useInternalBatch — coalesce calls to `$api.internal.{get,post}Operation`
 * into a single backend batch envelope.
 *
 * Why: page-load traces show the same (workspaceId, baseId) target receiving
 * 5-16 sequential internal-API requests in a tight window (dashboard widgets,
 * view metadata, view tabs). Each one re-runs auth/context resolution on the
 * server, multiplying latency. Bundling them into one HTTP request collapses
 * that overhead and lets the server fan out via `Promise.allSettled`.
 *
 * Contract — drop-in compatible with `$api.internal`:
 *
 *   const batch = useInternalBatch()
 *   const cols = await batch.get(wsId, baseId, { operation: 'viewColumnList', viewId })
 *   const out  = await batch.post(wsId, baseId, { operation: 'columnAdd', tableId }, payload)
 *
 * Opting out (immediate, do-not-batch) — pass `{ immediate: true }`:
 *
 *   const tbl = await batch.get(wsId, baseId, { operation: 'tableGet', tableId }, { immediate: true })
 *
 * Use `immediate` for calls that:
 *   • run on a code path where waiting an extra ~8ms is visible (e.g. cursor
 *     interactions, drag-drop), or
 *   • return a payload that would balloon a batch (large list responses), or
 *   • the caller wants to surface the network error immediately rather than
 *     wait for the surrounding batch.
 */

const FLUSH_WINDOW_MS = 8 // matches Vue's mount-tick burst window
const MAX_BATCH_SIZE = 25 // mirrors BATCH_MAX_SIZE on the backend

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

  constructor(
    private readonly send: (ops: SubOp[]) => Promise<BatchResult[]>,
  ) {}

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
      // Transport-level failure: reject every caller — the whole batch never
      // reached the server, so we can't tell which sub-ops would have succeeded.
      for (const b of batch) b.reject(e)
      return
    }

    // Server contract: `results[i]` corresponds to `operations[i]` from the
    // request. Length mismatch would mean the contract is broken — reject
    // every caller rather than silently misalign successes to failures.
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

// One batcher per (workspaceId, baseId). Cross-target requests can't be
// merged because the URL itself encodes both — keyed map keeps them apart.
const batchers = new Map<string, Batcher>()

export interface BatchOpts {
  /**
   * If true, send this call as a standalone request instead of queueing it
   * into the next batch. Use for cases where the ~8ms debounce is visible,
   * the response is large, or the caller wants synchronous error surfacing.
   */
  immediate?: boolean
}

export function useInternalBatch() {
  const { $api } = useNuxtApp()

  function getBatcher(workspaceId: string, baseId: string): Batcher {
    const key = `${workspaceId}::${baseId}`
    let b = batchers.get(key)
    if (!b) {
      b = new Batcher(async (ops) => {
        const res: any = await $api.internal.postOperation(
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
   * Batched equivalent of `$api.internal.getOperation`. The `operation`
   * field is required; everything else in `params` flows through as the
   * sub-op's `query` payload.
   */
  function get<T = any>(
    workspaceId: string,
    baseId: string,
    params: { operation: string; [k: string]: any },
    opts: BatchOpts = {},
  ): Promise<T> {
    if (opts.immediate) {
      return $api.internal.getOperation(workspaceId, baseId, params as any) as Promise<T>
    }
    const { operation, ...query } = params
    return getBatcher(workspaceId, baseId).call({ operation, query })
  }

  /**
   * Batched equivalent of `$api.internal.postOperation`. `body` becomes the
   * sub-op's `payload`; the rest of `params` (minus `operation`) becomes
   * its `query`.
   */
  function post<T = any>(
    workspaceId: string,
    baseId: string,
    params: { operation: string; [k: string]: any },
    body?: any,
    opts: BatchOpts = {},
  ): Promise<T> {
    if (opts.immediate) {
      return $api.internal.postOperation(
        workspaceId,
        baseId,
        params as any,
        body,
      ) as Promise<T>
    }
    const { operation, ...query } = params
    return getBatcher(workspaceId, baseId).call({ operation, query, payload: body })
  }

  return { get, post }
}
