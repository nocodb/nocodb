import AuditCE from 'src/models/Audit';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export default class Audit extends AuditCE {
  static async workspaceAuditList(
    workspaceId: string,
    {
      limit = 25,
      offset = 0,
      user,
      base,
      type,
      subType,
      startDate,
      endDate,
      search,
    }: {
      limit?: number;
      offset?: number;
      sourceId?: string;
      user?: string;
      base?: string;
      type?: string;
      subType?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ) {
    // Initialize the condition object
    const condition: any = { fk_workspace_id: workspaceId };

    // Build the condition dynamically
    const additionalConditions = [
      user && { user: user },
      base && { base_id: base },
      type && { op_type: type },
      subType && { op_sub_type: subType },
    ].filter(Boolean);

    // Merge additional conditions into the main condition object
    additionalConditions.forEach((cond) => Object.assign(condition, cond));

    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        condition,
        orderBy: { created_at: 'desc' },
        xcCondition: {
          _or: [
            ...(search
              ? [
                  {
                    user: {
                      like: `%${search}%`,
                    },
                  },
                  {
                    description: {
                      like: `%${search}%`,
                    },
                  },
                ]
              : []),
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
          ],
        },
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
