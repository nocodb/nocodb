import { defaultConnectionOptions } from '~/utils/nc-config';
import { XKnex } from '~/db/CustomKnex';
import { DbServer, Org, Workspace } from '~/models';
import { LRUMap } from '~/utils/LRUMap';
import { RedisVersionTracker } from '~/utils/RedisVersionTracker';

const MAX_CACHE_SIZE = 2000;

// Local in-memory caches (per-process)
const dbServerCache = new LRUMap<DbServer | null>(MAX_CACHE_SIZE);
const connectionCache = new LRUMap<XKnex>(MAX_CACHE_SIZE, (conn) => {
  conn.destroy().catch(() => {});
});

const versionTracker = new RedisVersionTracker('DB_SERVER_VER', MAX_CACHE_SIZE);

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
  await versionTracker.checkStaleness(workspaceId, () =>
    invalidateLocal(workspaceId),
  );
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
  // Destroy local first, then bump-and-sync so concurrent reads on
  // this server create fresh connections without re-triggering staleness.
  await invalidateLocal(workspaceId);
  await versionTracker.bumpAndSync(workspaceId);
};
