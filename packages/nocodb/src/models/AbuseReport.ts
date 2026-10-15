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

  static async countRecent(
    params: { ip: string; resource_type: string; resource_id: string },
    windowSeconds: number,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    return ncMeta.metaCount(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ABUSE_REPORTS,
      {
        condition: params,
        xcCondition: {
          created_at: { ge: sinceSeconds(windowSeconds, ncMeta) },
        },
      },
    );
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
