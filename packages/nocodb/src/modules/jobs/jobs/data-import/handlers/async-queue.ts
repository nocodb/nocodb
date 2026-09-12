type QueueItem<T> =
  | { type: 'data'; value: T; resume: () => void }
  | { type: 'end' }
  | { type: 'error'; error: Error };

/**
 * Bridges callback-based producers (like PapaParse) to AsyncGenerator consumers.
 *
 * The producer calls push(value, resume) — the resume callback is held until
 * the consumer's `for await` loop has yielded and moved to the next iteration.
 * This guarantees backpressure: the producer never gets ahead of the consumer.
 */
export class AsyncQueue<T> {
  private queue: QueueItem<T>[] = [];
  private waiter: ((item: QueueItem<T>) => void) | null = null;

  push(value: T, resume: () => void): void {
    const item: QueueItem<T> = { type: 'data', value, resume };
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(item);
    } else {
      this.queue.push(item);
    }
  }

  end(): void {
    const item: QueueItem<T> = { type: 'end' };
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(item);
    } else {
      this.queue.push(item);
    }
  }

  error(err: Error): void {
    const item: QueueItem<T> = { type: 'error', error: err };
    if (this.waiter) {
      const waiter = this.waiter;
      this.waiter = null;
      waiter(item);
    } else {
      this.queue.push(item);
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    while (true) {
      const item =
        this.queue.length > 0
          ? this.queue.shift()!
          : await new Promise<QueueItem<T>>((resolve) => {
              this.waiter = resolve;
            });

      if (item.type === 'end') return;
      if (item.type === 'error') throw item.error;
      yield item.value;
      item.resume();
    }
  }
}
