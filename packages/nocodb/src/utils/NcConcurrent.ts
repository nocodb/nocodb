import PQueue from 'p-queue';

interface HandlerType<T> {
  (): Promise<T>;
}

/**
 * Execute handlers concurrently with a specified concurrency limit.
 * @param handlers Array of handler functions to execute concurrently.
 * @param param1 Configuration object with optional concurrency limit.
 * @returns Promise resolving to an array of results from the handlers.
 */
export const NcConcurrent = async <T>(
  handlers: HandlerType<T>[],
  { concurrency }: { concurrency?: number } = { concurrency: 3 },
) => {
  const result: T[] = [];
  let error: Error;
  const abortController = new AbortController();

  const queue = new PQueue({ concurrency });
  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i];
    queue.add(async () => {
      // if abort signal is fired, we early return
      if (abortController.signal?.aborted) {
        return;
      }
      try {
        const handlerResult = await handler();
        result[i] = handlerResult;
      } catch (err) {
        error = err;
        // fire abort signal
        abortController.abort();
        // clear remaining queue to not run
        queue.clear();
      }
    });
  }
  await queue.onIdle();
  if (error) {
    throw error;
  }

  return result;
};
