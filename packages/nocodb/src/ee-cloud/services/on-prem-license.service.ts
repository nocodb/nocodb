import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { nanoid } from 'nanoid';
import { OnPremPlanTitles, ReturnToBillingPage } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { Plan, Subscription, User } from '~/models';
import Installation from '~/models/Installation';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { InstallationStatus, LicenseType } from '~/utils/license';
import { TelemetryService } from '~/services/telemetry.service';

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

  return config;
}

@Injectable()
export class OnPremLicenseService {
  protected logger = new Logger(OnPremLicenseService.name);

  constructor(protected readonly telemetryService: TelemetryService) {}

  /**
   * Generate a unique license key for a new on-prem installation
   */
  private generateLicenseKey(): string {
    return `nc_${nanoid(32)}`;
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
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const { plan_id, price_id, instance_url } = payload;
    const seats = Math.max(1, Math.floor(payload.quantity || 1));
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
      subscription_data: {
        metadata: {
          on_prem: 'true',
          fk_user_id: user.id,
          fk_plan_id: plan_id,
          plan_title: plan.title,
          period: price.recurring.interval,
          min_seats: String(seats),
          ...(instance_url ? { instance_url } : {}),
        },
      },
    });

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'on_prem_checkout_initiated',
      message: `On-prem license checkout initiated (${plan.title})`,
      user: { id: user.id, email: user.email },
      extra: {
        checkout_session_id: session.id,
        plan_id,
        plan_title: plan.title,
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
      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'on_prem_webhook_error',
        message: `On-prem subscription created webhook missing metadata (stripe_sub: ${stripeSub.id})`,
        extra: {
          stripe_subscription_id: stripeSub.id,
          metadata: stripeSub.metadata,
        },
      });
      return;
    }

    const plan = await Plan.get(planId, ncMeta);
    if (!plan) {
      this.logger.error(`Plan not found: ${planId}`);
      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'on_prem_webhook_error',
        message: `On-prem subscription created but plan not found: ${planId}`,
        extra: { stripe_subscription_id: stripeSub.id, fk_plan_id: planId },
      });
      return;
    }

    const licenseType = PLAN_TO_LICENSE_TYPE[planTitle];
    if (!licenseType) {
      this.logger.error(`Invalid plan title for on-prem: ${planTitle}`);
      return;
    }

    const config = buildConfigFromPlan(plan);
    const price = stripeSub.items.data[0].price;
    const period = price.recurring.interval;

    // Read min_seats from metadata (fallback: Stripe item quantity, then 1)
    const minSeats = stripeSub.metadata.min_seats
      ? parseInt(stripeSub.metadata.min_seats, 10)
      : stripeSub.items.data[0].quantity || 1;

    // Create Subscription record (no workspace/org, just user)
    const subRec = await Subscription.insert({
      fk_user_id: userId,
      fk_workspace_id: null,
      fk_org_id: null,
      fk_plan_id: planId,
      stripe_subscription_id: stripeSub.id,
      stripe_price_id: price.id,
      seat_count: minSeats,
      status: stripeSub.status,
      start_at: new Date(stripeSub.start_date * 1000).toISOString(),
      period,
    });

    // Generate license key and create Installation
    const licenseKey = this.generateLicenseKey();
    const user = await User.get(userId, ncMeta);

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
      },
      ncMeta,
    );

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'on_prem_license_created',
      message: `On-prem license created (${planTitle}) for ${user?.email}`,
      user: { id: userId, email: user?.email },
      extra: {
        installation_id: installation.id,
        subscription_id: subRec.id,
        stripe_subscription_id: stripeSub.id,
        plan_title: planTitle,
        license_type: licenseType,
        period,
      },
    });

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

    // Check if plan changed and update Subscription + Installation config
    const newPlanId = stripeSub.metadata?.fk_plan_id;
    if (newPlanId && newPlanId !== subRec.fk_plan_id) {
      const newPlan = await Plan.get(newPlanId, ncMeta);
      if (newPlan) {
        await Subscription.update(
          subRec.id,
          { fk_plan_id: newPlanId, status: stripeSub.status },
          ncMeta,
        );

        // Update Installation config with new plan metadata
        const inst = await Installation.getBySubscriptionId(subRec.id, ncMeta);
        if (inst) {
          const newConfig = buildConfigFromPlan(newPlan);
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

    // Sync min_seats if Stripe item quantity changed (e.g. via customer portal)
    const stripeQuantity = stripeSub.items.data[0]?.quantity;
    if (stripeQuantity && stripeQuantity !== (installation.min_seats || 1)) {
      await Installation.update(
        installation.id,
        { min_seats: stripeQuantity },
        ncMeta,
      );
      await Subscription.update(
        subRec.id,
        { seat_count: stripeQuantity },
        ncMeta,
      );

      this.logger.log(
        `On-prem installation ${installation.id} min_seats synced to ${stripeQuantity} from Stripe`,
      );
    }

    // Suspend installation if subscription is canceled or unpaid
    if (stripeSub.status === 'canceled' || stripeSub.status === 'unpaid') {
      await Installation.updateStatus(
        installation.id,
        InstallationStatus.SUSPENDED,
        ncMeta,
      );

      this.logger.log(
        `On-prem installation ${installation.id} suspended (subscription ${stripeSub.status})`,
      );
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
    }
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

    // Get current Stripe quantity
    const stripeSub = await stripe.subscriptions.retrieve(
      subscription.stripe_subscription_id,
    );
    const item = stripeSub.items.data[0];
    if (!item || billedSeats === (item.quantity || 1)) return;

    // Update Stripe subscription quantity with proration
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: item.id, quantity: billedSeats }],
      proration_behavior: 'always_invoice',
    });

    // Update local records
    await Subscription.update(
      subscription.id,
      { seat_count: billedSeats },
      ncMeta,
    );

    this.logger.log(
      `Reseated installation ${installationId}: reported=${reportedSeats}, min=${minSeats}, billed=${billedSeats}`,
    );
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
      return_url: `${req.ncSiteUrl}/#/account/self-hosted`,
    });

    return { url: session.url };
  }
}
