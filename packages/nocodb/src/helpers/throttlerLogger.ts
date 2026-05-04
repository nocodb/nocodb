import { Logger } from '@nestjs/common';
import NocoCache from '~/cache/NocoCache';

const FLUSH_INTERVAL_MS = 60_000;
// 1.5x window — absorbs clock skew between pods so a late-arriving leader
// can't emit a duplicate after the early leader's flag has expired.
const REDIS_DEDUP_TTL_SECONDS = 90;

interface Bucket {
  count: number;
  firstSeenMs: number;
  workspaceId?: string;
  baseId?: string;
}

export class ThrottlerLogger {
  private readonly logger = new Logger('ThrottlerLogger');
  private buckets = new Map<string, Bucket>();

  record({ workspaceId, baseId }: { workspaceId?: string; baseId?: string }) {
    const key = `${workspaceId ?? 'anon'}:${baseId ?? '-'}`;
    const existing = this.buckets.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    this.buckets.set(key, {
      count: 1,
      firstSeenMs: Date.now(),
      workspaceId,
      baseId,
    });
  }

  async flush() {
    if (this.buckets.size === 0) return;

    const snapshot = this.buckets;
    this.buckets = new Map();

    const windowId = Math.floor(Date.now() / FLUSH_INTERVAL_MS);

    for (const [key, bucket] of snapshot) {
      const counterKey = `throttler:count:${windowId}:${key}`;
      const leaderKey = `throttler:leader:${windowId}:${key}`;

      // Best-effort: every pod contributes to the shared counter, only the
      // leader logs. The logged total reflects whatever pods had flushed
      // before the leader's INCRBY — i.e. an approximate global count, not
      // exact, but bounded above by the true total.
      let total = bucket.count;
      let isLeader = true;
      try {
        total = await NocoCache.incrbyExpiring(
          'root',
          counterKey,
          bucket.count,
          REDIS_DEDUP_TTL_SECONDS,
        );
        isLeader = await NocoCache.setIfNotExist(
          'root',
          leaderKey,
          '1',
          REDIS_DEDUP_TTL_SECONDS,
        );
      } catch {
        // Cache unavailable — log local count so we don't lose the signal.
        // Worst case is O(pods) duplicate lines for this window.
        total = bucket.count;
        isLeader = true;
      }

      if (!isLeader) continue;

      this.logger.warn(
        `ThrottlerException rollup: count=${total}, workspaceId=${
          bucket.workspaceId ?? 'anon'
        }, baseId=${bucket.baseId ?? '-'}, windowMs=${FLUSH_INTERVAL_MS}`,
      );
    }
  }
}

// Module-level singleton — guarded against re-evaluation under nest watch /
// hot reload to avoid leaking a setInterval per reload.
const SINGLETON_KEY = Symbol.for('nocodb.throttlerLogger');
const g = globalThis as { [SINGLETON_KEY]?: ThrottlerLogger };

if (!g[SINGLETON_KEY]) {
  const instance = new ThrottlerLogger();
  const fallbackLogger = new Logger('ThrottlerLogger');
  setInterval(
    () => instance.flush().catch((err) => fallbackLogger.error(err)),
    FLUSH_INTERVAL_MS,
  ).unref?.();
  g[SINGLETON_KEY] = instance;
}

export const throttlerLogger: ThrottlerLogger = g[SINGLETON_KEY]!;
