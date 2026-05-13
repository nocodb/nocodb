import { Injectable, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { MailService as MailServiceEE } from 'src/ee/services/mail/mail.service';
import { render } from '@react-email/render';
import type { Queue } from 'bull';
import type { ComponentProps } from 'react';
import type {
  GracePeriodEndingPayload,
  LimitReachedPayload,
  MailParams,
  NudgeInviteTeamPayload,
  NudgeNoBasePayload,
  NudgeSeatLimitPayload,
  NudgeWorkflowInactivePayload,
  OnPremLicenseIssuedPayload,
  OnPremPaymentFailedPayload,
  OnPremPlanChangedPayload,
  OnPremSubscriptionCanceledPayload,
  PaymentFailedPayload,
  PlanChangedPayload,
  SubscriptionCanceledPayload,
  SubscriptionCreatedPayload,
  TrialEndedPayload,
  TrialEndingPayload,
} from '~/interface/Mail';
import * as CloudMailTemplates from '~/mail/templates/transactional';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { MailEvent } from '~/interface/Mail';
import { MetaTable, RootScopes } from '~/utils/globals';
import Noco from '~/Noco';

type CloudTemplateComponent<K extends keyof typeof CloudMailTemplates> =
  (typeof CloudMailTemplates)[K];
type CloudTemplateProps<K extends keyof typeof CloudMailTemplates> =
  ComponentProps<CloudTemplateComponent<K>>;

const DEFERRED_MAIL_EVENTS: ReadonlySet<MailEvent> = new Set([
  MailEvent.LIMIT_REACHED,
  MailEvent.GRACE_PERIOD_ENDING,
  MailEvent.PAYMENT_FAILED,
  MailEvent.SUBSCRIPTION_CREATED,
  MailEvent.SUBSCRIPTION_CANCELED,
  MailEvent.PLAN_CHANGED,
  MailEvent.TRIAL_ENDED,
  MailEvent.TRIAL_ENDING,
  MailEvent.NUDGE_NO_BASE,
  MailEvent.NUDGE_WORKFLOW_INACTIVE,
  MailEvent.NUDGE_INVITE_TEAM,
  MailEvent.NUDGE_SEAT_LIMIT,
  MailEvent.ON_PREM_LICENSE_ISSUED,
  MailEvent.ON_PREM_PAYMENT_FAILED,
  MailEvent.ON_PREM_PLAN_CHANGED,
  MailEvent.ON_PREM_SUBSCRIPTION_CANCELED,
]);

@Injectable()
export class MailService extends MailServiceEE {
  constructor(
    // Optional — playwright / no-Redis builds don't register a Bull queue.
    // We still want the cloud MailService to load so non-deferred events
    // (Welcome, CE-fallback events) keep working; deferred events become
    // no-ops in that environment (see `sendMail` guard).
    @Optional()
    @InjectQueue(JOBS_QUEUE)
    protected readonly jobsQueue: Queue | null = null,
  ) {
    super();
  }

  async sendMail(params: MailParams, ncMeta = Noco.ncMeta) {
    if (DEFERRED_MAIL_EVENTS.has(params.mailEvent)) {
      if (!this.jobsQueue) {
        this.logger.warn(
          `Deferred mail "${params.mailEvent}" dropped — no Bull queue available`,
        );
        return false;
      }
      try {
        await this.enqueueDeferred(params, ncMeta);
        return true;
      } catch (e) {
        this.logger.error(
          'Failed to enqueue deferred mail',
          (e as Error).stack,
        );
        return false;
      }
    }

    // Cloud-specific WELCOME template — replaces the plain CE version with
    // doc-linked onboarding. Synchronous (not deferred): fired once at signup.
    if (params.mailEvent === MailEvent.WELCOME) {
      return this.sendCloudWelcome(params, ncMeta);
    }

    return super.sendMail(params, ncMeta);
  }

  protected async sendCloudWelcome(
    params: MailParams,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const mailerAdapter = await this.getAdapter(ncMeta);
    if (!mailerAdapter) {
      this.logger.error('Email Plugin not configured / active');
      return false;
    }
    if (!(await this.ensurePublicUrl(ncMeta))) return false;

    const { user, req } = (params as any).payload;

    try {
      await this.dispatchAndLog(mailerAdapter, ncMeta, {
        event: params.mailEvent,
        fk_user_id: user.id,
        to: user.email,
        subject: 'Welcome to NocoDB',
        html: await this.renderCloudMail('Welcome', {
          email: user.email,
          link: this.buildUrl(req, {}),
        }),
      });
      return true;
    } catch (e) {
      this.logger.error(
        'Failed to send cloud Welcome mail',
        (e as Error).stack,
      );
      return false;
    }
  }

  /**
   * Insert a `pending` row in `nc_mail_sends` and enqueue a `MailDispatch` job.
   *
   * Dedupe via the `dedupe_key` partial unique index (PG only) — a duplicate
   * for the same (event, dedupe_key) is treated as already-enqueued and the
   * caller does not re-fire.
   */
  protected async enqueueDeferred(params: MailParams, ncMeta = Noco.ncMeta) {
    const { event, fk_user_id, to, dedupe_key, payload } =
      this.buildOutboxRow(params);

    if (!to) {
      this.logger.warn(
        `enqueueDeferred: no recipient for event ${event}; skipping`,
      );
      return;
    }

    let mailSendId: string | undefined;
    try {
      const row = await ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.MAIL_SENDS,
        {
          event,
          fk_user_id: fk_user_id ?? null,
          to_email: to,
          subject: null,
          status: 'pending',
          dedupe_key: dedupe_key ?? null,
          payload_json: payload ? JSON.stringify(payload) : null,
          attempts: 0,
        },
      );
      mailSendId = row?.id;
    } catch (e) {
      const message = String((e as Error)?.message ?? '');
      // Partial unique on (event, dedupe_key) — treat as already-queued.
      if (
        dedupe_key &&
        (message.includes('nc_mail_sends_dedupe_uq') ||
          message.includes('duplicate key value'))
      ) {
        this.logger.log(
          `enqueueDeferred: duplicate ${event} (${dedupe_key}) — skipping`,
        );
        return;
      }
      throw e;
    }

    if (!mailSendId) return;

    await this.jobsQueue.add(
      { jobName: JobTypes.MailDispatch, mailSendId },
      { removeOnComplete: true, removeOnFail: 100, attempts: 1 },
    );
  }

  /**
   * Public entry used by `MailDispatchProcessor` and `MailOutboxRecovery`.
   *
   * Atomically claims a `pending` row (status → `sending`), then renders and
   * sends. Returns boolean for caller logging; rethrows nothing — internal
   * errors are persisted on the row.
   */
  async dispatchPending(
    mailSendId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<boolean> {
    const claimed = await this.claimMailSend(mailSendId, ncMeta);
    if (!claimed) {
      return false;
    }

    const mailerAdapter = await this.getAdapter(ncMeta);
    if (!mailerAdapter) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        error: 'Email Plugin not configured / active',
      });
      return false;
    }

    if (!(await this.ensurePublicUrl(ncMeta))) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        error: 'NC_SITE_URL is not configured',
      });
      return false;
    }

    let payload: any;
    try {
      payload = claimed.payload_json ? JSON.parse(claimed.payload_json) : null;
    } catch (e) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        error: `payload_json parse error: ${(e as Error).message}`,
      });
      return false;
    }

    let rendered: { subject: string; html: string } | null = null;
    try {
      rendered = await this.renderDeferred(claimed.event as MailEvent, payload);
    } catch (e) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        error: `render error: ${(e as Error).message}`.slice(0, 8000),
      });
      return false;
    }

    if (!rendered) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        error: `unknown deferred event ${claimed.event}`,
      });
      return false;
    }

    try {
      const result = await mailerAdapter.mailSend({
        to: claimed.to_email,
        subject: rendered.subject,
        html: rendered.html,
      });
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'sent',
        subject: rendered.subject,
        sesMessageId: (result as any)?.MessageId ?? null,
      });
      return true;
    } catch (e) {
      await this.finalizeMailSend(mailSendId, ncMeta, {
        status: 'failed',
        subject: rendered.subject,
        error: String((e as Error)?.message ?? e).slice(0, 8000),
      });
      return false;
    }
  }

  protected buildOutboxRow(params: MailParams): {
    event: MailEvent;
    fk_user_id?: string | null;
    to: string | null;
    dedupe_key: string | null;
    payload: any;
  } {
    switch (params.mailEvent) {
      case MailEvent.LIMIT_REACHED: {
        const p = params.payload as LimitReachedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `${p.workspace.id}:${p.limitType}:${this.dayBucket(
            p.gracePeriodStartAt,
          )}`,
          payload: p,
        };
      }
      case MailEvent.GRACE_PERIOD_ENDING: {
        const p = params.payload as GracePeriodEndingPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `${p.workspace.id}:${p.limitType}:${this.dayBucket(
            new Date().toISOString(),
          )}:${p.daysRemaining}`,
          payload: p,
        };
      }
      case MailEvent.PAYMENT_FAILED: {
        const p = params.payload as PaymentFailedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `invoice:${p.invoiceId}:attempt:${p.attemptCount}`,
          payload: p,
        };
      }
      case MailEvent.SUBSCRIPTION_CREATED: {
        const p = params.payload as SubscriptionCreatedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `sub-create:${p.subscriptionId}`,
          payload: p,
        };
      }
      case MailEvent.SUBSCRIPTION_CANCELED: {
        const p = params.payload as SubscriptionCanceledPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `sub-cancel:${p.subscriptionId}`,
          payload: p,
        };
      }
      case MailEvent.PLAN_CHANGED: {
        const p = params.payload as PlanChangedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `plan-change:${p.subscriptionId}:${p.newPriceId}`,
          payload: p,
        };
      }
      case MailEvent.TRIAL_ENDED: {
        const p = params.payload as TrialEndedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `trial-end:${p.subscriptionId}`,
          payload: p,
        };
      }
      case MailEvent.TRIAL_ENDING: {
        const p = params.payload as TrialEndingPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `trial-ending:${p.subscriptionId}:days:${p.daysRemaining}`,
          payload: p,
        };
      }
      case MailEvent.NUDGE_NO_BASE:
      case MailEvent.NUDGE_WORKFLOW_INACTIVE:
      case MailEvent.NUDGE_INVITE_TEAM:
      case MailEvent.NUDGE_SEAT_LIMIT: {
        // Once-ever per user per event. Cross-nudge throttle (max 1 per 7d)
        // is enforced upstream at the check layer before this code runs.
        const p = params.payload as NudgeNoBasePayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: p.user?.id ? `user:${p.user.id}` : null,
          payload: p,
        };
      }
      case MailEvent.ON_PREM_LICENSE_ISSUED: {
        const p = params.payload as OnPremLicenseIssuedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `license-issued:${p.subscriptionId}`,
          payload: p,
        };
      }
      case MailEvent.ON_PREM_PAYMENT_FAILED: {
        const p = params.payload as OnPremPaymentFailedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `on-prem-invoice:${p.invoiceId}:attempt:${p.attemptCount}`,
          payload: p,
        };
      }
      case MailEvent.ON_PREM_PLAN_CHANGED: {
        const p = params.payload as OnPremPlanChangedPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          dedupe_key: `on-prem-plan-change:${p.subscriptionId}:${p.newPlanTitle}`,
          payload: p,
        };
      }
      case MailEvent.ON_PREM_SUBSCRIPTION_CANCELED: {
        const p = params.payload as OnPremSubscriptionCanceledPayload;
        return {
          event: params.mailEvent,
          fk_user_id: p.user?.id ?? null,
          to: p.user?.email ?? null,
          // stripeStatus suffix lets a canceled→reactivated→canceled cycle
          // re-send as two events instead of collapsing to one.
          dedupe_key: `on-prem-sub-cancel:${p.subscriptionId}:${p.stripeStatus}`,
          payload: p,
        };
      }
      default:
        return {
          event: params.mailEvent,
          fk_user_id: null,
          to: null,
          dedupe_key: null,
          payload: null,
        };
    }
  }

  protected dayBucket(iso: string): string {
    return new Date(iso).toISOString().slice(0, 10);
  }

  protected async renderCloudMail<K extends keyof typeof CloudMailTemplates>(
    template: K,
    props: CloudTemplateProps<K>,
  ) {
    const Component = CloudMailTemplates[template];
    return await render(Component(props as CloudTemplateProps<any>));
  }

  protected async renderDeferred(
    event: MailEvent,
    payload: any,
  ): Promise<{ subject: string; html: string } | null> {
    switch (event) {
      case MailEvent.LIMIT_REACHED: {
        const p = payload as LimitReachedPayload;
        return {
          subject: `Your workspace "${p.workspace.title}" has hit a plan limit`,
          html: await this.renderCloudMail('LimitReached', {
            workspaceTitle: p.workspace.title,
            limitLabel: this.humanizeLimit(p.limitType),
            currentUsage: p.currentUsage,
            limitValue: p.limitValue,
            gracePeriodEndsAt: this.formatDate(p.gracePeriodEndsAt),
            upgradeUrl: p.upgradeUrl,
          }),
        };
      }
      case MailEvent.GRACE_PERIOD_ENDING: {
        const p = payload as GracePeriodEndingPayload;
        return {
          subject: `Grace period ending soon for "${p.workspace.title}"`,
          html: await this.renderCloudMail('GracePeriodEnding', {
            workspaceTitle: p.workspace.title,
            limitLabel: this.humanizeLimit(p.limitType),
            currentUsage: p.currentUsage,
            limitValue: p.limitValue,
            daysRemaining: p.daysRemaining,
            gracePeriodEndsAt: this.formatDate(p.gracePeriodEndsAt),
            upgradeUrl: p.upgradeUrl,
          }),
        };
      }
      case MailEvent.PAYMENT_FAILED: {
        const p = payload as PaymentFailedPayload;
        return {
          subject: `Action required: payment failed for "${p.workspace.title}"`,
          html: await this.renderCloudMail('PaymentFailed', {
            workspaceTitle: p.workspace.title,
            amountDue: this.formatMoney(p.amountDue, p.currency),
            attemptCount: p.attemptCount,
            nextAttemptAt: p.nextAttemptAt
              ? this.formatDate(p.nextAttemptAt)
              : undefined,
            failureMessage: p.failureMessage,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.SUBSCRIPTION_CREATED: {
        const p = payload as SubscriptionCreatedPayload;
        return {
          subject: p.isTrial
            ? `Trial active for "${p.workspace.title}"`
            : `Welcome to ${p.planTitle} — ${p.workspace.title}`,
          html: await this.renderCloudMail('SubscriptionCreated', {
            workspaceTitle: p.workspace.title,
            planTitle: p.planTitle,
            seatCount: p.seatCount,
            periodEnd: p.periodEnd ? this.formatDate(p.periodEnd) : undefined,
            isTrial: p.isTrial,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.SUBSCRIPTION_CANCELED: {
        const p = payload as SubscriptionCanceledPayload;
        return {
          subject: `Subscription canceled for "${p.workspace.title}"`,
          html: await this.renderCloudMail('SubscriptionCanceled', {
            workspaceTitle: p.workspace.title,
            planTitle: p.planTitle,
            endsAt: p.cancelAt
              ? this.formatDate(p.cancelAt)
              : p.periodEnd
              ? this.formatDate(p.periodEnd)
              : undefined,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.PLAN_CHANGED: {
        const p = payload as PlanChangedPayload;
        return {
          subject: `Plan changed for "${p.workspace.title}"`,
          html: await this.renderCloudMail('PlanChanged', {
            workspaceTitle: p.workspace.title,
            oldPlanTitle: p.oldPlanTitle,
            newPlanTitle: p.newPlanTitle,
            effectiveAt: p.effectiveAt
              ? this.formatDate(p.effectiveAt)
              : undefined,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.TRIAL_ENDED: {
        const p = payload as TrialEndedPayload;
        return {
          subject: `Your trial has ended — "${p.workspace.title}"`,
          html: await this.renderCloudMail('TrialEnded', {
            workspaceTitle: p.workspace.title,
            planTitle: p.planTitle,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.TRIAL_ENDING: {
        const p = payload as TrialEndingPayload;
        return {
          subject: `Your ${p.planTitle} trial ends in ${p.daysRemaining} day${
            p.daysRemaining === 1 ? '' : 's'
          } — "${p.workspace.title}"`,
          html: await this.renderCloudMail('TrialEnding', {
            workspaceTitle: p.workspace.title,
            planTitle: p.planTitle,
            daysRemaining: p.daysRemaining,
            trialEndsAt: this.formatDate(p.trialEndsAt),
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.NUDGE_NO_BASE: {
        const p = payload as NudgeNoBasePayload;
        return {
          subject: `Create your first base in ${p.workspace.title}`,
          html: await this.renderCloudMail('NudgeNoBase', {
            workspaceTitle: p.workspace.title,
            createBaseUrl: p.createBaseUrl,
          }),
        };
      }
      case MailEvent.NUDGE_WORKFLOW_INACTIVE: {
        const p = payload as NudgeWorkflowInactivePayload;
        return {
          subject: `Your workflow "${p.workflow.title}" isn't running yet`,
          html: await this.renderCloudMail('NudgeWorkflowInactive', {
            workspaceTitle: p.workspace.title,
            workflowTitle: p.workflow.title,
            workflowUrl: p.workflowUrl,
          }),
        };
      }
      case MailEvent.NUDGE_INVITE_TEAM: {
        const p = payload as NudgeInviteTeamPayload;
        return {
          subject: `Invite your team to ${p.workspace.title}`,
          html: await this.renderCloudMail('NudgeInviteTeam', {
            workspaceTitle: p.workspace.title,
            inviteUrl: p.inviteUrl,
          }),
        };
      }
      case MailEvent.NUDGE_SEAT_LIMIT: {
        const p = payload as NudgeSeatLimitPayload;
        return {
          subject: `You've used all ${p.editorLimit} editor seats on "${p.workspace.title}"`,
          html: await this.renderCloudMail('NudgeSeatLimit', {
            workspaceTitle: p.workspace.title,
            currentEditors: p.currentEditors,
            editorLimit: p.editorLimit,
            inviteUrl: p.inviteUrl,
            upgradeUrl: p.upgradeUrl,
          }),
        };
      }
      case MailEvent.ON_PREM_LICENSE_ISSUED: {
        const p = payload as OnPremLicenseIssuedPayload;
        return {
          subject: `Your NocoDB ${p.planTitle} license is ready`,
          html: await this.renderCloudMail('OnPremLicenseIssued', {
            licensedTo: p.installation.licensed_to,
            licenseKey: p.licenseKey,
            planTitle: p.planTitle,
            seatCount: p.seatCount,
            period: p.period,
            periodEnd: p.periodEnd ? this.formatDate(p.periodEnd) : undefined,
            activationDocsUrl: p.activationDocsUrl,
            setupDocsUrl: p.setupDocsUrl,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.ON_PREM_PAYMENT_FAILED: {
        const p = payload as OnPremPaymentFailedPayload;
        return {
          subject: 'NocoDB on-premise license — payment verification needed',
          html: await this.renderCloudMail('OnPremPaymentFailed', {
            licensedTo: p.installation.licensed_to,
            planTitle: this.humanizeLicenseType(p.installation.license_type),
            invoiceLabel: p.invoiceNumber ?? p.invoiceId,
            amountDue: this.formatMoney(p.amountDue, p.currency),
            attemptCount: p.attemptCount,
            nextAttemptAt: p.nextAttemptAt
              ? this.formatDate(p.nextAttemptAt)
              : undefined,
            failureMessage: p.failureMessage,
            hostedInvoiceUrl: p.hostedInvoiceUrl,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.ON_PREM_PLAN_CHANGED: {
        const p = payload as OnPremPlanChangedPayload;
        return {
          subject: `Your NocoDB on-premise plan changed to ${p.newPlanTitle}`,
          html: await this.renderCloudMail('OnPremPlanChanged', {
            licensedTo: p.installation.licensed_to,
            oldPlanTitle: p.oldPlanTitle,
            newPlanTitle: p.newPlanTitle,
            effectiveAt: p.effectiveAt
              ? this.formatDate(p.effectiveAt)
              : undefined,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      case MailEvent.ON_PREM_SUBSCRIPTION_CANCELED: {
        const p = payload as OnPremSubscriptionCanceledPayload;
        const subject =
          p.stripeStatus === 'unpaid'
            ? 'Your NocoDB license has been suspended'
            : 'Your NocoDB on-premise subscription was canceled';
        return {
          subject,
          html: await this.renderCloudMail('OnPremSubscriptionCanceled', {
            licensedTo: p.installation.licensed_to,
            planTitle: p.planTitle,
            stripeStatus: p.stripeStatus,
            endsAt: p.endsAt ? this.formatDate(p.endsAt) : undefined,
            billingPortalUrl: p.billingPortalUrl,
          }),
        };
      }
      default:
        return null;
    }
  }

  protected humanizeLicenseType(licenseType: string): string {
    const s = String(licenseType ?? '').trim();
    if (!s) return '';
    return s
      .replace(/^self_hosted_/, 'Self-hosted ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace('Self-Hosted', 'Self-hosted');
  }

  protected formatMoney(amountMinor: number, currency: string): string {
    try {
      const major = (amountMinor ?? 0) / 100;
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: (currency ?? 'usd').toUpperCase(),
      }).format(major);
    } catch {
      return `${amountMinor} ${currency}`;
    }
  }

  protected humanizeLimit(limitType: string): string {
    return String(limitType ?? '')
      .replace(/^limit_/, '')
      .replace(/_per_workspace$/, '')
      .replace(/_/g, ' ');
  }

  protected formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  }

  /**
   * Atomically transitions `pending`/`failed` → `sending` and increments
   * `attempts` ("dispatch attempts" — counts every claim including the first
   * try, so a successful first-time send shows `attempts=1`, not 0).
   */
  protected async claimMailSend(
    mailSendId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{
    id: string;
    event: string;
    to_email: string;
    payload_json: string | null;
  } | null> {
    const updated = await ncMeta
      .knexConnection(MetaTable.MAIL_SENDS)
      .where({ id: mailSendId })
      .whereIn('status', ['pending', 'failed'])
      .update({
        status: 'sending',
        updated_at: ncMeta.now(),
        attempts: ncMeta.knexConnection.raw('?? + 1', ['attempts']),
      });

    if (!updated) {
      return null;
    }

    const row = await ncMeta
      .knexConnection(MetaTable.MAIL_SENDS)
      .where({ id: mailSendId })
      .first();

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      event: row.event,
      to_email: row.to_email,
      payload_json: row.payload_json,
    };
  }

  /**
   * Idempotent finalize. Only updates rows still in `sending` — if outbox
   * recovery has flipped the row back to `pending` and another worker has
   * already re-claimed it (status now `sending` under a fresh attempts count),
   * this becomes a no-op so we don't overwrite the new owner's state. The
   * 15-min recovery idle threshold makes this race statistically rare; the
   * predicate keeps DB state correct if it ever fires.
   */
  protected async finalizeMailSend(
    mailSendId: string,
    ncMeta: any,
    args: {
      status: 'sent' | 'failed';
      subject?: string;
      error?: string;
      sesMessageId?: string | null;
    },
  ): Promise<void> {
    try {
      await ncMeta
        .knexConnection(MetaTable.MAIL_SENDS)
        .where({ id: mailSendId })
        .andWhere('status', 'sending')
        .update({
          status: args.status,
          subject: args.subject ?? null,
          error: args.error ?? null,
          ses_message_id: args.sesMessageId ?? null,
          sent_at: args.status === 'sent' ? new Date() : null,
          updated_at: ncMeta.now(),
        });
    } catch (e) {
      this.logger.error(
        'Failed to finalize nc_mail_sends row',
        (e as Error).stack,
      );
    }
  }
}
