import { defaultConnectionOptions } from '~/utils/nc-config';
import { XKnex } from '~/db/CustomKnex';
import { DbServer, Org, Workspace } from '~/models';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';

// Local in-memory caches (per-process)
const dbServerCache = new Map<string, DbServer | null>();
const connectionCache = new Map<string, XKnex>();

// Tracks the Redis version each workspace was last fetched at locally.
// When another server bumps the Redis version, the mismatch triggers
// a local cache invalidation on the next read — no pub/sub required.
const localVersions = new Map<string, string>();

const VERSION_KEY_PREFIX = 'DB_SERVER_VER';
const MAX_CACHE_SIZE = 2000;

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

function enforceMaxSize<V>(map: Map<string, V>): void {
  if (map.size >= MAX_CACHE_SIZE) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
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

    enforceMaxSize(dbServerCache);
    dbServerCache.set(workspaceId, dbServer);
    return dbServer;
  }

  enforceMaxSize(dbServerCache);
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
    enforceMaxSize(connectionCache);
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
