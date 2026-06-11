import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { customAlphabet } from 'nanoid';
import { OnPremPlanTitles, ReturnToBillingPage } from 'nocodb-sdk';
import type { PlanAddonTypes } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import type { MailParams } from '~/interface/Mail';
import { Plan, Subscription, SubscriptionAddon, User } from '~/models';
import Installation from '~/models/Installation';
import { NcError } from '~/helpers/catchError';
import {
  buildSeatSyncItems,
  getBaseSubscriptionItem,
} from '~/helpers/paymentHelpers';
import Noco from '~/Noco';
import { InstallationStatus, LicenseType } from '~/utils/license';
import { TelemetryService } from '~/services/telemetry.service';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { ncSiteUrl } from '~/utils/envs';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder', {
  apiVersion: '2025-05-28.basil',
});

/**
 * Maps on-prem plan titles to license types
 */
const PLAN_TO_LICENSE_TYPE: Record<string, LicenseType> = {
  [OnPremPlanTitles.SELF_HOSTED_BUSINESS]: LicenseType.SELF_HOSTED_BUSINESS,
  [OnPremPlanTitles.SELF_HOSTED_SCALE]: LicenseType.SELF_HOSTED_SCALE,
  [OnPremPlanTitles.SELF_HOSTED_ENTERPRISE]: LicenseType.SELF_HOSTED_ENTERPRISE,
};

/**
 * Builds license config from a plan's metadata.
 * Always includes plan_title so on-prem can select the correct base plan.
 */
function buildConfigFromPlan(
  plan: Plan,
  subscription?: { meta?: { plan_meta?: Record<string, any> } },
  addonKeys?: PlanAddonTypes[],
): Record<string, any> {
  const config: Record<string, any> = {
    plan_title: plan.title,
  };

  if (plan.meta && Object.keys(plan.meta).length > 0) {
    Object.assign(config, plan.meta);
  }

  // Per-subscription overrides (addons, custom limits)
  if (subscription?.meta?.plan_meta) {
    Object.assign(config, subscription.meta.plan_meta);
  }

  // Structured add-on entitlements — consumed on-prem by applyAddons(config.addons).
  if (addonKeys?.length) {
    config.addons = addonKeys;
  }

  return config;
}

function maskLicenseKey(key: string): string {
  if (!key) return '';
  return `${key.slice(0, 6)}***${key.slice(-4)}`;
}

// Alphanumeric-only generator — avoids `_` / `-` from the default nanoid
// alphabet so license keys are easy to copy/paste and select in terminals.
// 32 chars × 62 symbols ≈ 190 bits of entropy.
const generateLicenseKeySuffix = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  32,
);

@Injectable()
export class OnPremLicenseService {
  protected logger = new Logger(OnPremLicenseService.name);

  constructor(
    protected readonly telemetryService: TelemetryService,
    protected readonly mailService: MailService,
  ) {}

  /**
   * Best-effort enqueue of an on-prem billing mail. Mirrors PaymentService's
   * `safeSendBillingMail` — never throws so webhook handlers stay idempotent.
   */
  protected async safeSendOnPremMail(params: MailParams): Promise<void> {
    try {
      await this.mailService.sendMail(params);
    } catch (e) {
      this.logger.error(
        `Failed to enqueue ${params.mailEvent} mail`,
        (e as Error).stack,
      );
    }
  }

  protected onPremBillingPortalUrl(): string {
    const base = ncSiteUrl ?? Noco.config?.ncSiteUrl ?? '';
    return base ? `${base}/account/self-hosted` : '';
  }

