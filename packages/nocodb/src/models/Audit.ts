import { AuditOperationTypes } from 'nocodb-sdk';
import type { AuditType } from 'nocodb-sdk';
import Model from '~/models/Model';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable } from '~/utils/globals';

const opTypes = <const>[
  'COMMENT',
  'DATA',
  'PROJECT',
  'VIRTUAL_RELATION',
  'RELATION',
  'TABLE_VIEW',
  'TABLE',
  'VIEW',
  'META',
  'WEBHOOKS',
  'AUTHENTICATION',
  'TABLE_COLUMN',
  'ORG_USER',
];

const opSubTypes = <const>[
  'UPDATE',
  'INSERT',
  'BULK_INSERT',
  'BULK_UPDATE',
  'BULK_DELETE',
  'LINK_RECORD',
  'UNLINK_RECORD',
  'DELETE',
  'CREATE',
  'RENAME',
  'IMPORT_FROM_ZIP',
  'EXPORT_TO_FS',
  'EXPORT_TO_ZIP',
  'SIGNIN',
  'SIGNUP',
  'PASSWORD_RESET',
  'PASSWORD_FORGOT',
  'PASSWORD_CHANGE',
  'EMAIL_VERIFICATION',
  'ROLES_MANAGEMENT',
  'INVITE',
  'RESEND_INVITE',
];

export default class Audit implements AuditType {
  id?: string;
  user?: string;
  ip?: string;
  source_id?: string;
  base_id?: string;
  fk_model_id?: string;
  row_id?: string;
  op_type?: (typeof opTypes)[number];
  op_sub_type?: (typeof opSubTypes)[number];
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
        'base_id',
        'row_id',
        'fk_model_id',
        'op_type',
        'op_sub_type',
        'status',
        'description',
        'details',
      ]);
      if (
        (!insertObj.base_id || !insertObj.source_id) &&
        insertObj.fk_model_id
      ) {
        const model = await Model.getByIdOrName(
          { id: insertObj.fk_model_id },
          ncMeta,
        );

        insertObj.base_id = model.base_id;
        insertObj.source_id = model.source_id;
      }

      return await ncMeta.metaInsert2(null, null, MetaTable.AUDIT, insertObj);
    };

    if (forceAwait) {
      return await insertAudit();
    } else {
      return insertAudit();
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
      .join(
        MetaTable.USERS,
        `${MetaTable.USERS}.email`,
        `${MetaTable.AUDIT}.user`,
      )
      .select(`${MetaTable.AUDIT}.*`, `${MetaTable.USERS}.display_name`)
      .where('row_id', args.row_id)
      .where('fk_model_id', args.fk_model_id)
      .orderBy('created_at', 'desc');

    if ((args.comments_only as any) == 'true')
      query.where('op_type', AuditOperationTypes.COMMENT);

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
    return await Noco.ncMeta.metaList2(null, null, MetaTable.AUDIT, {
      condition: {
        base_id: baseId,
        ...(sourceId ? { source_id: sourceId } : {}),
      },
      orderBy: {
        created_at: 'desc',
      },
      limit,
      offset,
    });
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

  static async deleteRowComments(fk_model_id: string, ncMeta = Noco.ncMeta) {
    return ncMeta.metaDelete(null, null, MetaTable.AUDIT, {
      fk_model_id,
    });
  }

  static async commentUpdate(
    auditId: string,
    audit: Partial<AuditType>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(audit, ['description']);
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.AUDIT,
      updateObj,
      auditId,
    );
  }

  static async sourceAuditList(sourceId: string, { limit = 25, offset = 0 }) {
    return await Noco.ncMeta.metaList2(null, null, MetaTable.AUDIT, {
      condition: { source_id: sourceId },
      orderBy: {
        created_at: 'desc',
      },
      limit,
      offset,
    });
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
