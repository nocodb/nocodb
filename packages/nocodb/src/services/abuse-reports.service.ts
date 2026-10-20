import { Injectable, Logger } from '@nestjs/common';
import {
  AbuseReportCandidateRole,
  AbuseReportResourceType,
  AbuseReportStatus,
  AppEvents,
  extractRolesObj,
  MetaEventType,
  OrgUserRoles,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  AbuseReportBlockCandidate,
  AbuseReportDetailType,
  AbuseReportListType,
  AbuseReportReason,
  AbuseReportReqType,
  NcContext,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { AbuseReportMessage, AbuseReportSummary } from '~/interface/Mail';
import NocoCache from '~/cache/NocoCache';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  ABUSE_REASON_LABELS,
  defang,
  ipBucket,
  truncate,
} from '~/helpers/abuseReportHelpers';
import { MailEvent } from '~/interface/Mail';
import { Base, Model, User, View } from '~/models';
import AbuseReport from '~/models/AbuseReport';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { PublicMetasService } from '~/services/public-metas.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { MetaTable, RootScopes } from '~/utils/globals';

export interface ReportedResource {
  resourceId: string;
  title?: string;
  workspaceId?: string;
  baseId?: string;
  /** App-relative path of the public page, e.g. `/nc/form/<uuid>`. */
  path: string;
  /** Noun used in the email, e.g. "form". */
  noun: string;
  workspaceTitle?: string;
}

/** Share uuids are unique across workspaces, so lookups skip tenant scoping. */
export const BYPASS_CONTEXT: NcContext = {
  workspace_id: RootScopes.BYPASS,
  base_id: RootScopes.BYPASS,
};

/** A reported resource's share state and the users behind it. */
export interface ReportedResourceState {
  shared: boolean;
  users: { userId: string; role: AbuseReportCandidateRole }[];
}

export const reportContext = (report: AbuseReport): NcContext => ({
  workspace_id: report.fk_workspace_id,
  base_id: report.base_id,
});

const HOUR = 60 * 60;

const envInt = (name: string, fallback: number) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const cacheKey = (key: string) => `abuse-report:${key}`;

/** Atomically counts a hit in a fixed window; returns the window's total. */
const hit = (key: string, windowSeconds: number) =>
  NocoCache.incrbyExpiring(
    'root',
    cacheKey(`${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`),
    1,
    windowSeconds,
  );

const SUPPRESSED_KEY = cacheKey('suppressed');

/** Adds to the held-back count; never leaves it below zero. */
const addHeld = async (n: number) => {
  const left = await NocoCache.incrbyExpiring(
    'root',
    SUPPRESSED_KEY,
    n,
    7 * 24 * HOUR,
  );
  if (left < 0) {
    await NocoCache.incrbyExpiring(
      'root',
      SUPPRESSED_KEY,
      -left,
      7 * 24 * HOUR,
    );
  }
  return left;
};

@Injectable()
export class AbuseReportsService {
  protected logger = new Logger('AbuseReportsService');
  protected digestTimer?: NodeJS.Timeout;

  constructor(
    protected readonly mailService: MailService,
    protected readonly publicMetasService: PublicMetasService,
    protected readonly appHooksService: AppHooksService,
    protected readonly metaDependencyEventHandler: MetaDependencyEventHandler,
  ) {}

  /**
   * Finds the shared resource with the same checks as its public meta route.
   * EE adds interfaces, dashboards and artifacts.
   */
  protected async resolve(
    type: AbuseReportResourceType,
    identifier: string,
    req: NcRequest,
  ): Promise<ReportedResource> {
    if (type !== AbuseReportResourceType.SHARED_VIEW) {
      NcError.get().badRequest('Unsupported resource type');
    }
    return this.resolveSharedView(identifier, req);
  }

