// Monotonic sequence shared across every stream so generated ids never collide,
// even between unrelated request streams on the same page.
let httpXRequestSeq = 0

/**
 * Tracks the active `X-Request-ID` for a single request stream so that slow,
 * superseded responses can be discarded rather than overwriting fresher state.
 *
 * Whenever the stream's input changes (e.g. a search term), call `refresh()` to
 * start a new epoch — any in-flight request is thereby superseded. Each request
 * calls `track()` to snapshot the active id, attach it as a header, and later
 * ask `isStale()` / `isCurrent()` whether its response still belongs to the
 * current epoch. Multiple requests may be tracked concurrently; each snapshot
 * is independent, so paginated/chunked loads within one epoch don't invalidate
 * each other.
 *
 * @param prefix - human-readable label prefixed to generated ids (aids logging).
 */
export function useHttpXRequestId(prefix = 'req') {
  let currentId = `${prefix}-${++httpXRequestSeq}`

  /** Start a new epoch, superseding any in-flight request. */
  const refresh = () => {
    currentId = `${prefix}-${++httpXRequestSeq}`
  }

  /** Snapshot the active id for a single request. */
  const track = () => {
    const id = currentId

    return {
      /** The captured id — use for headers built manually alongside other keys. */
      id,
      /** Spread into a request config to tag it, e.g. `{ headers: req.headers }`. */
      headers: { 'X-Request-ID': id },
      /** A newer epoch has superseded this request — drop its response. */
      isStale: () => id !== currentId,
      /** This request still owns the current epoch. */
      isCurrent: () => id === currentId,
    }
  }

  return { refresh, track }
}
