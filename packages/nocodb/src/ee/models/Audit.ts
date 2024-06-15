import AuditCE from 'src/models/Audit';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export default class Audit extends AuditCE {
  static async workspaceAuditList(
    workspaceId: string,
    {
      limit = 25,
      offset = 0,
    }: {
      limit?: number;
      offset?: number;
      sourceId?: string;
    },
  ) {
    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          fk_workspace_id: workspaceId,
        },
        orderBy: {
          created_at: 'desc',
        },
        limit,
        offset,
      },
    );
  }

  static async workspaceAuditCount(workspaceId: string): Promise<number> {
    return (
      await Noco.ncMeta
        .knex(MetaTable.AUDIT)
        .where({
          fk_workspace_id: workspaceId,
        })
        .count('id', { as: 'count' })
        .first()
    )?.count;
  }
}
