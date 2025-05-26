import type { AuditV1OperationTypes } from 'nocodb-sdk';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';
import { stringifyMetaProp } from '~/utils/modelUtils';

export default class RecordAudit {
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

  constructor(audit: Partial<RecordAudit>) {
    Object.assign(this, audit);
  }

  public static async get(auditId: string, ncAudit = Noco.ncAudit) {
    const audit = await ncAudit.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.RECORD_AUDIT,
      auditId,
    );
    return audit && new RecordAudit(audit);
  }

  // Will only await for Audit insertion if `forceAwait` is true, which will be true in test environment by default
  public static async insert(
    audit: Partial<RecordAudit> | Partial<RecordAudit>[],
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
            MetaTable.RECORD_AUDIT,
            insertObjs,
          );
        } else {
          const insertObj = extractProps(audit, propsToExtract);

          return await ncAudit.metaInsert2(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.RECORD_AUDIT,
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

    const query = Noco.ncAudit
      .knex(MetaTable.RECORD_AUDIT)
      .where('row_id', row_id)
      .where('fk_model_id', fk_model_id)
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset);

    const audits = await query;

    return audits?.map((a) => new RecordAudit(a));
  }

  public static async auditCount({
    fk_model_id,
    row_id,
  }: {
    fk_model_id: string;
    row_id: string;
  }) {
    return await Noco.ncAudit.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.RECORD_AUDIT,
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
          ],
        },
      },
    );
  }
}
