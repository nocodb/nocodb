import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { MailService as MailServiceEE } from 'src/ee/services/mail/mail.service';
import { render } from '@react-email/render';
import { Queue } from 'bull';
import type { ComponentProps } from 'react';
import type { LimitReachedPayload, MailParams } from '~/interface/Mail';
import type { GracePeriodEndingPayload } from '~/ee/interface/Mail';
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
]);

@Injectable()
export class MailService extends MailServiceEE {
  constructor(@InjectQueue(JOBS_QUEUE) protected readonly jobsQueue: Queue) {
    super();
  }

  async sendMail(params: MailParams, ncMeta = Noco.ncMeta) {
    if (DEFERRED_MAIL_EVENTS.has(params.mailEvent)) {
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

    return super.sendMail(params, ncMeta);
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
      default:
        return null;
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
