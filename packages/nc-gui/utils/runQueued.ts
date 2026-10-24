/**
 * Wraps an async task so one run is in flight at a time. Calls during a run share one queued
 * rerun, and their promise settles once that rerun has finished, so it covers their own change.
 */
export function runOneQueueOne(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null
  let rerun: Promise<void> | null = null

  const run = (): Promise<void> => {
    if (running) {
      rerun ??= running
        .catch(() => undefined)
        .then(() => {
          rerun = null
          return run()
        })
      return rerun
    }

    running = task().finally(() => {
      running = null
    })
    return running
  }

  return run
}