  protected async resolveSharedView(
    identifier: string,
    req: NcRequest,
  ): Promise<ReportedResource> {
    const view = await View.getByUUID(BYPASS_CONTEXT, identifier);
    if (!view) NcError.viewNotFound(identifier);

    const context: NcContext = {
      workspace_id: view.fk_workspace_id,
      base_id: view.base_id,
    };

    if (
      !(await View.verifyPassword(view, req.headers?.['xc-password'] as string))
    ) {
      NcError.get(context).invalidSharedViewPassword();
    }

    const base = await Base.get(context, view.base_id);
    if (!base) NcError.get(context).viewNotFound(identifier);
    this.publicMetasService.checkViewBaseType(view, base);

    const model = await Model.get(context, view.fk_model_id);
    if (!model || model.deleted) NcError.get(context).viewNotFound(identifier);

    const path = await View.getSharedViewPath(context, view.id);
    if (!path) NcError.get(context).viewNotFound(identifier);

    return {
      resourceId: view.id,
      title: view.title,
      workspaceId: view.fk_workspace_id,
      baseId: view.base_id,
      path,
      noun: view.type === ViewTypes.FORM ? 'form' : 'view',
    };
  }

  /** `null` when the resource no longer exists. EE adds its own surfaces. */
  protected async resourceState(
    report: AbuseReport,
  ): Promise<ReportedResourceState | null> {
    if (report.resource_type !== AbuseReportResourceType.SHARED_VIEW) {
      return null;
    }
    const view = await View.get(reportContext(report), report.resource_id);
    if (!view) return null;
    return { shared: !!view.uuid, users: ownerAndCreator(view) };
  }

  /**
   * Turns the public link off, with the side effects of the owner's own
   * unshare (base audit row, dependent syncs), minus its permission guards.
   */
  protected async disableResource(
    report: AbuseReport,
    req: NcRequest,
  ): Promise<void> {
    if (report.resource_type !== AbuseReportResourceType.SHARED_VIEW) {
      NcError.get().badRequest('Unsupported resource type');
    }
    const context = reportContext(report);
    const view = await View.get(context, report.resource_id);
    await View.sharedViewDelete(context, view.id);
    // Clear the password too, so a later re-share starts clean.
    await View.update(
      context,
      view.id,
      { allow_sync: false, password: null },
      false,
    );

    this.appHooksService.emit(AppEvents.SHARED_VIEW_DELETE, {
      user: req.user,
      view,
      req,
      context,
    });
    // Freezes table syncs reading from this view.
    await this.metaDependencyEventHandler.handleEvent(context, {
      eventType: MetaEventType.VIEW_UPDATED,
      oldEntity: View.maskPasswordForResponse(view),
      newEntity: View.maskPasswordForResponse({
        ...view,
        uuid: null,
        allow_sync: false,
        password: null,
      }),
    });
  }

  async create(param: { body: AbuseReportReqType; req: NcRequest }) {
    const { req } = param;
    // Trim before validating, so whitespace can't satisfy the length minimums.
    const body = { ...param.body };
    for (const key of ['identifier', 'name', 'email', 'description'] as const) {
      if (typeof body[key] === 'string') body[key] = body[key].trim();
    }

    const settings = await Noco.getAppSettings();
    if (settings.allow_reporting_abuse === false) {
      NcError.get().abuseReportingDisabled();
    }

    // Behind a proxy without NC_TRUST_PROXY every visitor shares one IP.
    const ip = req.clientIp ?? req.ip;
    const ipKey = ip && ipBucket(ip);

    // Every attempt counts, invalid or not, so random values can't be sprayed.
    const ipLimit = envInt('NC_ABUSE_REPORT_IP_LIMIT', 20);
    if (ipKey && ipLimit > 0 && (await hit(`ip:${ipKey}`, HOUR)) > ipLimit) {
      NcError.get().tooManyRequests(
        'Too many reports from your network. Please try again later.',
      );
    }

    validatePayload('swagger.json#/components/schemas/AbuseReportReq', body);

    // Honeypot: pretend success so bots learn nothing.
    if (body.website) return;

    // Validated against the swagger enums above.
    const resourceType = body.resource_type as AbuseReportResourceType;
    const reason = body.reason as AbuseReportReason;

    const resource = await this.resolve(resourceType, body.identifier, req);

    const limit = envInt('NC_ABUSE_REPORT_RATE_LIMIT', 5);
    if (
      ipKey &&
      limit > 0 &&
      (await hit(`ip:${ipKey}:${resourceType}:${resource.resourceId}`, HOUR)) >
        limit
    ) {
      NcError.get().tooManyRequests(
        'Too many reports for this page from your network. Please try again later.',
      );
    }

    // Enough open reports already flag this page; drop the rest silently so
    // reporters from many IPs can't grow the table.
    const openLimit = envInt('NC_ABUSE_REPORT_OPEN_LIMIT', 10);
    if (
      openLimit > 0 &&
      (await AbuseReport.countOpenForResource({
        resource_type: resourceType,
        resource_id: resource.resourceId,
      })) >= openLimit
    ) {
      return;
    }

    const siteUrl = Noco.config?.ncSiteUrl?.replace(/\/+$/, '') ?? '';
    const report = await AbuseReport.insert({
      resource_type: resourceType,
      resource_id: resource.resourceId,
      resource_title: truncate(resource.title, 255),
      fk_workspace_id: resource.workspaceId,
      workspace_title: truncate(resource.workspaceTitle, 255),
      base_id: resource.baseId,
      // From the configured site URL only: the Host header is attacker-controlled.
      public_url: `${siteUrl}${resource.path}`,
      reason,
      description: body.description,
      reporter_name: body.name,
      reporter_email: body.email,
      ip,
      user_agent: req.headers?.['user-agent'] as string,
    });

    try {
      await this.notify(report, resource);
    } catch (e) {
      this.logger.error(
        `Failed to notify admins of abuse report ${report.id}: ${e.message}`,
        e.stack,
      );
    }
  }

