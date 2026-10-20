import { AbuseReportStatus } from 'nocodb-sdk';
import type {
  AbuseReportReason,
  AbuseReportResourceType,
  AbuseReportType,
} from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

const sinceSeconds = (seconds: number, ncMeta = Noco.ncMeta) =>
  ncMeta.formatDateTime(new Date(Date.now() - seconds * 1000).toISOString());

/** Root-scoped and uncached: rows are written once by anonymous visitors. */
export default class AbuseReport implements AbuseReportType {
  id: string;
  resource_type: AbuseReportResourceType;
  resource_id: string;
  resource_title?: string;
  fk_workspace_id?: string;
  workspace_title?: string;
  base_id?: string;
  public_url: string;
  reason: AbuseReportReason;
  description: string;
  reporter_name: string;
  reporter_email: string;
  ip?: string;
  user_agent?: string;
  admins_notified?: boolean;
  status: AbuseReportStatus;
  resolved_by?: string | null;
  resolved_at?: string | null;
  resource_disabled_by?: string | null;
  resource_disabled_at?: string | null;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<AbuseReport>) {
    Object.assign(this, data);
  }

  static async insert(
    report: Omit<
      AbuseReportType,
      'id' | 'status' | 'admins_notified' | 'created_at' | 'updated_at'
    >,
    ncMeta = Noco.ncMeta,
  ): Promise<AbuseReport> {
    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      {
        ...extractProps(report, [
          'resource_type',
          'resource_id',
          'resource_title',
          'fk_workspace_id',
          'workspace_title',
          'base_id',
          'public_url',
          'reason',
          'description',
          'reporter_name',
          'reporter_email',
          'ip',
        ]),
        user_agent: report.user_agent?.slice(0, 512),
        admins_notified: false,
        status: AbuseReportStatus.OPEN,
      },
    );

    return this.get(id, ncMeta);
  }

  static async get(id: string, ncMeta = Noco.ncMeta) {
    const row = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      id,
    );
    return row && new AbuseReport(row);
  }

  /** Admin queue, newest first. */
  static async list(
    params: { status?: AbuseReportStatus; page: number; pageSize: number },
    ncMeta = Noco.ncMeta,
  ): Promise<{ list: AbuseReport[]; totalRows: number }> {
    const query = () => {
      const qb = ncMeta.knexConnection(MetaTable.ABUSE_REPORTS);
      if (params.status) qb.where('status', params.status);
      return qb;
    };

    const [rows, count] = await Promise.all([
      query()
        .select('*')
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(params.pageSize)
        .offset((params.page - 1) * params.pageSize),
      query().count('id', { as: 'count' }).first(),
    ]);

    return {
      list: rows.map((row) => new AbuseReport(row)),
      totalRows: Number(count?.count ?? 0),
    };
  }

  static async countByStatus(
    status: AbuseReportStatus,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const row = await ncMeta
      .knexConnection(MetaTable.ABUSE_REPORTS)
      .where('status', status)
      .count('id', { as: 'count' })
      .first();
    return Number(row?.count ?? 0);
  }

  static async update(
    id: string,
    data: Partial<
      Pick<
        AbuseReport,
        | 'status'
        | 'resolved_by'
        | 'resolved_at'
        | 'resource_disabled_by'
        | 'resource_disabled_at'
      >
    >,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      data,
      id,
    );
    return this.get(id, ncMeta);
  }

  /** Resolves every open report about one resource. */
  static async resolveOpenForResource(
    params: { resource_type: AbuseReportResourceType; resource_id: string },
    data: { resolved_by?: string; resolved_at: string },
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta
      .knexConnection(MetaTable.ABUSE_REPORTS)
      .where({ ...params, status: AbuseReportStatus.OPEN })
      .update({
        status: AbuseReportStatus.RESOLVED,
        resolved_by: data.resolved_by ?? null,
        resolved_at: data.resolved_at,
        updated_at: data.resolved_at,
      });
  }

  static async countOpenForResource(
    params: { resource_type: string; resource_id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    return ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      { condition: { ...params, status: AbuseReportStatus.OPEN } },
    );
  }

  static async wasRecentlyNotified(
    params: {
      resource_type: AbuseReportResourceType;
      resource_id: string;
      public_url: string;
    },
    windowSeconds: number,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const count = await ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      {
        condition: {
          resource_type: params.resource_type,
          resource_id: params.resource_id,
          public_url: params.public_url,
          admins_notified: true,
        },
        xcCondition: {
          created_at: { ge: sinceSeconds(windowSeconds, ncMeta) },
        },
      },
    );
    return count > 0;
  }

  static async markNotified(id: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      { admins_notified: true },
      id,
    );
  }
}
