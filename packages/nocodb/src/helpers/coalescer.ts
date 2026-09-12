/**
 * Gather keyed items and hand them to `flush` once, shortly after the first
 * one arrives.
 *
 * For work that is triggered many times but only needs doing once per subject:
 * a re-price writes an expire, a grant and a debt row, and each wants to
 * announce the same new balance. Keying dedupes the subject, and the delay
 * lets an enclosing transaction commit before `flush` reads anything back.
 *
 * `add` is synchronous and cheap, so callers can mark liberally — including
 * from inside a transaction — without caring when the flush happens.
 *
 * In-memory and per-process: two nodes doing the same work each flush once.
 * That is fine when the flush is idempotent (broadcasting a snapshot); it is
 * not a substitute for a lock when the flush writes.
 */
export function createCoalescer<T>(opts: {
  delayMs: number;
  /** Two items with the same key are the same subject — the later one wins. */
  key: (item: T) => string;
  flush: (items: T[]) => void | Promise<void>;
}): { add: (item: T) => void } {
  const pending = new Map<string, T>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    add(item: T) {
      pending.set(opts.key(item), item);

      if (timer) return;

      timer = setTimeout(() => {
        timer = undefined;

        const items = [...pending.values()];
        pending.clear();

        void opts.flush(items);
      }, opts.delayMs);

      // Never hold the process open for pending work.
      timer.unref?.();
    },
  };
}
