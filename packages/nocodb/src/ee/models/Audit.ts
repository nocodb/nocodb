import AuditCE from 'src/models/Audit';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { isOnPrem } from '~/utils';

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
    return await Noco.ncAudit.metaList2(
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
    return await Noco.ncAudit.metaCount(
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
      type?: string[];
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
        user?: 'asc' | 'desc';
      };
    },
  ) {
    return await Noco.ncAudit.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        condition: {
          version: 1,
          fk_workspace_id: workspaceId,
          ...(user ? { user: user } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
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
            ...(type ? [{ op_type: { in: type } }] : []),
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
      type?: string[];
      startDate?: string;
      endDate?: string;
    },
  ): Promise<number> {
    return await Noco.ncAudit.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          version: 1,
          fk_workspace_id: workspaceId,
          ...(user ? { user: user } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
        },
        xcCondition: {
          _and: [
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
            ...(type ? [{ op_type: { in: type } }] : []),
          ],
        },
      },
    );
  }

  public static async insert(
    audit: Partial<Audit> | Partial<Audit>[],
    ncAudit = Noco.ncAudit,
    {
      forceAwait,
      catchException = false,
    }: { forceAwait: boolean; catchException?: boolean } = {
      forceAwait: process.env['TEST'] === 'true',
    },
  ) {
    // disable audit by default and enable it only in test environment
    // skip disabling it in on-prem and enable data audit by default
    if (
      process.env.NC_ENABLE_AUDIT !== 'true' &&
      process.env.NODE_ENV !== 'test' &&
      !isOnPrem &&
      !(Array.isArray(audit) ? audit[0] : audit)?.op_type?.startsWith('DATA_')
    ) {
      return;
    }

    return AuditCE.insert(audit, ncAudit, { forceAwait, catchException });
  }

  static async globalAuditList({
    limit = 25,
    offset = 0,
    workspaceId,
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
    workspaceId?: string;
    baseId?: string;
    sourceId?: string;
    user?: string;
    type?: string[];
    startDate?: string;
    endDate?: string;
    orderBy?: {
      created_at?: 'asc' | 'desc';
      user?: 'asc' | 'desc';
    };
  }) {
    return await Noco.ncAudit.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        condition: {
          version: 1,
          ...(user ? { user: user } : {}),
          ...(workspaceId ? { fk_workspace_id: workspaceId } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
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
            ...(type ? [{ op_type: { in: type } }] : []),
          ],
        },
      },
    );
  }

  static async globalAuditCount({
    user,
    workspaceId,
    baseId,
    sourceId,
    type,
    startDate,
    endDate,
  }: {
    user?: string;
    workspaceId?: string;
    baseId?: string;
    sourceId?: string;
    type?: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    return await Noco.ncAudit.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          version: 1,
          ...(user ? { user: user } : {}),
          ...(workspaceId ? { fk_workspace_id: workspaceId } : {}),
          ...(baseId ? { base_id: baseId } : {}),
          ...(sourceId ? { source_id: sourceId } : {}),
        },
        xcCondition: {
          _and: [
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
            ...(type ? [{ op_type: { in: type } }] : []),
          ],
        },
      },
    );
  }
}
