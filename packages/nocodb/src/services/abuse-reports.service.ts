import { Injectable, Logger } from '@nestjs/common';
import { AbuseReportResourceType, ViewTypes } from 'nocodb-sdk';
import type {
  AbuseReportReason,
  AbuseReportReqType,
  NcContext,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { AbuseReportSummary } from '~/interface/Mail';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  ABUSE_REASON_LABELS,
  defang,
  truncate,
} from '~/helpers/abuseReportHelpers';
import { MailEvent } from '~/interface/Mail';
import { Base, Model, User, View } from '~/models';
import AbuseReport from '~/models/AbuseReport';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { PublicMetasService } from '~/services/public-metas.service';
import { RootScopes } from '~/utils/globals';

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

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const envInt = (name: string, fallback: number) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

@Injectable()
export class AbuseReportsService {
  protected logger = new Logger('AbuseReportsService');

  constructor(
    protected readonly mailService: MailService,
    protected readonly publicMetasService: PublicMetasService,
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

    validatePayload('swagger.json#/components/schemas/AbuseReportReq', body);

    // Honeypot: pretend success so bots learn nothing.
    if (body.website) return;

    // Validated against the swagger enums above.
    const resourceType = body.resource_type as AbuseReportResourceType;
    const reason = body.reason as AbuseReportReason;

    const resource = await this.resolve(resourceType, body.identifier, req);

    // Per IP *and* page: behind a proxy without NC_TRUST_PROXY every visitor
    // shares one IP, and a flood on one page must not block reports on others.
    const ip = req.clientIp ?? req.ip;
    const limit = envInt('NC_ABUSE_REPORT_RATE_LIMIT', 5);
    if (
      ip &&
      limit > 0 &&
      (await AbuseReport.countRecent(
        { ip, resource_type: resourceType, resource_id: resource.resourceId },
        RATE_LIMIT_WINDOW_SECONDS,
      )) >= limit
    ) {
      NcError.get().tooManyRequests(
        'Too many reports for this page from your network. Please try again later.',
      );
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
    if (
      cooldown > 0 &&
      (await AbuseReport.wasRecentlyNotified(report, cooldown))
    ) {
      return;
    }

    // Only a delivered notification starts the cooldown.
    if (await this.deliver(report.id, this.summary(report, resource))) {
      await AbuseReport.markNotified(report.id);
    }
  }

  /**
   * Self-hosted: emails the configured abuse contact, else every super admin.
   * True when the notification was delivered.
   */
  protected async deliver(
    reportId: string,
    summary: AbuseReportSummary,
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
      payload: { to: to.join(','), ...summary },
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
}
