import PQueue from 'p-queue';

interface HandlerType<T> {
  (): Promise<T>;
}
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
      if (abortController.signal?.aborted) {
        return;
      }
      try {
        const handlerResult = await handler();
        if (typeof handlerResult !== 'undefined') {
          result[i] = handlerResult;
        }
      } catch (err) {
        error = err;
        abortController.abort();
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
