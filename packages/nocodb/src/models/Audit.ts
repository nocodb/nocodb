import { AuditOperationTypes } from 'nocodb-sdk';
import type { AuditV1OperationTypes } from 'nocodb-sdk';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';
import { stringifyMetaProp } from '~/utils/modelUtils';

export default class Audit {
  id?: string;
  user?: string;
  fk_user_id?: string;
  user_agent?: string;
  ip?: string;
  source_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_model_id?: string;
  row_id?: string;
  op_type?: AuditV1OperationTypes;
  description?: string;
  details?: any;
  version?: number;
  fk_parent_id?: string;

  constructor(audit: Partial<Audit>) {
    Object.assign(this, audit);
  }

  public static async get(auditId: string) {
    const audit = await Noco.ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      auditId,
    );
    return audit && new Audit(audit);
  }

  // Will only await for Audit insertion if `forceAwait` is true, which will be true in test environment by default
  public static async insert(
    audit: Partial<Audit> | Partial<Audit>[],
    ncMeta = Noco.ncMeta,
    {
      forceAwait,
      catchException = false,
    }: { forceAwait: boolean; catchException?: boolean } = {
      forceAwait: process.env['TEST'] === 'true',
    },
  ) {
    try {
      if (process.env.NC_DISABLE_AUDIT === 'true') {
        return;
      }
      const propsToExtract = [
        'user',
        'ip',
        'source_id',
        'fk_workspace_id',
        'base_id',
        'row_id',
        'fk_model_id',
        'op_type',
        'op_sub_type',
        'description',
        'details',
        'user_agent',
        'version',
        'fk_user_id',
        'fk_ref_id',
        'fk_parent_id',
        'id',
      ];

      const insertAudit = async () => {
        if (Array.isArray(audit)) {
          const insertObjs = audit
            .filter((k) => k)
            .map((a) => ({
              ...extractProps(a, propsToExtract),
              details: stringifyMetaProp(a, 'details'),
            }));

          return await ncMeta.bulkMetaInsert(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.AUDIT,
            insertObjs,
          );
        } else {
          const insertObj = extractProps(audit, propsToExtract);

          return await ncMeta.metaInsert2(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.AUDIT,
            { ...insertObj, details: stringifyMetaProp(insertObj, 'details') },
          );
        }
      };

      if (forceAwait) {
        return await insertAudit();
      } else {
        return insertAudit().catch((e) => {
          console.error('Error inserting audit', e);
        });
      }
    } catch (e) {
      if (!catchException) {
        console.error('Error inserting audit', e);
      } else {
        throw e;
      }
    }
  }

  public static async auditList({
    limit: _limit = 25,
    offset: _offset = 0,
    fk_model_id,
    row_id,
  }: {
    limit?: number | string;
    offset?: number | string;
    fk_model_id: string;
    row_id: string;
  }) {
    const limit = Math.max(1, Math.min(+_limit || 25, 1000));
    const offset = Math.max(0, +_offset || 0);

    const query = Noco.ncMeta
      .knex(MetaTable.AUDIT)
      .join(
        MetaTable.USERS,
        `${MetaTable.USERS}.email`,
        `${MetaTable.AUDIT}.user`,
      )
      .select(`${MetaTable.AUDIT}.*`, `${MetaTable.USERS}.display_name`)
      .where('row_id', row_id)
      .where('fk_model_id', fk_model_id)
      .where('op_type', '!=', AuditOperationTypes.COMMENT)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const audits = await query;

    return audits?.map((a) => new Audit(a));
  }

  public static async auditCount({
    fk_model_id,
    row_id,
  }: {
    fk_model_id: string;
    row_id: string;
  }) {
    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        xcCondition: {
          _and: [
            {
              row_id: {
                eq: row_id,
              },
            },
            {
              fk_model_id: {
                eq: fk_model_id,
              },
            },
            {
              op_type: {
                neq: AuditOperationTypes.COMMENT,
              },
            },
          ],
        },
      },
    );
  }

  static async baseAuditList(
    baseId: string,
    {
      limit = 25,
      offset = 0,
      sourceId,
      orderBy,
    }: {
      limit?: number;
      offset?: number;
      sourceId?: string;
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
        },
        orderBy: {
          ...(orderBy?.created_at
            ? { created_at: orderBy?.created_at }
            : !orderBy?.user
            ? { created_at: 'desc' }
            : {}),
          ...(orderBy?.user ? { user: orderBy?.user } : {}),
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
    }: {
      sourceId?: string;
    },
  ): Promise<number> {
    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: {
          base_id: baseId,
          ...(sourceId ? { source_id: sourceId } : {}),
        },
      },
    );
  }

  static async sourceAuditList(sourceId: string, { limit = 25, offset = 0 }) {
    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        condition: { source_id: sourceId },
        orderBy: {
          created_at: 'desc',
        },
        limit,
        offset,
      },
    );
  }

  static async sourceAuditCount(sourceId: string) {
    return (
      await Noco.ncMeta
        .knex(MetaTable.AUDIT)
        .where({ source_id: sourceId })
        .count('id', { as: 'count' })
        .first()
    )?.count;
  }

  static async projectAuditList({
    limit = 25,
    offset = 0,
    orderBy,
  }: {
    limit?: number;
    offset?: number;
    orderBy?: {
      created_at?: 'asc' | 'desc';
      user?: 'asc' | 'desc';
    };
  }) {
    return await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit,
        offset,
        orderBy: {
          ...(orderBy?.created_at
            ? { created_at: orderBy?.created_at }
            : !orderBy?.user
            ? { created_at: 'desc' }
            : {}),
          ...(orderBy?.user ? { user: orderBy?.user } : {}),
        },
      },
    );
  }

  static async projectAuditCount(): Promise<number> {
    return await Noco.ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {},
    );
  }
}