  protected async notify(report: AbuseReport, resource: ReportedResource) {
    const cooldown = envInt('NC_ABUSE_REPORT_NOTIFY_COOLDOWN_SECONDS', 86400);
    const claimKey = cacheKey(
      `notified:${report.resource_type}:${report.resource_id}`,
    );
    // The claim is atomic, so simultaneous reports can't all notify; the
    // stored flag keeps the cooldown across restarts.
    if (
      cooldown > 0 &&
      ((await AbuseReport.wasRecentlyNotified(report, cooldown)) ||
        !(await NocoCache.setIfNotExist('root', claimKey, '1', cooldown)))
    ) {
      return;
    }
    // Only a delivered notification starts the cooldown.
    const release = () =>
      cooldown > 0 ? NocoCache.del('root', claimKey) : undefined;

    // Instance-wide budget: a flood across many pages must not flood the
    // inbox. Held-back reports go out as a digest when the window ends.
    const budget = envInt('NC_ABUSE_REPORT_NOTIFY_LIMIT', 20);
    if (budget > 0 && (await hit('notify', HOUR)) > budget) {
      await addHeld(1);
      await release();
      await this.scheduleDigest();
      return;
    }

    const suppressed = await addHeld(0);
    const summary = this.summary(report, resource);
    if (suppressed > 0) summary.suppressed = suppressed;

    if (await this.deliver(report.id, summary)) {
      await AbuseReport.markNotified(report.id);
      if (suppressed > 0) await addHeld(-suppressed);
    } else {
      await release();
    }
  }

  /**
   * One instance per window sends the digest once the window ends. A restart
   * drops the timer; the next notification still carries the count.
   */
  protected async scheduleDigest() {
    const window = Math.floor(Date.now() / 1000 / HOUR);
    const claimed = await NocoCache.setIfNotExist(
      'root',
      cacheKey(`digest:${window}`),
      '1',
      2 * HOUR,
    );
    if (!claimed) return;
    clearTimeout(this.digestTimer);
    this.digestTimer = setTimeout(() => {
      this.sendDigest().catch((e) =>
        this.logger.error(
          `Failed to send abuse report digest: ${e.message}`,
          e.stack,
        ),
      );
    }, (window + 1) * HOUR * 1000 - Date.now() + 1000);
    this.digestTimer.unref();
  }

  /** Sends the held-back count, unless a notification already carried it. */
  async sendDigest() {
    const held = await addHeld(0);
    if (held > 0 && (await this.deliver('digest', { held }))) {
      await addHeld(-held);
    }
  }

