import AuditCE from 'src/models/Audit';
import { NO_SCOPE } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { isOnPrem } from '~/utils';

export default class Audit extends AuditCE {
  static async workspaceAuditList(
    context: NcContext,
    {
      page = 1,
      baseId,
      user,
      type,
      startDate,
      endDate,
      orderBy,
    }: {
      page?: number;
      baseId?: string;
      user?: string;
      type?: string[];
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
      };
    },
  ) {
    const limit = 25;
    const offset = (Math.max(1, page ?? 1) - 1) * limit;

    if (!context.workspace_id) {
      return [];
    }

    if (baseId === NO_SCOPE) {
      baseId = undefined;
    }

    if (orderBy?.created_at) {
      orderBy.created_at = orderBy.created_at === 'asc' ? 'asc' : 'desc';
    }

    return await Noco.ncAudit.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        orderBy: {
          ...(orderBy?.created_at
            ? { id: orderBy?.created_at }
            : { id: 'desc' }),
        },
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: context.workspace_id } },
            { version: { eq: 1 } },
            ...(baseId ? [{ base_id: { eq: baseId } }] : []),
            ...(user ? [{ user: { eq: user } }] : []),
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
            ...(type ? [{ op_type: { in: type } }] : []),
          ],
        },
      },
    );
  }

  static async workspaceAuditCount(
    context: NcContext,
    {
      baseId,
      user,
      type,
      startDate,
      endDate,
    }: {
      baseId?: string;
      user?: string;
      type?: string[];
      startDate?: string;
      endDate?: string;
    },
  ) {
    if (!context.workspace_id) {
      return 0;
    }

    if (baseId === NO_SCOPE) {
      baseId = undefined;
    }

    return Noco.ncAudit.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: context.workspace_id } },
            { version: { eq: 1 } },
            ...(baseId ? [{ base_id: { eq: baseId } }] : []),
            ...(user ? [{ user: { eq: user } }] : []),
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
}
