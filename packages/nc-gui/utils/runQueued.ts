/**
 * Wraps an async task so one run is in flight at a time: a call during a run queues a single
 * rerun (however many calls arrive) and gets the running promise.
 */
export function runOneQueueOne(task: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null
  let isQueued = false

  const run = async (): Promise<void> => {
    if (running) {
      isQueued = true
      return running
    }

    running = task().finally(() => {
      running = null
    })

    try {
      await running
    } finally {
      if (isQueued) {
        isQueued = false
        await run()
      }
    }
  }

  return run
}
