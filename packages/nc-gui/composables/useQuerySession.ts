/**
 * Guards against slow, out-of-order responses overwriting fresher state — purely
 * client-side, no request/response headers involved.
 *
 * Whenever the query's input changes (e.g. a search term), call `refresh()` to
 * start a new session, superseding any in-flight request. Each request calls
 * `track()` to snapshot the active session and later ask `isStale()` /
 * `isCurrent()` whether its response still belongs to the current session.
 * Snapshots are independent, so concurrent paginated/chunked loads within one
 * session don't invalidate each other.
 */
export function useQuerySession() {
  let currentEpoch = 0

  /** Start a new session, superseding any in-flight request. */
  const refresh = () => {
    currentEpoch++
  }

  /** Snapshot the active session for a single request. */
  const track = () => {
    const epoch = currentEpoch

    return {
      /** A newer session has superseded this request — drop its response. */
      isStale: () => epoch !== currentEpoch,
      /** This request still owns the current session. */
      isCurrent: () => epoch === currentEpoch,
    }
  }

  return { refresh, track }
}
