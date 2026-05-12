import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Stripe from 'stripe';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { MailScannerCheck } from '~/modules/jobs/mail-scanner/checks/check.interface';
import Noco from '~/Noco';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { MetaTable } from '~/utils/globals';
import { Plan, WorkspaceUser } from '~/models';
import { ncSiteUrl } from '~/utils/envs';

dayjs.extend(utc);

const TRIAL_END_WARNING_DAYS = [3, 1];
const TRIAL_END_LOOKAHEAD_DAYS = 4;

interface TrialingSubRow {
  sub_id: string;
  fk_workspace_id: string;
  fk_plan_id: string | null;
  trial_end_at: string;
  workspace_title: string;
  stripe_customer_id: string;
}

/**
 * Warns workspace owners 3 and 1 days before a trialing subscription ends
 * — but ONLY when no Stripe payment method is on file. Workspaces with a
 * card attached will auto-charge at trial end and don't need a nudge.
 *
 * One nudge per (subscription, day-window) via dedupe_key.
 */
@Injectable()
export class TrialEndingCheck implements MailScannerCheck {
  readonly name = 'trial-ending';
  private logger = new Logger(TrialEndingCheck.name);

  private readonly stripe: Stripe | null = process.env.NC_STRIPE_SECRET_KEY
    ? new Stripe(process.env.NC_STRIPE_SECRET_KEY, {
        apiVersion: '2025-05-28.basil',
      })
    : null;

  constructor(private readonly mailService: MailService) {}

  async run(): Promise<void> {
    if (!this.stripe) {
      this.logger.debug('trial-ending: NC_STRIPE_SECRET_KEY not set; skipping');
      return;
    }

    const ncMeta = Noco.ncMeta;
    const now = dayjs.utc();
    const knex = ncMeta.knexConnection;

    const maxTrialEnd = now
      .add(TRIAL_END_LOOKAHEAD_DAYS, 'day')
      .endOf('day')
      .toDate();

    const candidates: TrialingSubRow[] = await knex(
      `${MetaTable.SUBSCRIPTIONS} as s`,
    )
      .innerJoin(`${MetaTable.WORKSPACE} as w`, function () {
        this.on('w.id', 's.fk_workspace_id').andOn(
          knex.raw('(w.deleted IS NULL OR w.deleted = ?)', [false]),
        );
      })
      .where('s.status', 'trialing')
      .whereNotNull('s.trial_end_at')
      .andWhere('s.trial_end_at', '>', now.toDate())
      .andWhere('s.trial_end_at', '<=', maxTrialEnd)
      .whereNull('s.canceled_at')
      .whereNotNull('w.stripe_customer_id')
      .select(
        's.id as sub_id',
        's.fk_workspace_id as fk_workspace_id',
        's.fk_plan_id as fk_plan_id',
        's.trial_end_at as trial_end_at',
        'w.title as workspace_title',
        'w.stripe_customer_id as stripe_customer_id',
      );

    if (!candidates.length) {
      this.logger.debug('trial-ending: no candidates');
      return;
    }

    const baseUrl = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';

    for (const sub of candidates) {
      const trialEnd = dayjs.utc(sub.trial_end_at);
      const daysRemaining = trialEnd
        .startOf('day')
        .diff(now.startOf('day'), 'day');

      if (!TRIAL_END_WARNING_DAYS.includes(daysRemaining)) continue;

      try {
        if (await this.hasPaymentMethod(sub.stripe_customer_id)) {
          continue;
        }
      } catch (e) {
        this.logger.warn(
          `trial-ending: payment-method lookup failed for ${
            sub.stripe_customer_id
          }: ${(e as Error).message}`,
        );
        continue;
      }

      try {
        await this.notifyForTrialEnding(sub, daysRemaining, baseUrl);
      } catch (e) {
        this.logger.error(
          `trial-ending: send failed for sub ${sub.sub_id}`,
          (e as Error).stack,
        );
      }
    }
  }

  /**
   * Returns true if the Stripe customer has any usable payment method (either
   * `invoice_settings.default_payment_method` or a legacy `default_source`).
   */
  protected async hasPaymentMethod(customerId: string): Promise<boolean> {
    if (!this.stripe) return false;

    const customer = await this.stripe.customers.retrieve(customerId);
    if (!customer || (customer as Stripe.DeletedCustomer).deleted) {
      return false;
    }
    const c = customer as Stripe.Customer;
    if (c.invoice_settings?.default_payment_method) return true;
    if (c.default_source) return true;
    return false;
  }

  protected async notifyForTrialEnding(
    sub: TrialingSubRow,
    daysRemaining: number,
    baseUrl: string,
  ): Promise<void> {
    const owners = await WorkspaceUser.userList(
      { fk_workspace_id: sub.fk_workspace_id, roles: WorkspaceUserRoles.OWNER },
      Noco.ncMeta,
    );
    if (!owners.length) {
      this.logger.warn(
        `trial-ending: workspace ${sub.fk_workspace_id} has no owner; skipping`,
      );
      return;
    }

    const planTitle = await this.resolvePlanTitle(sub.fk_plan_id);
    const billingPortalUrl = baseUrl
      ? `${baseUrl}/${sub.fk_workspace_id}/settings?tab=billing`
      : '';

    for (const owner of owners) {
      if (!owner?.email) continue;

      await this.mailService.sendMail({
        mailEvent: MailEvent.TRIAL_ENDING,
        payload: {
          user: {
            id: owner.id,
            email: owner.email,
            display_name: owner.display_name,
          } as any,
          workspace: {
            id: sub.fk_workspace_id,
            title: sub.workspace_title,
          },
          subscriptionId: sub.sub_id,
          planTitle,
          daysRemaining,
          trialEndsAt: dayjs.utc(sub.trial_end_at).toISOString(),
          billingPortalUrl,
        },
      } as any);
    }
  }

  protected async resolvePlanTitle(
    planId: string | null | undefined,
  ): Promise<string> {
    if (!planId) return 'your trial';
    try {
      const plan = await Plan.get(planId);
      return plan?.title ?? 'your trial';
    } catch {
      return 'your trial';
    }
  }
}
