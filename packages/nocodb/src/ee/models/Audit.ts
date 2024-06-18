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
      orderBy,
    }: {
      limit?: number;
      offset?: number;
      user?: string;
      base?: string;
      type?: string;
      subType?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
        user?: 'asc' | 'desc';
      };
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
        orderBy: {
          created_at: orderBy?.created_at || 'desc',
          ...(orderBy?.user ? { user: orderBy?.user } : {}),
        },
        xcCondition: {
          _or: [
            ...(search?.trim()
              ? [
                  {
                    user: {
                      like: `%${search.toLowerCase()}%`,
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

  static async workspaceAuditCount(
    workspaceId: string,
    {
      user,
      base,
      type,
      subType,
      startDate,
      endDate,
      search,
    }: {
      user?: string;
      base?: string;
      type?: string;
      subType?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
  ): Promise<number> {
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

    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition,
        xcCondition: {
          _or: [
            ...(search?.trim()
              ? [
                  {
                    user: {
                      like: `%${search.toLowerCase()}%`,
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
}
