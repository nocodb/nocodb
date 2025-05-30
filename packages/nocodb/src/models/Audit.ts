import { type AuditV1OperationTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
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

  protected static limit = 25;

  constructor(audit: Partial<Audit>) {
    Object.assign(this, audit);
  }

  public static async get(auditId: string, ncAudit = Noco.ncAudit) {
    const audit = await ncAudit.metaGet2(
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
    ncAudit = Noco.ncAudit,
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
      ];

      const insertAudit = async () => {
        if (Array.isArray(audit)) {
          const insertObjs = audit
            .filter((k) => k)
            .map((a) => ({
              ...extractProps(a, propsToExtract),
              details: stringifyMetaProp(a, 'details'),
            }));

          return await ncAudit.bulkMetaInsert(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.AUDIT,
            insertObjs,
          );
        } else {
          const insertObj = extractProps(audit, propsToExtract);

          return await ncAudit.metaInsert2(
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
        insertAudit().catch((e) => {
          console.error('Error inserting audit', e);
        });
        return;
      }
    } catch (e) {
      if (!catchException) {
        console.error('Error inserting audit', e);
      } else {
        throw e;
      }
    }
  }

  public static async recordAuditList(
    context: NcContext,
    {
      fk_model_id,
      row_id,
      cursor,
    }: {
      fk_model_id: string;
      row_id: string;
      cursor?: string;
    },
  ) {
    if (!context.workspace_id || !context.base_id || !fk_model_id || !row_id) {
      return [];
    }

    const [id, _created_at] = cursor?.split('|') ?? [];

    const query = Noco.ncAudit
      .knex(MetaTable.AUDIT)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('fk_model_id', fk_model_id)
      .where('row_id', row_id)
      .orderBy('id', 'desc');

    if (id) {
      query.where('id', '<', id);
    }

    query.limit(this.limit);

    const audits = await query;

    return audits;
  }

  static async baseAuditList(
    context: NcContext,
    {
      page = 1,
      user,
      type,
      startDate,
      endDate,
      orderBy,
    }: {
      page?: number;
      user?: string;
      type?: string[];
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
      };
    },
  ) {
    const offset = (Math.max(1, page ?? 1) - 1) * this.limit;

    if (!context.workspace_id || !context.base_id) {
      console.error('Invalid context for baseAuditList', context);
      return [];
    }

    if (orderBy?.created_at) {
      orderBy.created_at = orderBy.created_at === 'asc' ? 'asc' : 'desc';
    }

    return await Noco.ncAudit.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.AUDIT,
      {
        limit: this.limit,
        offset,
        orderBy: {
          ...(orderBy?.created_at
            ? { id: orderBy?.created_at }
            : { id: 'desc' }),
        },
        xcCondition: {
          _and: [
            { fk_workspace_id: { eq: context.workspace_id } },
            { base_id: { eq: context.base_id } },
            { version: { eq: 1 } },
            ...(user ? [{ user: { eq: user } }] : []),
            ...(startDate ? [{ created_at: { ge: startDate } }] : []),
            ...(endDate ? [{ created_at: { le: endDate } }] : []),
            ...(type ? [{ op_type: { in: type } }] : []),
          ],
        },
      },
    );
  }
}
