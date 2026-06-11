import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';
import { LRUMap } from '~/utils/LRUMap';

/**
 * Pull-based cross-server cache invalidation via Redis version keys.
 *
 * Each key (e.g. workspaceId, sourceId) has a version stored in Redis.
 * When a server invalidates, it bumps the version. Other servers detect
 * the mismatch on their next read and run the provided onStale callback.
 *
 * More reliable than pub/sub — a server that misses a message catches
 * up on the next read instead of staying stale forever.
 */
export class RedisVersionTracker {
  private localVersions: LRUMap<string>;

  constructor(private prefix: string, maxSize = 2000) {
    this.localVersions = new LRUMap<string>(maxSize);
  }

  private redisKey(id: string): string {
    return `${this.prefix}:${id}`;
  }

  private async getRedisVersion(id: string): Promise<string | null> {
    return NocoCache.get('root', this.redisKey(id), CacheGetType.TYPE_STRING);
  }

  /**
   * Bump the Redis version for a key. All servers will see the change
   * on their next checkStaleness() call.
   */
  async bump(id: string): Promise<void> {
    await NocoCache.set('root', this.redisKey(id), `${Date.now()}`);
  }

  /**
   * Check if the local version differs from Redis. If stale, runs
   * onStale and updates the local version. Returns true if stale.
   */
  async checkStaleness(
    id: string,
    onStale: () => Promise<void>,
  ): Promise<boolean> {
    const redisVer = await this.getRedisVersion(id);
    const localVer = this.localVersions.get(id);

    if (redisVer && redisVer !== localVer) {
      await onStale();
      this.localVersions.set(id, redisVer);
      return true;
    }
    return false;
  }

  /**
   * Bump the Redis version AND sync the local version to match.
   * Use on the originating server after local invalidation so that
   * checkStaleness() won't re-trigger deleteConnectionRef.
   */
  async bumpAndSync(id: string): Promise<void> {
    const ver = `${Date.now()}`;
    await NocoCache.set('root', this.redisKey(id), ver);
    this.localVersions.set(id, ver);
  }
}