  /**
   * Self-hosted: emails the configured abuse contact, else every super admin.
   * True when the notification was delivered.
   */
  protected async deliver(
    reportId: string,
    message: AbuseReportMessage,
  ): Promise<boolean> {
    const settings = await Noco.getAppSettings();
    const to = settings.abuse_contact_email
      ? [settings.abuse_contact_email]
      : await User.superAdminEmails();
    if (!to.length) {
      this.logger.warn(`Abuse report ${reportId} stored; no recipients`);
      return false;
    }
    return this.mailService.sendMail({
      mailEvent: MailEvent.ABUSE_REPORT,
      payload: { to: to.join(','), ...message },
    });
  }

  /** Report fields for a notification, truncated and defanged. */
  protected summary(
    report: AbuseReport,
    resource: ReportedResource,
  ): AbuseReportSummary {
    const workspace = report.workspace_title
      ? `${report.workspace_title} (${report.fk_workspace_id})`
      : report.fk_workspace_id;

    return {
      subjectTitle: defang(truncate(report.resource_title, 64)) || 'A page',
      resourceType: resource.noun,
      resourceTitle: defang(truncate(report.resource_title, 200)),
      workspace: defang(truncate(workspace, 200)),
      publicUrl: defang(report.public_url),
      reason: ABUSE_REASON_LABELS[report.reason] ?? report.reason,
      reporter: defang(
        `${truncate(report.reporter_name, 64)} <${truncate(
          report.reporter_email,
          128,
        )}>`,
      ),
      description: defang(report.description),
      reportedAt:
        new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      ids: [
        `Report ${report.id}`,
        `Resource ${report.resource_id}`,
        report.base_id && `Base ${report.base_id}`,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }

  // Admin queue — self-hosted super admins only (gated by ACL).

  async adminList(param: {
    status?: string;
    page?: number | string;
    pageSize?: number | string;
  }): Promise<AbuseReportListType> {
    const status = Object.values(AbuseReportStatus).includes(
      param.status as AbuseReportStatus,
    )
      ? (param.status as AbuseReportStatus)
      : undefined;
    const page = Math.max(1, Number(param.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(param.pageSize) || 25));

    const [{ list, totalRows }, openCount] = await Promise.all([
      AbuseReport.list({ status, page, pageSize }),
      AbuseReport.countByStatus(AbuseReportStatus.OPEN),
    ]);

    return { list, pageInfo: { totalRows, page, pageSize }, openCount };
  }

  async adminGet(reportId: string): Promise<AbuseReportDetailType> {
    const report = await this.getReportOrFail(reportId);
    const state = await this.resourceState(report);

    const users = [
      ...(state?.users ?? []),
      ...(await this.baseOwnerIds(report.base_id)).map((userId) => ({
        userId,
        role: AbuseReportCandidateRole.BASE_OWNER,
      })),
    ];

    return {
      ...report,
      resource_shared: !!state?.shared,
      candidates: await this.toCandidates(users),
    };
  }

  async adminUpdateStatus(param: {
    reportId: string;
    status: string;
    req: NcRequest;
  }) {
    if (
      !Object.values(AbuseReportStatus).includes(
        param.status as AbuseReportStatus,
      )
    ) {
      NcError.get().invalidRequestBody('Invalid status');
    }
    const status = param.status as AbuseReportStatus;
    const report = await this.getReportOrFail(param.reportId);

    const updated = await AbuseReport.update(report.id, {
      status,
      ...(status === AbuseReportStatus.OPEN
        ? { resolved_by: null, resolved_at: null }
        : { resolved_by: param.req.user?.id, resolved_at: Noco.ncMeta.now() }),
    });

    this.appHooksService.emit(AppEvents.ABUSE_REPORT_UPDATE, {
      report: updated,
      req: param.req,
    });

    return updated;
  }

  /**
   * Turns the reported link off and resolves every open report about it.
   * Bypasses the owner-facing unshare guards (base role, schema lock) on
   * purpose: this is instance-level moderation.
   */
  async adminDisableResource(param: { reportId: string; req: NcRequest }) {
    const report = await this.getReportOrFail(param.reportId);
    const state = await this.resourceState(report);
    if (!state) NcError.get().notFound('The reported item no longer exists');

    if (state.shared) await this.disableResource(report, param.req);

    const now = Noco.ncMeta.now();
    const userId = param.req.user?.id;
    await AbuseReport.resolveOpenForResource(
      {
        resource_type: report.resource_type,
        resource_id: report.resource_id,
      },
      { resolved_by: userId, resolved_at: now },
    );
    const updated = await AbuseReport.update(report.id, {
      resource_disabled_by: userId,
      resource_disabled_at: now,
      ...(report.status === AbuseReportStatus.OPEN
        ? {
            status: AbuseReportStatus.RESOLVED,
            resolved_by: userId,
            resolved_at: now,
          }
        : {}),
    });

    this.appHooksService.emit(AppEvents.ABUSE_REPORT_RESOURCE_DISABLE, {
      report: updated,
      req: param.req,
    });

    return updated;
  }

  async blockUser(param: { userId: string; reason?: string; req: NcRequest }) {
    const user = await this.getBlockableUser(param.userId, param.req);
    const reason =
      typeof param.reason === 'string'
        ? truncate(param.reason, 255) || undefined
        : undefined;

    await User.block(user.id, reason);

    this.appHooksService.emit(AppEvents.ORG_USER_BLOCK, {
      userId: user.id,
      email: user.email,
      reason,
      req: param.req,
    });

    return { id: user.id, blocked: true };
  }

  async unblockUser(param: { userId: string; req: NcRequest }) {
    const user = await User.get(param.userId);
    if (!user) NcError.get().userNotFound(param.userId);

    await User.unblock(user.id);

    this.appHooksService.emit(AppEvents.ORG_USER_UNBLOCK, {
      userId: user.id,
      email: user.email,
      req: param.req,
    });

    return { id: user.id, blocked: false };
  }

  protected async getReportOrFail(reportId: string) {
    const report = reportId && (await AbuseReport.get(reportId));
    if (!report) NcError.get().genericNotFound('Abuse report', reportId);
    return report;
  }

  protected async getBlockableUser(userId: string, req: NcRequest) {
    const user = userId && (await User.get(userId));
    if (!user) NcError.get().userNotFound(userId);
    if (user.id === req.user?.id) {
      NcError.get().badRequest('You cannot block yourself');
    }
    if (extractRolesObj(user.roles)?.[OrgUserRoles.SUPER_ADMIN]) {
      NcError.get().forbidden('Super admins cannot be blocked');
    }
    return user;
  }

  protected async baseOwnerIds(baseId?: string): Promise<string[]> {
    if (!baseId) return [];
    const rows = await Noco.ncMeta
      .knexConnection(MetaTable.PROJECT_USERS)
      .where({ base_id: baseId, roles: 'owner' })
      .select('fk_user_id');
    return rows.map((row) => row.fk_user_id);
  }

  /** One entry per user, with every reason they are a candidate. */
  protected async toCandidates(
    users: { userId: string; role: AbuseReportCandidateRole }[],
  ): Promise<AbuseReportBlockCandidate[]> {
    const roles = new Map<string, AbuseReportCandidateRole[]>();
    for (const { userId, role } of users) {
      if (!userId) continue;
      const list = roles.get(userId) ?? [];
      if (!list.includes(role)) list.push(role);
      roles.set(userId, list);
    }

    const candidates = await Promise.all(
      [...roles].map(async ([userId, userRoles]) => {
        const user = await User.get(userId);
        if (!user || user.is_deleted) return null;
        return {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          roles: userRoles,
          blocked: !!user.blocked,
          is_super_admin: !!extractRolesObj(user.roles)?.[
            OrgUserRoles.SUPER_ADMIN
          ],
        };
      }),
    );
    return candidates.filter(Boolean);
  }
}

/** Owner first, then creator, for resources that track both. */
export const ownerAndCreator = (resource: {
  owned_by?: string;
  created_by?: string;
}) => [
  { userId: resource.owned_by, role: AbuseReportCandidateRole.OWNER },
  { userId: resource.created_by, role: AbuseReportCandidateRole.CREATOR },
];
