export interface OfflineEdit {
  pk: string
  property: string
  value: unknown
  path: Array<number>
  seq: number
}

export type OfflineEditReplayResult = 'saved' | 'dropped' | 'retry'

export interface OfflineEditReplaySummary {
  saved: number
  /** Edits that couldn't be applied (row gone or evicted, or the server rejected them) */
  dropped: number
  stopped: boolean
}

/** True only when the request never reached the server; a cancelled request or any server response is not. */
export function isNetworkError(e: unknown, isOnline = typeof navigator === 'undefined' ? true : navigator.onLine): boolean {
  if (!e || typeof e !== 'object') return false

  const err = e as { response?: unknown; code?: string; name?: string; isAxiosError?: boolean; __CANCEL__?: boolean }

  if (err.response) return false
  if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.__CANCEL__) return false
  if (err.code === 'ERR_NETWORK') return true

  return err.isAxiosError === true && isOnline === false
}

function offlineEditKey(pk: string, property: string) {
  return `${pk}\u0000${property}`
}

/** Cell edits that failed for lack of a connection: one entry per row pk + field, last write wins. */
export function createOfflineEditQueue() {
  const entries = new Map<string, OfflineEdit>()

  let seq = 0

  let running: Promise<OfflineEditReplaySummary> | null = null

  function currentSeq() {
    return seq
  }

  function enqueue(edit: Omit<OfflineEdit, 'seq'>): OfflineEdit {
    const key = offlineEditKey(edit.pk, edit.property)
    const entry: OfflineEdit = { ...edit, seq: ++seq }
    // Re-insert so replay order follows the latest edit.
    entries.delete(key)
    entries.set(key, entry)
    return entry
  }

  function get(pk: string, property: string) {
    return entries.get(offlineEditKey(pk, property))
  }

  /** Removes the entry unless it was queued after `uptoSeq`. */
  function removeIfNotNewer(pk: string, property: string, uptoSeq: number) {
    const key = offlineEditKey(pk, property)
    const entry = entries.get(key)
    if (entry && entry.seq <= uptoSeq) entries.delete(key)
    return !entries.has(key)
  }

  function clear() {
    entries.clear()
  }

  function size() {
    return entries.size
  }

  function isReplaying() {
    return !!running
  }

  async function runReplay(send: (edit: OfflineEdit) => Promise<OfflineEditReplayResult>) {
    let saved = 0
    let dropped = 0

    for (const edit of [...entries.values()]) {
      // Replaced or removed since the run started.
      if (get(edit.pk, edit.property) !== edit) continue

      let result: OfflineEditReplayResult
      try {
        result = await send(edit)
      } catch {
        result = 'dropped'
      }

      if (result === 'retry') return { saved, dropped, stopped: true }

      if (result === 'saved') saved++
      else dropped++

      removeIfNotNewer(edit.pk, edit.property, edit.seq)
    }

    return { saved, dropped, stopped: false }
  }

  /** One run at a time: a call during a run gets that run's result. */
  function replay(send: (edit: OfflineEdit) => Promise<OfflineEditReplayResult>) {
    if (!running) {
      running = runReplay(send).finally(() => {
        running = null
      })
    }
    return running
  }

  return { enqueue, get, removeIfNotNewer, clear, size, currentSeq, isReplaying, replay }
}

export type OfflineEditQueue = ReturnType<typeof createOfflineEditQueue>
