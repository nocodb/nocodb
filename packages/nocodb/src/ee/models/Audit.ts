import AuditCE from 'src/models/Audit';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

export default class Audit extends AuditCE {
  static async baseAuditList(
    baseId: string,
    {
      limit = 25,
      offset = 0,
      sourceId,
      user,
      type,
      startDate,
      endDate,
      orderBy,
    }: {
      limit?: number;
      offset?: number;
      sourceId?: string;
      user?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
        user?: 'asc' | 'desc';
      };
    },
  ) {
    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          base_id: baseId,
          ...(sourceId ? { source_id: sourceId } : {}),
          ...(user ? { user: user } : {}),
          ...(type ? { op_type: type } : {}),
        },
        orderBy: {
          ...(orderBy?.created_at
            ? { created_at: orderBy?.created_at }
            : !orderBy?.user
            ? { created_at: 'desc' }
            : {}),
          ...(orderBy?.user ? { user: orderBy?.user } : {}),
        },
        xcCondition: {
          _and: [
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
          ],
        },
        limit,
        offset,
      },
    );
  }

  static async baseAuditCount(
    baseId: string,
    {
      sourceId,
      user,
      type,
      startDate,
      endDate,
    }: {
      sourceId?: string;
      user?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<number> {
    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          base_id: baseId,
          ...(user ? { user: user } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
          ...(type ? { op_type: type } : {}),
        },
        xcCondition: {
          _and: [
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
          ],
        },
      },
    );
  }

  static async workspaceAuditList(
    workspaceId: string,
    {
      limit = 25,
      offset = 0,
      baseId,
      sourceId,
      user,
      type,
      startDate,
      endDate,
      orderBy,
    }: {
      limit?: number;
      offset?: number;
      baseId?: string;
      sourceId?: string;
      user?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
        user?: 'asc' | 'desc';
      };
    },
  ) {
    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        condition: {
          fk_workspace_id: workspaceId,
          ...(user ? { user: user } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
          ...(type ? { op_type: type } : {}),
        },
        orderBy: {
          ...(orderBy?.created_at
            ? { created_at: orderBy?.created_at }
            : !orderBy?.user
            ? { created_at: 'desc' }
            : {}),
          ...(orderBy?.user ? { user: orderBy?.user } : {}),
        },
        xcCondition: {
          _and: [
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
      baseId,
      sourceId,
      type,
      startDate,
      endDate,
    }: {
      user?: string;
      baseId?: string;
      sourceId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<number> {
    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          fk_workspace_id: workspaceId,
          ...(user ? { user: user } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
          ...(type ? { op_type: type } : {}),
        },
        xcCondition: {
          _and: [
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
          ],
        },
      },
    );
  }
}
