import { defaultConnectionOptions } from '~/utils/nc-config';
import { XKnex } from '~/db/CustomKnex';
import { DbServer, Org, Workspace } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';

const VERSION_KEY_PREFIX = 'DB_SERVER_VER';
const MAX_CACHE_SIZE = 2000;

/**
 * Map with LRU eviction. Accessing a key via get() promotes it to
 * most-recently-used so frequently accessed entries survive eviction.
 *
 * Inlined instead of extending SimpleLRUCache because that class has
 * an incompatible async get(key, valueGetter) API, uses untyped objects,
 * and O(n) array-filter LRU tracking.
 */
class LRUMap<V> {
  private map = new Map<string, V>();

  constructor(private maxSize: number, private onEvict?: (value: V) => void) {}

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      // Re-insert to move to end (most recently used)
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.onEvict?.(this.map.get(firstKey)!);
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }
}

// Local in-memory caches (per-process)
const dbServerCache = new LRUMap<DbServer | null>(MAX_CACHE_SIZE);
const connectionCache = new LRUMap<XKnex>(MAX_CACHE_SIZE, (conn) => {
  conn.destroy().catch(() => {});
});

// Tracks the Redis version each workspace was last fetched at locally.
// When another server bumps the Redis version, the mismatch triggers
// a local cache invalidation on the next read — no pub/sub required.
const localVersions = new LRUMap<string>(MAX_CACHE_SIZE);

async function getRedisVersion(workspaceId: string): Promise<string | null> {
  return NocoCache.get(
    'root',
    `${VERSION_KEY_PREFIX}:${workspaceId}`,
    CacheGetType.TYPE_STRING,
  );
}

async function bumpRedisVersion(workspaceId: string): Promise<void> {
  await NocoCache.set(
    'root',
    `${VERSION_KEY_PREFIX}:${workspaceId}`,
    `${Date.now()}`,
  );
}

/**
 * Destroy the local Knex connection (if any) and clear local caches
 * for a single workspace. Does NOT touch Redis.
 */
async function invalidateLocal(workspaceId: string): Promise<void> {
  const conn = connectionCache.get(workspaceId);
  if (conn) {
    await conn.destroy().catch(() => {});
  }
  dbServerCache.delete(workspaceId);
  connectionCache.delete(workspaceId);
}

/**
 * If the Redis version for this workspace differs from the local version
 * we last saw, another server must have called resetWorkspaceDbServer.
 * Clear local caches so the next lookup fetches fresh data.
 */
async function checkStaleness(workspaceId: string): Promise<void> {
  const redisVer = await getRedisVersion(workspaceId);
  const localVer = localVersions.get(workspaceId);

  if (redisVer && redisVer !== localVer) {
    await invalidateLocal(workspaceId);
    localVersions.set(workspaceId, redisVer);
  }
}

export const getWorkspaceDbServer = async (
  workspaceId: string,
): Promise<DbServer | null> => {
  // Cross-server staleness check via Redis
  await checkStaleness(workspaceId);

  if (dbServerCache.has(workspaceId)) {
    return dbServerCache.get(workspaceId);
  }

  // Cache miss — fetch fresh
  let org: Org | null = null;

  const workspace = await Workspace.get(workspaceId);
  if (!workspace) {
    throw new Error('Workspace not found');
  }

  // if workspace is org workspace, use org db server
  if (workspace.fk_org_id) {
    org = await Org.get(workspace.fk_org_id);
  }

  if (org?.fk_db_instance_id || workspace.fk_db_instance_id) {
    const dbServer = await DbServer.getWithConfig(
      org?.fk_db_instance_id || workspace.fk_db_instance_id,
    );

    if (dbServer) {
      dbServer.config.connection.database = org?.id || workspace.id;
    }

    dbServerCache.set(workspaceId, dbServer);
    return dbServer;
  }

  dbServerCache.set(workspaceId, null);
  return null;
};

export const getWorkspaceDbConnection = async (
  workspaceId: string,
): Promise<XKnex | null> => {
  // checkStaleness already ran inside getWorkspaceDbServer,
  // so if the connection was stale it's already been cleared.
  if (connectionCache.has(workspaceId)) {
    return connectionCache.get(workspaceId);
  }

  const dbServer = await getWorkspaceDbServer(workspaceId);
  if (dbServer) {
    const conn = XKnex({
      ...dbServer.config,
      ...defaultConnectionOptions,
    });
    connectionCache.set(workspaceId, conn);
    return conn;
  }
  return null;
};

export const resetWorkspaceDbServer = async (workspaceId: string) => {
  // Bump Redis version — all servers will see the change on next read
  await bumpRedisVersion(workspaceId);

  // Clear local cache + destroy connection immediately
  await invalidateLocal(workspaceId);
  localVersions.delete(workspaceId);
};
