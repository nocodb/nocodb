import { Logger } from '@nestjs/common';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';

const logger = new Logger('LockHelpers');

/** Prefix for per-job execution locks (see the JobsProcessor idempotency guard). */
export const JOB_LOCK_PREFIX = 'job:lock:';

/**
 * Lease TTL for job execution locks, in seconds. Deliberately much larger than
 * Bull's default 30s `lockDuration`: a brief event-loop / GC stall that trips
 * Bull's stalled-job detection (and thus re-delivery) must NOT expire our lease,
 * otherwise the re-delivered sibling could acquire the lock and run concurrently.
 * The heartbeat renews the lease well within this window; a crashed worker's
 * lease simply lapses after it, freeing the lock for a takeover.
 */
export const JOB_LOCK_TTL_SECONDS = 150;

/**
 * Heartbeat interval (ms) at which a running job renews its lock. Kept at ~1/5
 * of the TTL so several missed ticks are tolerated before the lease expires.
 */
export const JOB_LOCK_HEARTBEAT_MS = 30_000;

/**
 * Acquires a distributed lock with retry logic and verification.
 *
 * Pass `maxWaitTimeMs: 0` for try-once semantics (cron jobs that should skip
 * their tick when another instance is active, rather than queue up).
 */
export async function acquireLock(
  lockKey: string,
  lockId: string,
  maxWaitTimeMs: number = 30000, // 30 seconds max wait
  ttlSeconds: number = 60, // lock expiration
): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;
  const maxRetries = 20;

  // try-once path — do exactly one acquire attempt, no retry backoff
  const tryOnce = maxWaitTimeMs <= 0;

  while (
    attempt < maxRetries &&
    (tryOnce ? attempt === 0 : Date.now() - startTime < maxWaitTimeMs)
  ) {
    try {
      // Check if lock exists
      const existingLock = await NocoCache.get(
        'root',
        lockKey,
        CacheGetType.TYPE_OBJECT,
      );

      if (!existingLock) {
        // Try to acquire the lock with 1 minute expiration
        await NocoCache.setExpiring(
          'root',
          lockKey,
          {
            lockId,
            timestamp: Date.now(),
            pid: process.pid,
          },
          ttlSeconds,
        );

        // Small delay to ensure cache consistency
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify we actually got the lock
        const verifyLock = await NocoCache.get(
          'root',
          lockKey,
          CacheGetType.TYPE_OBJECT,
        );
        if (verifyLock && verifyLock.lockId === lockId) {
          return true;
        }
      }

      // Lock is held by another thread, wait with exponential backoff
      const backoffDelay = Math.min(100 * Math.pow(1.5, attempt), 2000); // Max 2 seconds
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      attempt++;
    } catch (error) {
      logger.warn(`Lock acquisition attempt failed: ${error.message}`);
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return false;
}

/**
 * Renews (extends) a distributed lock the caller still owns.
 *
 * Used for periodic heartbeat signalling by long-running jobs: as long as the
 * owning execution keeps renewing, the lease never expires; once it stops
 * (completion or crash) the lease lapses after `ttlSeconds` and the lock frees.
 *
 * Returns false — without extending — if the lock is missing or owned by
 * someone else. Callers should treat that as "lost ownership".
 */
export async function renewLock(
  lockKey: string,
  lockId: string,
  ttlSeconds: number = 60,
): Promise<boolean> {
  try {
    const existingLock = await NocoCache.get(
      'root',
      lockKey,
      CacheGetType.TYPE_OBJECT,
    );

    // Only renew a lock we still own.
    if (!existingLock || existingLock.lockId !== lockId) {
      return false;
    }

    await NocoCache.setExpiring(
      'root',
      lockKey,
      {
        lockId,
        timestamp: Date.now(),
        pid: process.pid,
      },
      ttlSeconds,
    );

    return true;
  } catch (error) {
    logger.warn(`Failed to renew lock ${lockKey}: ${error.message}`);
    return false;
  }
}

/**
 * Releases a distributed lock
 */
export async function releaseLock(
  lockKey: string,
  lockId: string,
): Promise<void> {
  try {
    const existingLock = await NocoCache.get(
      'root',
      lockKey,
      CacheGetType.TYPE_OBJECT,
    );

    // Only release if we own the lock
    if (existingLock && existingLock.lockId === lockId) {
      await NocoCache.del('root', lockKey);
    }
  } catch (error) {
    logger.warn(`Failed to release lock ${lockKey}: ${error.message}`);
  }
}