  /**
   * Emit a system event for an on-prem flow with first-class identity fields.
   * At least one of `installation`, `subscription`, or `plan` MUST be set —
   * the Lambda renderer detects on-prem events by their presence.
   *
   * Distinct from the cloud-side pattern of calling `sendSystemEvent` inline
   * with a hand-rolled `extra: { ... }` blob; this helper is the canonical
   * entry point for all on-prem payment alerts so the wire payload stays
   * uniform.
   */
  private async emitOnPremAlert(args: {
    payment_type: string;
    message: string;
    user?: { id?: string; email?: string };
    installation?: { id: string; license_type?: string };
    subscription?: { id: string; stripe_subscription_id?: string };
    plan?: { id?: string; title?: string };
    extra?: Record<string, any>;
  }): Promise<void> {
    if (!args.installation && !args.subscription && !args.plan) {
      this.logger.warn(
        `emitOnPremAlert called for ${args.payment_type} without any identity field — dropping`,
      );
      return;
    }
    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: args.payment_type,
      message: args.message,
      ...(args.user ? { user: args.user } : {}),
      ...(args.installation ? { installation: args.installation } : {}),
      ...(args.subscription ? { subscription: args.subscription } : {}),
      ...(args.plan ? { plan: args.plan } : {}),
      ...(args.extra ? { extra: args.extra } : {}),
    });
  }

  /**
   * Generate a unique license key for a new on-prem installation
   */
  private generateLicenseKey(): string {
    return `nc_${generateLicenseKeySuffix()}`;
  }

  /**
   * Get or create a Stripe customer for on-prem purchases (stored on User model)
   */
  private async getOrCreateStripeCustomer(
    user: User,
    ncMeta = Noco.ncMeta,
  ): Promise<string> {
    if (user.stripe_customer_id) {
      // Verify the customer still exists in Stripe
      try {
        const customer = await stripe.customers.retrieve(
          user.stripe_customer_id,
        );
        if (!customer.deleted) {
          return user.stripe_customer_id;
        }
      } catch {
        // Customer not found, will create new one
      }
    }

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        fk_user_id: user.id,
        entity: `user_${user.id}`,
        type: 'on_prem',
      },
    });

    await User.update(user.id, { stripe_customer_id: customer.id }, ncMeta);

    return customer.id;
  }

  /**
   * Create a Stripe checkout session for purchasing an on-prem license
   */
  async createCheckoutSession(
    payload: {
      plan_id: string;
      price_id: string;
      quantity?: number;
      instance_url?: string;
      instance_id?: string;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const { plan_id, price_id, instance_url, instance_id } = payload;
    const { user } = req;

    if (!plan_id || !price_id) {
      NcError.badRequest('Plan ID and Price ID are required');
    }

    // Validate instance_url if provided — must be a valid HTTP(S) URL
    if (instance_url) {
      try {
        const url = new URL(instance_url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          NcError.badRequest('Instance URL must use HTTP or HTTPS');
        }
      } catch {
        NcError.badRequest('Invalid instance URL');
      }
    }

    const plan = await Plan.get(plan_id, ncMeta);

    if (!plan) {
      NcError.genericNotFound('Plan', plan_id);
    }

    if (!plan.is_active) {
      NcError.badRequest('Plan is not available');
    }

    const licenseType = PLAN_TO_LICENSE_TYPE[plan.title];
    if (!licenseType) {
      NcError.badRequest('Invalid plan for on-premise license');
    }

    // Per-plan seat floor. Scale is sold with a minimum commitment of 3 seats;
    // other plans have no minimum (effective floor = 1).
    const minSeats = plan.title === OnPremPlanTitles.SELF_HOSTED_SCALE ? 3 : 1;
    const seats = Math.max(minSeats, Math.floor(payload.quantity || 1));

    const price = plan.prices.find((p) => p.id === price_id);
    if (!price) {
      NcError.genericNotFound('Price', price_id);
    }

    const fullUser = await User.get(user.id, ncMeta);
    if (!fullUser) {
      NcError.genericNotFound('User', user.id);
    }

    const customerId = await this.getOrCreateStripeCustomer(fullUser, ncMeta);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: price.id,
          quantity: seats,
        },
      ],
      ui_mode: 'embedded',
      return_url: `${req.ncSiteUrl}/?afterPayment=true&returnToPage=${
        ReturnToBillingPage.SELF_HOSTED
      }&session_id={CHECKOUT_SESSION_ID}${
        instance_url ? `&instance_url=${encodeURIComponent(instance_url)}` : ''
      }`,
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: 'required',
      customer: customerId,
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      tax_id_collection: {
        enabled: true,
      },
      allow_promotion_codes: true,
      subscription_data: {
        metadata: {
          on_prem: 'true',
          fk_user_id: user.id,
          fk_plan_id: plan_id,
          plan_title: plan.title,
          period: price.recurring.interval,
          // Floor used by reseat. Per-plan: 3 for Scale (commitment), 1 for
          // Business and any other plan so reductions in instance editor count
          // get prorated down to the floor.
          min_seats: String(minSeats),
          ...(instance_url ? { instance_url } : {}),
          ...(instance_id ? { instance_id } : {}),
        },
      },
    });

    await this.emitOnPremAlert({
      payment_type: 'on_prem_checkout_initiated',
      message: `On-prem license checkout initiated (${plan.title})`,
      user: { id: user.id, email: user.email },
      plan: { id: plan_id, title: plan.title },
      extra: {
        checkout_session_id: session.id,
        price_id,
        period: price.recurring.interval,
      },
    });

    return session;
  }

  /**
   * Handle subscription creation webhook for on-prem licenses.
   * Called from PaymentService.handleWebhook when metadata.on_prem === 'true'.
   */
  async handleSubscriptionCreated(
    stripeSub: Stripe.Subscription,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const planId = stripeSub.metadata.fk_plan_id;
    const userId = stripeSub.metadata.fk_user_id;
    const planTitle = stripeSub.metadata.plan_title;

    if (!userId || !planId) {
      this.logger.error(
        `On-prem subscription webhook missing required metadata: fk_user_id=${userId}, fk_plan_id=${planId}, stripe_sub=${stripeSub.id}`,
      );
      // No local Subscription row exists at this point in the webhook —
      // surface the Stripe sub id in both `id` and `stripe_subscription_id`.
      await this.emitOnPremAlert({
        payment_type: 'on_prem_webhook_error',
        message: `On-prem subscription created webhook missing metadata (stripe_sub: ${stripeSub.id})`,
        subscription: {
          id: stripeSub.id,
          stripe_subscription_id: stripeSub.id,
        },
        extra: {
          metadata: stripeSub.metadata,
          reason: 'missing_required_metadata',
        },
      });
      return;
    }

    const plan = await Plan.get(planId, ncMeta);
    if (!plan) {
      this.logger.error(`Plan not found: ${planId}`);
      // No local Subscription row exists at this point in the webhook —
      // surface the Stripe sub id in both `id` and `stripe_subscription_id`.
      await this.emitOnPremAlert({
        payment_type: 'on_prem_webhook_error',
        message: `On-prem subscription created but plan not found: ${planId}`,
        subscription: {
          id: stripeSub.id,
          stripe_subscription_id: stripeSub.id,
        },
        plan: { id: planId },
        extra: { reason: 'plan_not_found' },
      });
      return;
    }

    const licenseType = PLAN_TO_LICENSE_TYPE[planTitle];
    if (!licenseType) {
      this.logger.error(`Invalid plan title for on-prem: ${planTitle}`);
      return;
    }

    // No add-ons at creation: the Subscription row (and thus any SubscriptionAddon
    // rows keyed by it) doesn't exist yet — they're attached later via grantAddon,
    // which calls syncInstallationAddons to refresh this config.
    const config = buildConfigFromPlan(plan);
    const baseItem = await getBaseSubscriptionItem(stripeSub, null, ncMeta);
    const price = baseItem.price;
    const period = price.recurring.interval;

    // Read min_seats from metadata (fallback: Stripe item quantity, then 1)
    const minSeats = stripeSub.metadata.min_seats
      ? parseInt(stripeSub.metadata.min_seats, 10)
      : baseItem.quantity || 1;

    // Create Subscription record (no workspace/org, just user)
    const stripeQuantity = Math.max(minSeats, baseItem.quantity || 1);
    const subRec = await Subscription.insert({
      fk_user_id: userId,
      fk_workspace_id: null,
      fk_org_id: null,
      fk_plan_id: planId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: price.id,
      seat_count: stripeQuantity,
      last_paid_seat_count: stripeQuantity,
      status: stripeSub.status,
      start_at: new Date(stripeSub.start_date * 1000).toISOString(),
      period,
      billing_cycle_anchor: new Date(
        stripeSub.billing_cycle_anchor * 1000,
      ).toISOString(),
    });

    // Generate license key and create Installation
    const licenseKey = this.generateLicenseKey();
    const user = await User.get(userId, ncMeta);

    // Pre-bind license to originating instance when available — first
    // activation (and all subsequent ones) must come from this instance_id.
    const preBoundInstanceId = stripeSub.metadata.instance_id;
    const originatingInstanceUrl = stripeSub.metadata.instance_url;
    const installationMeta: Record<string, any> = {};
    if (preBoundInstanceId) {
      installationMeta.instance_id = preBoundInstanceId;
    }
    if (originatingInstanceUrl) {
      installationMeta.instance_url = originatingInstanceUrl;
    }

    const installation = await Installation.insert(
      {
        fk_subscription_id: subRec.id,
        fk_user_id: userId,
        licensed_to: user?.email || 'Self-Serve',
        license_key: licenseKey,
        license_type: licenseType,
        status: InstallationStatus.PENDING,
        seat_count: 0,
        min_seats: minSeats,
        config,
        ...(Object.keys(installationMeta).length
          ? { meta: installationMeta }
          : {}),
      },
      ncMeta,
    );

    await this.emitOnPremAlert({
      payment_type: 'on_prem_license_created',
      message: `On-prem license created (${planTitle}) for ${user?.email}`,
      user: { id: userId, email: user?.email },
      installation: { id: installation.id, license_type: licenseType },
      subscription: { id: subRec.id, stripe_subscription_id: stripeSub.id },
      plan: { id: planId, title: planTitle },
      extra: { period },
    });

    if (user?.email) {
      const currentPeriodEnd = (
        stripeSub as Stripe.Subscription & {
          current_period_end?: number;
        }
      ).current_period_end;
      await this.safeSendOnPremMail({
        mailEvent: MailEvent.ON_PREM_LICENSE_ISSUED,
        payload: {
          user: user as any,
          installation: {
            id: installation.id,
            license_type: licenseType,
            licensed_to: installation.licensed_to,
          },
          subscriptionId: subRec.id,
          licenseKey,
          planTitle,
          seatCount: stripeQuantity,
          period: period as 'month' | 'year',
          periodEnd: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : undefined,
          activationDocsUrl:
            'https://nocodb.com/docs/self-hosting/license-activation',
          setupDocsUrl: 'https://nocodb.com/docs/self-hosting',
          billingPortalUrl: this.onPremBillingPortalUrl(),
        },
      });
    }

    this.logger.log(
      `On-prem license created: ${installation.id} (${planTitle}) for user ${userId}`,
    );
  }

  /**
   * Handle subscription update/deletion for on-prem licenses.
   * Looks up via Stripe subscription ID → our Subscription record → Installation.
   */
  async handleSubscriptionUpdated(
    stripeSub: Stripe.Subscription,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    // Find our Subscription record via Stripe subscription ID
    const subRec = await Subscription.getByStripeSubscriptionId(
      stripeSub.id,
      ncMeta,
    );
    if (!subRec) {
      this.logger.warn(
        `On-prem subscription update: no Subscription record found for stripe_sub=${stripeSub.id}`,
      );
      return;
    }

    const previousPlanId = subRec.fk_plan_id;

    // Check if plan changed and update Subscription + Installation config
    const newPlanId = stripeSub.metadata?.fk_plan_id;
    if (newPlanId && newPlanId !== previousPlanId) {
      const newPlan = await Plan.get(newPlanId, ncMeta);
      if (newPlan) {
        const previousPlan = previousPlanId
          ? await Plan.get(previousPlanId, ncMeta).catch(() => null)
          : null;

        await Subscription.update(
          subRec.id,
          { fk_plan_id: newPlanId, status: stripeSub.status },
          ncMeta,
        );

        // Update Installation config with new plan metadata
        const inst = await Installation.getBySubscriptionId(subRec.id, ncMeta);
        if (inst) {
          const addonKeys = await SubscriptionAddon.listActiveKeys(
            subRec.id,
            ncMeta,
          );
          const newConfig = buildConfigFromPlan(newPlan, undefined, addonKeys);
          const newLicenseType =
            PLAN_TO_LICENSE_TYPE[newPlan.title] || inst.license_type;

          await Installation.update(
            inst.id,
            { config: newConfig, license_type: newLicenseType },
            ncMeta,
          );

          this.logger.log(
            `On-prem installation ${inst.id} config updated for plan change to ${newPlan.title}`,
          );

          await this.emitOnPremAlert({
            payment_type: 'on_prem_plan_changed',
            message: `On-prem installation ${inst.id} plan changed: ${
              previousPlan?.title || 'unknown'
            } → ${newPlan.title}`,
            installation: { id: inst.id, license_type: newLicenseType },
            subscription: {
              id: subRec.id,
              stripe_subscription_id: stripeSub.id,
            },
            plan: { id: newPlan.id, title: newPlan.title },
            extra: {
              previous_plan_id: previousPlanId,
              previous_plan_title: previousPlan?.title,
              new_plan_id: newPlanId,
            },
          });

          const planUser = subRec.fk_user_id
            ? await User.get(subRec.fk_user_id, ncMeta).catch(() => null)
            : null;
          if (planUser?.email) {
            await this.safeSendOnPremMail({
              mailEvent: MailEvent.ON_PREM_PLAN_CHANGED,
              payload: {
                user: planUser as any,
                installation: {
                  id: inst.id,
                  license_type: newLicenseType,
                  licensed_to: inst.licensed_to,
                },
                subscriptionId: subRec.id,
                oldPlanTitle: previousPlan?.title || 'previous plan',
                newPlanTitle: newPlan.title,
                effectiveAt: new Date().toISOString(),
                billingPortalUrl: this.onPremBillingPortalUrl(),
              },
            });
          }
        }
      }
    }

    // Update our Subscription record status to match Stripe
    if (subRec.status !== stripeSub.status) {
      await Subscription.update(
        subRec.id,
        {
          status: stripeSub.status,
        },
        ncMeta,
      );
    }

    // Find the Installation linked to this subscription
    const installation = await Installation.getBySubscriptionId(
      subRec.id,
      ncMeta,
    );
    if (!installation) {
      this.logger.warn(
        `On-prem subscription update: no Installation found for subscription=${subRec.id}`,
      );
      return;
    }

    // Suspend installation if subscription is canceled or unpaid (skip if already suspended — idempotent across Stripe webhook retries)
    if (
      (stripeSub.status === 'canceled' || stripeSub.status === 'unpaid') &&
      installation.status !== InstallationStatus.SUSPENDED
    ) {
      await Installation.updateStatus(
        installation.id,
        InstallationStatus.SUSPENDED,
        ncMeta,
      );

      this.logger.log(
        `On-prem installation ${installation.id} suspended (subscription ${stripeSub.status})`,
      );

      await this.emitOnPremAlert({
        payment_type: 'on_prem_installation_suspended',
        message: `On-prem installation ${installation.id} suspended (subscription ${stripeSub.status})`,
        installation: {
          id: installation.id,
          license_type: installation.license_type,
        },
        subscription: { id: subRec.id, stripe_subscription_id: stripeSub.id },
        extra: { stripe_status: stripeSub.status },
      });

      const cancelUser = subRec.fk_user_id
        ? await User.get(subRec.fk_user_id, ncMeta).catch(() => null)
        : null;
      if (cancelUser?.email) {
        const stripeSubExt = stripeSub as Stripe.Subscription & {
          current_period_end?: number;
        };
        const endsAtUnix =
          stripeSub.cancel_at ?? stripeSubExt.current_period_end;
        const planFromConfig = subRec.fk_plan_id
          ? await Plan.get(subRec.fk_plan_id, ncMeta).catch(() => null)
          : null;
        await this.safeSendOnPremMail({
          mailEvent: MailEvent.ON_PREM_SUBSCRIPTION_CANCELED,
          payload: {
            user: cancelUser as any,
            installation: {
              id: installation.id,
              license_type: installation.license_type,
              licensed_to: installation.licensed_to,
            },
            subscriptionId: subRec.id,
            planTitle: planFromConfig?.title ?? 'your subscription',
            stripeStatus: stripeSub.status as 'canceled' | 'unpaid',
            endsAt: endsAtUnix
              ? new Date(endsAtUnix * 1000).toISOString()
              : undefined,
            billingPortalUrl: this.onPremBillingPortalUrl(),
          },
        });
      }
    }
    // Reactivate if subscription returns to active (e.g. after payment retry)
    else if (
      stripeSub.status === 'active' &&
      installation.status === InstallationStatus.SUSPENDED
    ) {
      await Installation.updateStatus(
        installation.id,
        InstallationStatus.ACTIVE,
        ncMeta,
      );

      this.logger.log(`On-prem installation ${installation.id} reactivated`);

      await this.emitOnPremAlert({
        payment_type: 'on_prem_installation_reactivated',
        message: `On-prem installation ${installation.id} reactivated`,
        installation: {
          id: installation.id,
          license_type: installation.license_type,
        },
        subscription: { id: subRec.id, stripe_subscription_id: stripeSub.id },
      });
    }
  }

  /**
   * Refresh an on-prem installation's license `config.addons` from the
   * subscription's currently-active add-ons. No-op for cloud subscriptions
   * (no linked Installation). The running instance picks up the change at its
   * next heartbeat (≤6h) — no re-activation needed.
   */
  async syncInstallationAddons(
    subscriptionId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const installation = await Installation.getBySubscriptionId(
      subscriptionId,
      ncMeta,
    );
    if (!installation) return;

    const subscription = await Subscription.get(subscriptionId, ncMeta).catch(
      () => null,
    );
    if (!subscription?.fk_plan_id) return;

    const plan = await Plan.get(subscription.fk_plan_id, ncMeta).catch(
      () => null,
    );
    if (!plan) return;

    const addonKeys = await SubscriptionAddon.listActiveKeys(
      subscriptionId,
      ncMeta,
    );
    const config = buildConfigFromPlan(plan, undefined, addonKeys);

    await Installation.update(installation.id, { config }, ncMeta);

    this.logger.log(
      `Refreshed installation ${installation.id} config.addons (${addonKeys.length} active)`,
    );
  }

  /**
   * Resolve an Installation for an internal add-on operation by its license key
   * OR its installation id — both are unique and identify the same installation,
   * so a single value is enough. Tries the id lookup first, then the key.
   * License-server side only.
   */
  async getInstallationForAddon(licenseKeyOrId: string): Promise<Installation> {
    const installation =
      (await Installation.get(licenseKeyOrId)) ??
      (await Installation.getByLicenseKey(licenseKeyOrId));
    if (!installation) {
      NcError.badRequest(
        `No on-prem installation found for '${licenseKeyOrId}' (expected a license key or installation id)`,
      );
    }
    return installation;
  }

  /**
   * Resolve the Subscription backing an installation's add-ons. Add-ons require
   * an existing subscription (created at license purchase, or linked via
   * link-subscription); internally-minted licenses without one are rejected
   * with a clear, actionable message rather than silently creating billing.
   */
  async getInstallationSubscriptionForAddon(
    installation: Installation,
  ): Promise<Subscription> {
    if (!installation.fk_subscription_id) {
      NcError.badRequest(
        `License '${installation.license_key}' has no subscription. Add-ons require an active subscription — purchase a license or link one via POST /api/internal/on-premise/license/link-subscription first.`,
      );
    }
    const subscription = await Subscription.get(
      installation.fk_subscription_id,
    );
    if (!subscription) {
      NcError.genericNotFound('Subscription', installation.fk_subscription_id);
    }
    return subscription;
  }

  /**
   * List the active add-ons on an installation's subscription. Empty when the
   * installation has no subscription (and therefore no add-ons).
   */
  async listInstallationAddons(
    licenseKeyOrId: string,
  ): Promise<SubscriptionAddon[]> {
    const installation = await this.getInstallationForAddon(licenseKeyOrId);
    if (!installation.fk_subscription_id) return [];
    return SubscriptionAddon.listActive(installation.fk_subscription_id);
  }

  /**
   * Link an existing Installation to a Stripe subscription by creating the
   * missing Subscription DB record.  Use when the webhook that normally
   * creates the Subscription was missed or the Installation was provisioned
   * outside the self-serve checkout flow.
   */
  async linkInstallationToSubscription(
    installationId: string,
    stripeSubscriptionId: string,
    userIdOverride?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<{ subscription_id: string; installation_id: string }> {
    const installation = await Installation.get(installationId, ncMeta);
    if (!installation) {
      NcError.genericNotFound('Installation', installationId);
    }

    if (installation.fk_subscription_id) {
      NcError.badRequest(
        `Installation ${installationId} is already linked to subscription ${installation.fk_subscription_id}`,
      );
    }

    // If a Subscription record already exists for this Stripe sub
    // (e.g. from a previous partial failure), just link it and return
    const existingSub = await Subscription.getByStripeSubscriptionId(
      stripeSubscriptionId,
      ncMeta,
    );
    if (existingSub) {
      await Installation.update(
        installation.id,
        { fk_subscription_id: existingSub.id },
        ncMeta,
      );

      this.logger.log(
        `Linked installation ${installationId} to existing subscription record ${existingSub.id} (stripe: ${stripeSubscriptionId})`,
      );

      return {
        subscription_id: existingSub.id,
        installation_id: installation.id,
      };
    }

    // Fetch from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    if (!stripeSub) {
      NcError.genericNotFound('Stripe subscription', stripeSubscriptionId);
    }

    if (!['active', 'trialing', 'incomplete'].includes(stripeSub.status)) {
      NcError.badRequest(
        `Stripe subscription status is "${stripeSub.status}" — expected active, trialing, or incomplete`,
      );
    }

    const baseItem = await getBaseSubscriptionItem(stripeSub, null, ncMeta);
    const price = baseItem?.price;
    if (!price) {
      NcError.badRequest('Stripe subscription has no price item');
    }

    // Plan is optional — custom/external plans may not exist in nc_plans.
    // Seat billing works regardless; plan is only needed for feature gating
    // which comes from the Installation config/license JWT on-prem.
    const planId = stripeSub.metadata?.fk_plan_id || null;
    let plan: Plan | null = null;
    if (planId) {
      plan = await Plan.get(planId, ncMeta, true);
    }

    const userId =
      userIdOverride ||
      installation.fk_user_id ||
      stripeSub.metadata?.fk_user_id;
    if (!userId) {
      NcError.badRequest(
        'Cannot determine user: pass user_id in the request, or ensure Installation.fk_user_id or Stripe metadata.fk_user_id is set',
      );
    }

    // min_seats is the billing floor (per-installation commitment).
    // seat_count / last_paid_seat_count reflect the actual billed quantity
    // which is at least min_seats, but may be higher if already reseated.
    const minSeats = stripeSub.metadata.min_seats
      ? parseInt(stripeSub.metadata.min_seats, 10)
      : baseItem.quantity || 1;
    const stripeQuantity = Math.max(minSeats, baseItem.quantity || 1);

    // Ensure Stripe subscription metadata is complete for webhook routing
    // and future syncLicenses calls
    const metadataUpdates: Record<string, string> = {};
    if (stripeSub.metadata.on_prem !== 'true') {
      metadataUpdates.on_prem = 'true';
    }
    if (stripeSub.metadata.fk_user_id !== userId) {
      metadataUpdates.fk_user_id = userId;
    }
    if (!stripeSub.metadata.plan_title && plan?.title) {
      metadataUpdates.plan_title = plan.title;
    }
    if (!stripeSub.metadata.period) {
      metadataUpdates.period = price.recurring.interval;
    }
    if (!stripeSub.metadata.min_seats) {
      metadataUpdates.min_seats = String(minSeats);
    }

    if (Object.keys(metadataUpdates).length > 0) {
      await stripe.subscriptions.update(stripeSub.id, {
        metadata: {
          ...stripeSub.metadata,
          ...metadataUpdates,
        },
      });

      this.logger.log(
        `Updated Stripe subscription ${stripeSub.id} metadata: ${JSON.stringify(
          metadataUpdates,
        )}`,
      );
    }

    // Create the Subscription record — seat_count and last_paid_seat_count
    // use the actual Stripe quantity, not min_seats
    const subRec = await Subscription.insert({
      fk_user_id: userId,
      fk_workspace_id: null,
      fk_org_id: null,
      fk_plan_id: planId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: price.id,
      seat_count: stripeQuantity,
      last_paid_seat_count: stripeQuantity,
      status: stripeSub.status,
      start_at: new Date(stripeSub.start_date * 1000).toISOString(),
      period: price.recurring.interval,
      billing_cycle_anchor: new Date(
        stripeSub.billing_cycle_anchor * 1000,
      ).toISOString(),
    });

    // Link the Installation to the new Subscription
    await Installation.update(
      installation.id,
      {
        fk_subscription_id: subRec.id,
        min_seats: minSeats,
      },
      ncMeta,
    );

    await this.emitOnPremAlert({
      payment_type: 'on_prem_subscription_linked',
      message: `On-prem installation ${installationId} linked to stripe subscription ${stripeSubscriptionId}`,
      user: { id: userId },
      installation: {
        id: installationId,
        license_type: installation.license_type,
      },
      subscription: {
        id: subRec.id,
        stripe_subscription_id: stripeSubscriptionId,
      },
      ...(plan ? { plan: { id: plan.id, title: plan.title } } : {}),
      extra: {
        stripe_quantity: stripeQuantity,
        min_seats: minSeats,
        ...(plan ? {} : { plan_title: 'custom' }),
      },
    });

    this.logger.log(
      `Linked installation ${installationId} to stripe subscription ${stripeSubscriptionId} via subscription record ${subRec.id} (stripe_quantity=${stripeQuantity}, min_seats=${minSeats})`,
    );

    return {
      subscription_id: subRec.id,
      installation_id: installation.id,
    };
  }

  /**
   * Reseat an installation based on reported usage vs minimum commitment.
   * If reported seats > min_seats, update Stripe to reported (prorated overage).
   * If reported seats < min_seats, ensure Stripe stays at min_seats (billing floor).
   */
  async reseatInstallation(
    installationId: string,
    reportedSeats: number,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const installation = await Installation.get(installationId, ncMeta);
    if (!installation?.fk_subscription_id) return;

    const subscription = await Subscription.get(
      installation.fk_subscription_id,
      ncMeta,
    );
    if (!subscription?.stripe_subscription_id) return;

    const minSeats = installation.min_seats || 1;
    const billedSeats = Math.max(minSeats, reportedSeats);

    try {
      // Get current Stripe quantity from the BASE plan item — installation
      // subscriptions may carry add-on items as second line items.
      const stripeSub = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );
      const item = await getBaseSubscriptionItem(
        stripeSub,
        subscription.stripe_price_id,
        ncMeta,
      );
      if (!item) return;
      const previousSeatCount = item.quantity || 1;
      if (billedSeats === previousSeatCount) return;

      // Yearly: always_invoice creates a separate proration invoice immediately,
      // so we must consolidate any unpaid proration invoices first.
      // Monthly: default proration (prorations roll into the next invoice),
      // no separate invoices are created, so no consolidation needed.
      const isYearly = subscription.period === 'year';

      if (isYearly) {
        const customerId =
          typeof stripeSub.customer === 'string'
            ? stripeSub.customer
            : stripeSub.customer.id;

        await this.consolidateUnpaidProrationInvoices(
          stripeSub,
          subscription,
          customerId,
          billedSeats,
        );
      } else {
        // Monthly — prorate to next invoice (no separate invoice). Per-seat
        // add-on items are forced-matched to the base seat count.
        await stripe.subscriptions.update(stripeSub.id, {
          items: await buildSeatSyncItems(
            subscription,
            stripeSub,
            billedSeats,
            ncMeta,
          ),
        });
      }

      // Update local records
      await Subscription.update(
        subscription.id,
        { seat_count: billedSeats },
        ncMeta,
      );

      this.logger.log(
        `Reseated installation ${installationId}: reported=${reportedSeats}, min=${minSeats}, billed=${billedSeats}`,
      );

      await this.emitOnPremAlert({
        payment_type: 'on_prem_reseated',
        message: `On-prem installation ${installationId} reseated ${previousSeatCount} → ${billedSeats} seats`,
        installation: {
          id: installationId,
          license_type: installation.license_type,
        },
        subscription: {
          id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
        },
        extra: {
          previous_seat_count: previousSeatCount,
          new_seat_count: billedSeats,
          min_seats: minSeats,
          reported_seats: reportedSeats,
        },
      });
    } catch (err) {
      await this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'reseatInstallation',
        error_type: err?.name,
        message: err?.message,
        error_details: err?.stack,
        affected_resources: [installationId, subscription.id],
      });
      throw err;
    }
  }

  /**
   * Void open/uncollectible proration invoices and reset the subscription to
   * last_paid_seat_count before applying the new quantity.
   * Only needed for yearly subscriptions where always_invoice creates separate
   * proration invoices that can go unpaid.
   */
  private async consolidateUnpaidProrationInvoices(
    stripeSub: Stripe.Subscription,
    subscription: Subscription,
    customerId: string,
    newSeatCount: number,
  ) {
    const [openInvoices, uncollectibleInvoices] = await Promise.all([
      stripe.invoices.list({
        customer: customerId,
        status: 'open',
        subscription: subscription.stripe_subscription_id,
        limit: 100,
      }),
      stripe.invoices.list({
        customer: customerId,
        status: 'uncollectible',
        subscription: subscription.stripe_subscription_id,
        limit: 100,
      }),
    ]);

    const problematicInvoices = [
      ...openInvoices.data,
      ...uncollectibleInvoices.data,
    ];

    if (problematicInvoices.length === 0) {
      await stripe.subscriptions.update(stripeSub.id, {
        items: await buildSeatSyncItems(subscription, stripeSub, newSeatCount),
        proration_behavior: 'always_invoice',
      });
      return;
    }

    // Only void proration invoices — not renewal invoices
    const prorationInvoices = problematicInvoices.filter((inv) =>
      inv.lines.data.some(
        (line) =>
          line.parent?.invoice_item_details?.proration ||
          line.parent?.subscription_item_details?.proration,
      ),
    );

    if (prorationInvoices.length === 0) {
      await stripe.subscriptions.update(stripeSub.id, {
        items: await buildSeatSyncItems(subscription, stripeSub, newSeatCount),
        proration_behavior: 'always_invoice',
      });
      return;
    }

    const lastPaidSeatCount =
      subscription.last_paid_seat_count ?? subscription.seat_count;

    const baseItem = await getBaseSubscriptionItem(
      stripeSub,
      subscription.stripe_price_id,
    );

    this.logger.warn(
      `Consolidating ${prorationInvoices.length} unpaid proration invoices for installation subscription ${subscription.id}. ` +
        `Resetting from ${baseItem?.quantity} seats to last paid state (${lastPaidSeatCount}), ` +
        `then updating to ${newSeatCount} seats.`,
    );

    // Step 1: Void all unpaid proration invoices
    for (const inv of prorationInvoices) {
      try {
        await stripe.invoices.voidInvoice(inv.id);
      } catch (e) {
        this.logger.warn(`Failed to void invoice ${inv.id}: ${e.message}`);
      }
    }

    // Step 2: Reset subscription to last paid seat count (no proration)
    await stripe.subscriptions.update(stripeSub.id, {
      items: await buildSeatSyncItems(
        subscription,
        stripeSub,
        lastPaidSeatCount,
      ),
      proration_behavior: 'none',
    });

    // Step 3: Update to the new desired seat count (with proration)
    if (newSeatCount !== lastPaidSeatCount) {
      await stripe.subscriptions.update(stripeSub.id, {
        items: await buildSeatSyncItems(subscription, stripeSub, newSeatCount),
        proration_behavior: 'always_invoice',
      });
    }

    await this.emitOnPremAlert({
      payment_type: 'proration_consolidated',
      message:
        `Consolidated ${prorationInvoices.length} unpaid proration invoices for on-prem subscription ${subscription.id}. ` +
        `Reset from ${baseItem?.quantity} to ${lastPaidSeatCount} (last paid), ` +
        `then updated to ${newSeatCount} seats.`,
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
      },
      extra: {
        voided_invoice_ids: prorationInvoices.map((i) => i.id),
        voided_invoice_amounts: prorationInvoices.map((i) => i.amount_due),
        last_paid_seat_count: lastPaidSeatCount,
        new_seat_count: newSeatCount,
      },
    });
  }

  /**
   * List all on-prem licenses for a user
   */
  async listLicenses(userId: string, ncMeta = Noco.ncMeta) {
    const installations = await Installation.listByUserId(userId, ncMeta);

    // Enrich with plan information
    const enriched = await Promise.all(
      installations.map(async (inst) => {
        let plan = null;
        let subscription = null;

        if (inst.fk_subscription_id) {
          subscription = await Subscription.get(
            inst.fk_subscription_id,
            ncMeta,
          );
          if (subscription?.fk_plan_id) {
            plan = await Plan.get(subscription.fk_plan_id, ncMeta);
          }
        }

        return {
          id: inst.id,
          license_key: inst.license_key,
          licensed_to: inst.licensed_to,
          license_type: inst.license_type,
          status: inst.status,
          seat_count: inst.seat_count,
          min_seats: inst.min_seats || 1,
          expires_at: inst.expires_at,
          created_at: inst.created_at,
          meta: inst.meta,
          config: inst.config,
          plan: plan
            ? {
                id: plan.id,
                title: plan.title,
              }
            : null,
          subscription: subscription
            ? {
                id: subscription.id,
                status: subscription.status,
                period: subscription.period,
              }
            : null,
        };
      }),
    );

    return enriched;
  }

  /**
   * Sync on-prem licenses from Stripe.
   * Finds active on-prem subscriptions in Stripe that don't have
   * a corresponding Installation record (e.g. webhook was missed)
   * and creates them.
   */
  async syncLicenses(userId: string, ncMeta = Noco.ncMeta) {
    const user = await User.get(userId, ncMeta);
    if (!user?.stripe_customer_id) return 0;

    // Fetch all active subscriptions for this customer from Stripe
    const stripeSubs = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'active',
      limit: 100,
    });

    let synced = 0;

    for (const stripeSub of stripeSubs.data) {
      // Only process on-prem subscriptions
      if (stripeSub.metadata.on_prem !== 'true') continue;

      // Check if we already have this subscription locally
      const existing = await Subscription.getByStripeSubscriptionId(
        stripeSub.id,
        ncMeta,
      );
      if (existing) continue;

      // Missed webhook — replay the creation
      try {
        await this.handleSubscriptionCreated(stripeSub, ncMeta);
        synced++;
        this.logger.log(
          `Synced missing on-prem subscription ${stripeSub.id} for user ${userId}`,
        );
      } catch (e) {
        this.logger.error(
          `Failed to sync on-prem subscription ${stripeSub.id}: ${e.message}`,
          e.stack,
        );
      }
    }

    return synced;
  }

  /**
   * Get a single on-prem license by ID (must belong to user)
   */
  async getLicense(licenseId: string, userId: string, ncMeta = Noco.ncMeta) {
    const installation = await Installation.get(licenseId, ncMeta);

    if (!installation || installation.fk_user_id !== userId) {
      NcError.genericNotFound('License', licenseId);
    }

    return installation;
  }

  /**
   * Get checkout session result (for polling after payment).
   * Scoped to the requesting user's Stripe customer to prevent cross-user access.
   */
  async getCheckoutSession(
    sessionId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to this user's Stripe customer
    const user = await User.get(userId, ncMeta);
    if (
      !user?.stripe_customer_id ||
      session.customer !== user.stripe_customer_id
    ) {
      NcError.genericNotFound('Checkout session', sessionId);
    }

    return session;
  }

  /**
   * List Stripe invoices for the user's on-prem stripe customer.
   * The on-prem stripe customer is dedicated (created with metadata.type='on_prem'),
   * so all invoices on it belong to on-prem subscriptions.
   */
  async listInvoices(
    userId: string,
    options: {
      starting_after?: string;
      ending_before?: string;
    } = {},
    ncMeta = Noco.ncMeta,
  ) {
    const user = await User.get(userId, ncMeta);
    if (!user?.stripe_customer_id) {
      return { data: [], has_more: false };
    }

    const invoices = await stripe.invoices.list({
      customer: user.stripe_customer_id,
      limit: 10,
      starting_after: options.starting_after,
      ending_before: options.ending_before,
    });

    const stripeSubIds = Array.from(
      new Set(
        invoices.data
          .map((inv) => inv.parent?.subscription_details?.subscription)
          .filter((id): id is string => typeof id === 'string'),
      ),
    );

    const licenseKeyByStripeSub = new Map<string, string>();
    for (const stripeSubId of stripeSubIds) {
      const subRec = await Subscription.getByStripeSubscriptionId(
        stripeSubId,
        ncMeta,
      );
      if (!subRec) continue;
      const installation = await Installation.getBySubscriptionId(
        subRec.id,
        ncMeta,
      );
      if (installation?.license_key) {
        licenseKeyByStripeSub.set(stripeSubId, installation.license_key);
      }
    }

    const data = invoices.data.map((inv) => {
      const stripeSubId = inv.parent?.subscription_details?.subscription;
      const licenseKey =
        typeof stripeSubId === 'string'
          ? licenseKeyByStripeSub.get(stripeSubId)
          : undefined;
      return {
        ...inv,
        license_key_masked: licenseKey ? maskLicenseKey(licenseKey) : null,
      };
    });

    return { ...invoices, data };
  }

  /**
   * Get the customer portal URL for managing on-prem billing
   */
  async getCustomerPortal(
    userId: string,
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const user = await User.get(userId, ncMeta);
    if (!user?.stripe_customer_id) {
      NcError.badRequest('No billing information found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${req.ncSiteUrl}/account/self-hosted`,
    });

    return { url: session.url };
  }

  /**
   * Handle invoice.paid for an on-prem subscription. Called by the cloud-EE
   * webhook router when the resolved Subscription has no workspace/org.
   */
  async handleInvoicePaid(
    invoice: Stripe.Invoice,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const subscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
    if (!subscriptionId) return;

    const subRec = await Subscription.getByStripeSubscriptionId(
      subscriptionId,
      ncMeta,
    );
    if (!subRec) {
      this.logger.warn(
        `On-prem invoice.paid: no Subscription record found for stripe_sub=${subscriptionId}`,
      );
      return;
    }

    // Defensive: caller (cloud-EE webhook router) should only route on-prem
    // subscriptions here. If a workspace/org sub slipped through, drop with
    // a warn rather than emit it on the on-prem channel.
    if (subRec.fk_workspace_id || subRec.fk_org_id) {
      this.logger.warn(
        `handleInvoicePaid received non-on-prem subscription ${subRec.id} (workspace=${subRec.fk_workspace_id}, org=${subRec.fk_org_id})`,
      );
      return;
    }

    const installation = await Installation.getBySubscriptionId(
      subRec.id,
      ncMeta,
    );

    await this.emitOnPremAlert({
      payment_type: 'on_prem_payment_succeeded',
      message: installation
        ? `On-prem installation ${installation.id} payment succeeded`
        : `On-prem subscription ${subRec.id} payment succeeded`,
      ...(installation
        ? {
            installation: {
              id: installation.id,
              license_type: installation.license_type,
            },
          }
        : {}),
      subscription: { id: subRec.id, stripe_subscription_id: subscriptionId },
      extra: {
        invoice_id: invoice.id,
        amount_paid: invoice.amount_paid,
      },
    });
  }

  /**
   * Handle invoice.payment_failed for an on-prem subscription. Called by the
   * cloud-EE webhook router when the resolved Subscription has no
   * workspace/org.
   */
  async handleInvoicePaymentFailed(
    invoice: Stripe.Invoice,
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const subscriptionId =
      typeof invoice.parent?.subscription_details?.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : invoice.parent?.subscription_details?.subscription?.id;
    if (!subscriptionId) return;

    const subRec = await Subscription.getByStripeSubscriptionId(
      subscriptionId,
      ncMeta,
    );
    if (!subRec) {
      this.logger.warn(
        `On-prem invoice.payment_failed: no Subscription record found for stripe_sub=${subscriptionId}`,
      );
      return;
    }

    // Defensive: caller (cloud-EE webhook router) should only route on-prem
    // subscriptions here. If a workspace/org sub slipped through, drop with
    // a warn rather than emit it on the on-prem channel.
    if (subRec.fk_workspace_id || subRec.fk_org_id) {
      this.logger.warn(
        `handleInvoicePaymentFailed received non-on-prem subscription ${subRec.id} (workspace=${subRec.fk_workspace_id}, org=${subRec.fk_org_id})`,
      );
      return;
    }

    const installation = await Installation.getBySubscriptionId(
      subRec.id,
      ncMeta,
    );

    await this.emitOnPremAlert({
      payment_type: 'on_prem_payment_failed',
      message: installation
        ? `On-prem installation ${installation.id} payment failed`
        : `On-prem subscription ${subRec.id} payment failed`,
      ...(installation
        ? {
            installation: {
              id: installation.id,
              license_type: installation.license_type,
            },
          }
        : {}),
      subscription: { id: subRec.id, stripe_subscription_id: subscriptionId },
      extra: {
        invoice_id: invoice.id,
        failure_reason:
          invoice.last_finalization_error?.message || 'Payment failed',
      },
    });

    if (!installation || !invoice.id) return;

    const failedUser = subRec.fk_user_id
      ? await User.get(subRec.fk_user_id, ncMeta).catch(() => null)
      : null;
    if (!failedUser?.email) return;

    await this.safeSendOnPremMail({
      mailEvent: MailEvent.ON_PREM_PAYMENT_FAILED,
      payload: {
        user: failedUser as any,
        installation: {
          id: installation.id,
          license_type: installation.license_type,
          licensed_to: installation.licensed_to,
        },
        subscriptionId: subRec.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.number ?? undefined,
        hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
        attemptCount: invoice.attempt_count ?? 1,
        amountDue: invoice.amount_due ?? 0,
        currency: invoice.currency ?? 'usd',
        nextAttemptAt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : undefined,
        failureMessage: invoice.last_finalization_error?.message ?? undefined,
        billingPortalUrl: this.onPremBillingPortalUrl(),
      },
    });
  }
}
