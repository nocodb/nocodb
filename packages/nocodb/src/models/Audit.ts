import { AuditOperationTypes } from 'nocodb-sdk';
import type { AuditType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';

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
  fk_workspace_id?: string;
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
