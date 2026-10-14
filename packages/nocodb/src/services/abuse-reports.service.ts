import { Injectable, Logger } from '@nestjs/common';
import { AbuseReportResourceType, ViewTypes } from 'nocodb-sdk';
import type {
  AbuseReportReason,
  AbuseReportReqType,
  NcContext,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import {
  ABUSE_REASON_LABELS,
  defang,
  truncate,
} from '~/helpers/abuseReportHelpers';
import { MailEvent } from '~/interface/Mail';
import { Base, Model, View } from '~/models';
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
}

export type AbuseReportResolver = (
  identifier: string,
  req: NcRequest,
) => Promise<ReportedResource>;

const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const envInt = (name: string, fallback: number) => {
  const value = parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const viewNoun = (view: View) =>
  view.type === ViewTypes.FORM ? 'form' : 'view';

@Injectable()
export class AbuseReportsService {
  protected logger = new Logger('AbuseReportsService');

  constructor(
    protected readonly mailService: MailService,
    protected readonly publicMetasService: PublicMetasService,
  ) {}

  /** Resource types this edition can resolve. EE adds its own surfaces. */
  protected resolvers(): Partial<
    Record<AbuseReportResourceType, AbuseReportResolver>
  > {
    return {
      [AbuseReportResourceType.SHARED_VIEW]: (identifier, req) =>
        this.resolveSharedView(identifier, req),
    };
  }

  /** Lookup context for share uuids, which are unique across workspaces. */
  protected bypassContext(): NcContext {
    return {
      workspace_id: RootScopes.BYPASS,
      base_id: RootScopes.BYPASS,
    };
  }

  protected async resolveSharedView(
    identifier: string,
    req: NcRequest,
  ): Promise<ReportedResource> {
    const view = await View.getByUUID(this.bypassContext(), identifier);
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
      noun: viewNoun(view),
    };
  }

  /** Workspace label for the email. CE has no workspaces. */
  protected async workspaceTitle(
    _workspaceId: string | undefined,
  ): Promise<string | undefined> {
    return undefined;
  }

  /** Self-hosted: the configured abuse contact, else every super admin. */
  protected async recipients(): Promise<string[]> {
    const settings = await Noco.getAppSettings();
    if (settings.abuse_contact_email) return [settings.abuse_contact_email];
    return AbuseReport.superAdminEmails();
  }

  /**
   * Public URL from the configured site URL only — the Host header is
   * attacker-controlled and this lands in admin emails.
   */
  protected publicUrl(path: string) {
    const siteUrl = Noco.config?.ncSiteUrl?.replace(/\/+$/, '');
    return siteUrl ? `${siteUrl}${path}` : path;
  }

  async create(param: { body: AbuseReportReqType; req: NcRequest }) {
    const { body, req } = param;

    const settings = await Noco.getAppSettings();
    if (settings.allow_reporting_abuse === false) {
      NcError.get().abuseReportingDisabled();
    }

    validatePayload('swagger.json#/components/schemas/AbuseReportReq', body);

    // Honeypot: pretend success so bots learn nothing.
    if (body.website) return;

    const ip = req.clientIp ?? req.ip;
    const limit = envInt('NC_ABUSE_REPORT_RATE_LIMIT', 5);
    if (
      ip &&
      limit > 0 &&
      (await AbuseReport.countRecentByIp(ip, RATE_LIMIT_WINDOW_SECONDS)) >=
        limit
    ) {
      NcError.get().tooManyRequests(
        'Too many reports from this network. Please try again later.',
      );
    }

    // Validated against the swagger enums above.
    const resourceType = body.resource_type as AbuseReportResourceType;
    const reason = body.reason as AbuseReportReason;

    const resolver = this.resolvers()[resourceType];
    if (!resolver) NcError.get().badRequest('Unsupported resource type');

    const resource = await resolver(body.identifier.trim(), req);

    const report = await AbuseReport.insert({
      resource_type: resourceType,
      resource_id: resource.resourceId,
      resource_title: truncate(resource.title, 255),
      fk_workspace_id: resource.workspaceId,
      workspace_title: truncate(
        await this.workspaceTitle(resource.workspaceId),
        255,
      ),
      base_id: resource.baseId,
      public_url: this.publicUrl(resource.path),
      reason,
      description: body.description.trim(),
      reporter_name: body.name.trim(),
      reporter_email: body.email.trim(),
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

    const to = [...new Set(await this.recipients())].filter(Boolean);
    if (!to.length) {
      this.logger.warn(
        `Abuse report ${report.id} stored; no recipients configured`,
      );
      return;
    }

    const workspace = report.workspace_title
      ? `${report.workspace_title} (${report.fk_workspace_id})`
      : report.fk_workspace_id;

    const sent = await this.mailService.sendMail({
      mailEvent: MailEvent.ABUSE_REPORT,
      payload: {
        to: to.join(','),
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
      },
    });

    // Only a delivered notification starts the cooldown.
    if (sent) await AbuseReport.markNotified(report.id);
  }
}
