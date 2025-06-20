import { DbServer, Workspace } from '~/models';
import SimpleLRUCache from '~/utils/cache';

const DB_INSTANCE_CACHE = new SimpleLRUCache(1000);

export const getWorkspaceDbInstance = async (
  workspaceId: string,
): Promise<DbServer | null> => {
  return await DB_INSTANCE_CACHE.get(workspaceId, async () => {
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

export const resetWorkspaceDbInstance = (workspaceId: string) => {
  DB_INSTANCE_CACHE.delete(workspaceId);
};
