import { defaultConnectionOptions } from '~/utils/nc-config';
import { XKnex } from '~/db/CustomKnex';
import { DbServer, Org, Workspace } from '~/models';
import SimpleLRUCache from '~/utils/cache';

const DB_SERVER_CACHE = new SimpleLRUCache(1000);
const DB_SERVER_CONNECTION_CACHE = new SimpleLRUCache(1000);

export const getWorkspaceDbServer = async (
  workspaceId: string,
): Promise<DbServer | null> => {
  return await DB_SERVER_CACHE.get(workspaceId, async () => {
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
        ...defaultConnectionOptions,
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
