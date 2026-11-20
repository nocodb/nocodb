/**
 * Per-key concurrency limit for this process. `acquire` waits up to
 * `maxWaitMs` for a slot and resolves to a release function, or to null when
 * the wait timed out or `signal` aborted.
 */
export class KeyedSemaphore {
  private readonly active = new Map<string, number>();
  private readonly waiting = new Map<string, Array<() => void>>();

  constructor(private readonly limit: number) {}

  async acquire(
    key: string,
    maxWaitMs: number,
    signal?: AbortSignal,
  ): Promise<(() => void) | null> {
    if (this.tryTake(key)) return this.releaser(key);

    const granted = await new Promise<boolean>((resolve) => {
      const queue = this.waiting.get(key) ?? [];
      this.waiting.set(key, queue);

      const onGrant = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onGiveUp);
        resolve(true);
      };
      const onGiveUp = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onGiveUp);
        const index = queue.indexOf(onGrant);
        if (index >= 0) queue.splice(index, 1);
        if (!queue.length) this.waiting.delete(key);
        resolve(false);
      };
      const timer = setTimeout(onGiveUp, maxWaitMs);
      signal?.addEventListener('abort', onGiveUp, { once: true });
      queue.push(onGrant);
    });

    return granted ? this.releaser(key) : null;
  }

  private tryTake(key: string) {
    const count = this.active.get(key) ?? 0;
    if (count >= this.limit) return false;
    this.active.set(key, count + 1);
    return true;
  }

  private releaser(key: string) {
    let released = false;
    return () => {
      if (released) return;
      released = true;

      // Hand the slot straight to the next waiter, so the count never dips.
      const next = this.waiting.get(key)?.shift();
      if (next) {
        if (!this.waiting.get(key).length) this.waiting.delete(key);
        next();
        return;
      }

      const count = (this.active.get(key) ?? 1) - 1;
      if (count > 0) this.active.set(key, count);
      else this.active.delete(key);
    };
  }
}
