import { AuditOperationTypes, AuditOperationSubTypes } from 'nocodb-sdk';
import type { AuditType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';

export default class Audit implements AuditType {
  id?: string;
  user?: string;
  ip?: string;
  source_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_model_id?: string;
  row_id?: string;
  op_type?: AuditOperationTypes;
  op_sub_type?: AuditOperationSubTypes;
  status?: string;
  description?: string;
  details?: string;

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
    audit: Partial<Audit>,
    ncMeta = Noco.ncMeta,
    { forceAwait }: { forceAwait: boolean } = {
      forceAwait: process.env['TEST'] === 'true',
    },
  ) {
    if (process.env.NC_DISABLE_AUDIT === 'true') {
      return;
    }
    const insertAudit = async () => {
      const insertObj = extractProps(audit, [
        'user',
        'ip',
        'source_id',
        'fk_workspace_id',
        'base_id',
        'row_id',
        'fk_model_id',
        'op_type',
        'op_sub_type',
        'status',
        'description',
        'details',
      ]);

      return await ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.AUDIT,
        insertObj,
      );
    };

    if (forceAwait) {
      return await insertAudit();
    } else {
      return insertAudit();
    }
  }

  public static async auditList(args) {
    const query = Noco.ncMeta
      .knex(MetaTable.AUDIT)
      .join(
        MetaTable.USERS,
        `${MetaTable.USERS}.email`,
        `${MetaTable.AUDIT}.user`,
      )
      .select(`${MetaTable.AUDIT}.*`, `${MetaTable.USERS}.display_name`)
      .where('row_id', args.row_id)
      .where('fk_model_id', args.fk_model_id)
      .where('op_type', '!=', AuditOperationTypes.COMMENT)
      .orderBy('created_at', 'desc');

    const audits = await query;

    return audits?.map((a) => new Audit(a));
  }

  static async baseAuditList(
    baseId: string,
    {
      limit = 25,
      offset = 0,
      sourceId,
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
          base_id: baseId,
          ...(sourceId ? { source_id: sourceId } : {}),
        },
        orderBy: {
          created_at: 'desc',
        },
        limit,
        offset,
      },
    );
  }

  static async baseAuditCount(
    baseId: string,
    sourceId?: string,
  ): Promise<number> {
    return (
      await Noco.ncMeta
        .knex(MetaTable.AUDIT)
        .where({
          base_id: baseId,
          ...(sourceId ? { source_id: sourceId } : {}),
        })
        .count('id', { as: 'count' })
        .first()
    )?.count;
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
}
