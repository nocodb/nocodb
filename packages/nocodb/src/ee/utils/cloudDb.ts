import { XKnex } from '~/db/CustomKnex';
import { DbServer, Workspace } from '~/models';
import SimpleLRUCache from '~/utils/cache';

const DB_SERVER_CACHE = new SimpleLRUCache(1000);
const DB_SERVER_CONNECTION_CACHE = new SimpleLRUCache(1000);

export const getWorkspaceDbServer = async (
  workspaceId: string,
): Promise<DbServer | null> => {
  return await DB_SERVER_CACHE.get(workspaceId, async () => {
    const workspace = await Workspace.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    if (workspace.fk_db_instance_id) {
      const dbServer = await DbServer.getWithConfig(
        workspace.fk_db_instance_id,
      );

      if (dbServer) {
        dbServer.config.connection.database = workspace.id;
      }

      return dbServer;
    }
    return null;
  });
};

export const getWorkspaceDbConnection = async (
  workspaceId: string,
): Promise<XKnex | null> => {
  return await DB_SERVER_CONNECTION_CACHE.get(workspaceId, async () => {
    const dbServer = await getWorkspaceDbServer(workspaceId);
    if (dbServer) {
      return XKnex({
        ...dbServer.config,
        pool: { min: 0, max: 10 },
      });
    }
    return null;
  });
};

export const resetWorkspaceDbServer = async (workspaceId: string) => {
  const dbServer = await getWorkspaceDbConnection(workspaceId);
  if (dbServer) {
    // destroy db server connection - ignore errors
    await dbServer.destroy().catch(() => {});
  }

  DB_SERVER_CACHE.delete(workspaceId);
  DB_SERVER_CONNECTION_CACHE.delete(workspaceId);
};
