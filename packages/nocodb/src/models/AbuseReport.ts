import { AbuseReportStatus, extractRolesObj, OrgUserRoles } from 'nocodb-sdk';
import type {
  AbuseReportReason,
  AbuseReportResourceType,
  AbuseReportType,
} from 'nocodb-sdk';
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
        resource_type: report.resource_type,
        resource_id: report.resource_id,
        resource_title: report.resource_title ?? null,
        fk_workspace_id: report.fk_workspace_id ?? null,
        workspace_title: report.workspace_title ?? null,
        base_id: report.base_id ?? null,
        public_url: report.public_url,
        reason: report.reason,
        description: report.description,
        reporter_name: report.reporter_name,
        reporter_email: report.reporter_email,
        ip: report.ip ?? null,
        user_agent: report.user_agent?.slice(0, 512) ?? null,
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

  static async countRecentByIp(
    ip: string,
    windowSeconds: number,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const row = await ncMeta
      .knexConnection(MetaTable.ABUSE_REPORTS)
      .where('ip', ip)
      .where('created_at', '>=', sinceSeconds(windowSeconds, ncMeta))
      .count('id', { as: 'count' })
      .first();
    return Number(row?.count ?? 0);
  }

  /**
   * Whether admins were already told about this resource at this URL within
   * the window. A rotated share link is a new URL and notifies again.
   */
  static async wasRecentlyNotified(
    params: {
      resource_type: AbuseReportResourceType;
      resource_id: string;
      public_url: string;
    },
    windowSeconds: number,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const row = await ncMeta
      .knexConnection(MetaTable.ABUSE_REPORTS)
      .where({
        resource_type: params.resource_type,
        resource_id: params.resource_id,
        public_url: params.public_url,
        admins_notified: true,
      })
      .where('created_at', '>=', sinceSeconds(windowSeconds, ncMeta))
      .first('id');
    return !!row;
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

  /** Active super admins' emails — default recipients on self-hosted. */
  static async superAdminEmails(ncMeta = Noco.ncMeta): Promise<string[]> {
    const users = await ncMeta
      .knexConnection(MetaTable.USERS)
      .select('email', 'roles', 'blocked', 'is_deleted')
      .where('roles', 'like', `%${OrgUserRoles.SUPER_ADMIN}%`);

    return users
      .filter(
        (u) =>
          u.email &&
          !u.blocked &&
          !u.is_deleted &&
          extractRolesObj(u.roles)?.[OrgUserRoles.SUPER_ADMIN],
      )
      .map((u) => u.email);
  }
}
