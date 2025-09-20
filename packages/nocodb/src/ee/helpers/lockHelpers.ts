import { Logger } from '@nestjs/common';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';

const logger = new Logger('LockHelpers');

/**
 * Acquires a distributed lock with retry logic and verification
 */
export async function acquireLock(
  lockKey: string,
  lockId: string,
  maxWaitTimeMs: number = 30000, // 30 seconds max wait
): Promise<boolean> {
  const startTime = Date.now();
  let attempt = 0;
  const maxRetries = 20;

  while (attempt < maxRetries && Date.now() - startTime < maxWaitTimeMs) {
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
          60, // 1 minute expiration
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
