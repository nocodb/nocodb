import AuditCE from 'src/models/Audit';
import { NO_SCOPE } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';
import { isOnPrem } from '~/utils';
import { extractProps } from '~/helpers/extractProps';
import { stringifyMetaProp } from '~/utils/modelUtils';
import {
  getChRecordAudit,
  getChWorkspaceAudit,
  pushAuditToKinesis,
} from '~/utils/cloudAudit';

export default class Audit extends AuditCE {
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

    const result = await AuditCE.recordAuditList(context, {
      fk_model_id,
      row_id,
      cursor,
    });

    if (result.length > 0) {
      return result;
    }

    const clickhouseData = (await getChRecordAudit(context, {
      fk_model_id,
      row_id,
      cursor,
      limit: this.limit,
    })) as Partial<Audit>[];

    return clickhouseData;
  }

  static async workspaceAuditList(
    context: NcContext,
    {
      cursor,
      baseId,
      fkUserId,
      type,
      startDate,
      endDate,
      orderBy,
    }: {
      cursor?: string;
      baseId?: string;
      fkUserId?: string;
      type?: string[];
      startDate?: string;
      endDate?: string;
      orderBy?: {
        created_at?: 'asc' | 'desc';
      };
    },
  ) {
    if (!context.workspace_id) {
      return [];
    }

    if (baseId === NO_SCOPE) {
      baseId = undefined;
    }

    const query = Noco.ncAudit
      .knex(MetaTable.AUDIT)
      .where('fk_workspace_id', context.workspace_id)
      .where('version', 1);

    if (baseId) {
      query.where('base_id', baseId);
    }

    if (fkUserId) {
      query.where('fk_user_id', fkUserId);
    }

    if (type) {
      query.where('op_type', 'in', type);
    }

    if (startDate) {
      query.where('created_at', '>=', startDate);
    }

    if (endDate) {
      query.where('created_at', '<=', endDate);
    }

    if (orderBy?.created_at === 'asc') {
      query.orderBy('id', 'asc');
    } else {
      query.orderBy('id', 'desc');
    }

    const [id, _created_at] = cursor?.split('|') ?? [];

    if (id) {
      if (orderBy?.created_at === 'asc') {
        query.where('id', '>', id);
      } else {
        query.where('id', '<', id);
      }
    }

    query.limit(this.limit);

    const result = await query;

    if (result.length > 0) {
      return result;
    }

    const clickhouseData = (await getChWorkspaceAudit(context, {
      cursor,
      baseId,
      fkUserId,
      type,
      startDate,
      endDate,
      orderBy,
      limit: this.limit,
    })) as Partial<Audit>[];

    return clickhouseData;
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

          const results = await ncAudit.bulkMetaInsert(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.AUDIT,
            insertObjs,
          );

          await pushAuditToKinesis(results);

          return results;
        } else {
          const insertObj = extractProps(audit, propsToExtract);

          const result = await ncAudit.metaInsert2(
            RootScopes.ROOT,
            RootScopes.ROOT,
            MetaTable.AUDIT,
            { ...insertObj, details: stringifyMetaProp(insertObj, 'details') },
          );

          await pushAuditToKinesis(result);

          return result;
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
}
