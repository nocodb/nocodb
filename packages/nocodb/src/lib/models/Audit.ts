import { AuditOperationTypes, AuditType } from 'nocodb-sdk';
import { MetaTable } from '../utils/globals';
import Noco from '../Noco';
import Model from './Model';
import { extractProps } from '../meta/helpers/extractProps';

export default class Audit implements AuditType {
  id?: string;
  user?: string;
  ip?: string;
  base_id?: string;
  project_id?: string;
  fk_model_id?: string;
  row_id?: string;
  op_type?: string;
  op_sub_type?: string;
  status?: string;
  description?: string;
  details?: string;

  constructor(audit: Partial<Audit>) {
    Object.assign(this, audit);
  }

  public static async get(auditId: string) {
    const audit = await Noco.ncMeta.metaGet2(
      null,
      null,
      MetaTable.AUDIT,
      auditId
    );
    return audit && new Audit(audit);
  }

  // Will only await for Audit insertion if `forceAwait` is true, which will be true in test environment by default
  public static async insert(
    audit: Partial<
      Audit & {
        created_at?;
        updated_at?;
      }
    >,
    ncMeta = Noco.ncMeta,
    { forceAwait }: { forceAwait: boolean } = {
      forceAwait: process.env['TEST'] === 'true',
    }
  ) {
    if (process.env.NC_DISABLE_AUDIT === 'true') {
      return;
    }
    const insertAudit = async () => {
      const insertObj = extractProps(audit, [
        'user',
        'ip',
        'base_id',
        'project_id',
        'row_id',
        'fk_model_id',
        'op_type',
        'op_sub_type',
        'status',
        'description',
        'details',
        'created_at',
        'updated_at',
      ]);
      if (!insertObj.project_id && insertObj.fk_model_id) {
        insertObj.project_id = (
          await Model.getByIdOrName({ id: insertObj.fk_model_id }, ncMeta)
        ).project_id;
      }

      return await ncMeta.metaInsert2(null, null, MetaTable.AUDIT, insertObj);
    };

    if (forceAwait) {
      return await insertAudit();
    } else {
      insertAudit();
    }
  }

  public static async commentsCount(args: {
    ids: string[];
    fk_model_id: string;
  }) {
    const audits = await Noco.ncMeta
      .knex(MetaTable.AUDIT)
      .count('id', { as: 'count' })
      .select('row_id')
      .whereIn('row_id', args.ids)
      .where('fk_model_id', args.fk_model_id)
      .where('op_type', AuditOperationTypes.COMMENT)
      .groupBy('row_id');

    return audits?.map((a) => new Audit(a));
  }
  public static async commentsList(args) {
    const query = Noco.ncMeta
      .knex(MetaTable.AUDIT)
      .where('row_id', args.row_id)
      .where('fk_model_id', args.fk_model_id)
      .orderBy('created_at', 'desc');

    if ((args.comments_only as any) == 'true')
      query.where('op_type', AuditOperationTypes.COMMENT);

    const audits = await query;

    return audits?.map((a) => new Audit(a));
  }

  static async projectAuditList(projectId: string, { limit = 25, offset = 0 }) {
    return await Noco.ncMeta.metaList2(null, null, MetaTable.AUDIT, {
      condition: { project_id: projectId },
      orderBy: {
        created_at: 'desc',
      },
      limit,
      offset,
    });
  }
  static async projectAuditCount(projectId: string): Promise<number> {
    return (
      await Noco.ncMeta
        .knex(MetaTable.AUDIT)
        .where({ project_id: projectId })
        .count('id', { as: 'count' })
        .first()
    )?.count;
  }

  static async deleteRowComments(fk_model_id: string, ncMeta = Noco.ncMeta) {
    return ncMeta.metaDelete(null, null, MetaTable.AUDIT, {
      fk_model_id,
    });
  }
}
