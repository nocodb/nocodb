import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import {
  AppEvents,
  EventType,
  getUpgradeMessage,
  LoyaltyPriceReverseLookupKeyMap,
  PlanOrder,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { JobTypes } from '~/interface/Jobs';
import {
  Org,
  Plan,
  Subscription,
  User,
  Workspace,
  WorkspaceUser,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import {
  calculateUnitPrice,
  getWorkspaceOrOrg,
} from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { TelemetryService } from '~/services/telemetry.service';
import NocoSocket from '~/socket/NocoSocket';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder', {
  apiVersion: '2025-05-28.basil',
});

const NOCODB_INTERNAL = 'nocodb';

@Injectable()
export class PaymentService {
  logger = new Logger('PaymentService');

  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly nocoJobsService: NocoJobsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async getPlans() {
    return await Plan.list();
  }

  async getPlan(planId: string) {
    const plan = await Plan.get(planId);

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    return plan;
  }

  async submitPlan(payload: {
    stripe_product_id: string;
    is_active?: boolean;
  }) {
    const existing = await Plan.getWithCondition({
      stripe_product_id: payload.stripe_product_id,
    });

    if (existing.length) {
      const existingPlan = existing[0];
      throw new Error(`Plan already exists with id ${existingPlan.id}`);
    }

    const product = await stripe.products.retrieve(payload.stripe_product_id);

    if (!product) {
      NcError.genericNotFound('Product', payload.stripe_product_id);
    }

    const { name: title, description, metadata } = product;

    // get the prices for the product
    const prices = await stripe.prices.list({
      product: payload.stripe_product_id,
      active: true,
      expand: ['data.tiers'],
    });

    const plan = {
      title: title as PlanTitles,
      description,
      stripe_product_id: payload.stripe_product_id,
      is_active: payload.is_active ?? true,
      prices: prices.data.map((price) => price),
      // TODO : extract with proper types
      meta: metadata as any,
    };

    return await Plan.insert(plan);
  }

  async syncPlan(planId: string, payload?: { is_active?: boolean }) {
    const plan =
      (await Plan.get(planId)) || (await Plan.getByStripeProductId(planId));

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    const product = await stripe.products.retrieve(plan.stripe_product_id);

    if (!product) {
      NcError.genericNotFound('Product', plan.stripe_product_id);
    }

    const { name: title, description, metadata } = product;

    // get the prices for the product
    const prices = await stripe.prices.list({
      product: plan.stripe_product_id,
      active: true,
      expand: ['data.tiers'],
    });

    Object.assign(plan, {
      title,
      description,
      prices: prices.data.map((price) => price),
      meta: metadata,
      is_active: payload?.is_active,
    });

    return await Plan.update(plan.id, plan);
  }

  async syncAllPlans() {
    const plans = await Plan.getWithCondition({
      is_active: true,
    });

    for (const plan of plans) {
      await this.syncPlan(plan.id);
    }

    return { message: 'All plans synced' };
  }

  async disablePlan(planId: string) {
    const plan =
      (await Plan.get(planId)) || (await Plan.getByStripeProductId(planId));

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    return await Plan.update(plan.id, { is_active: false });
  }

  async internalUpgrade(
    workspaceOrOrgId: string,
    planTitle: string,
    ncMeta = Noco.ncMeta,
  ) {
    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
    );

    if (existingSubscription) {
      throw new Error(`Subscription already exists for ${workspaceOrOrgId} `);
    }

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const plans = await Plan.list(ncMeta);

    const plan = plans.find((p) => p.title === planTitle);

    if (!plan) {
      NcError.genericNotFound('Plan', planTitle);
    }

    const transaction = await ncMeta.startTransaction();

    let subscription: Subscription | null = null;

    try {
      subscription = await Subscription.insert(
        {
          fk_workspace_id:
            workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
          fk_org_id: workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
          fk_plan_id: plan.id,
          stripe_subscription_id: `internal_${nanoid()}`,
          stripe_price_id: `internal_${plan.id}`,
          seat_count: 1,
          status: 'active',
          start_at: dayjs().utc().toISOString(),
          period: 'year',
          billing_cycle_anchor: dayjs().utc().toISOString(),
        },
        transaction,
      );

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: NOCODB_INTERNAL,
          },
          transaction,
        );
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: NOCODB_INTERNAL,
          },
          transaction,
        );
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();

      await NocoCache.del(
        `${
          workspaceOrOrg.entity === 'workspace'
            ? CacheScope.WORKSPACE
            : CacheScope.ORG
        }:${workspaceOrOrg.id}`,
      );

      this.logger.error(e);
      return NcError.internalServerError('Failed to create subscription');
    }

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'subscription_created',
      message: `FREE Internal Subscription created for ${workspaceOrOrg.title} (${plan.title})`,
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        subscription_id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        plan_title: plan.title,
      },
    });

    await this.migrateDb(workspaceOrOrg.id, transaction);
    await this.reseatSubscription(workspaceOrOrg.id, ncMeta);

    return subscription;
  }

  async customerUpdate(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      NcError.genericNotFound('Customer', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const customer = await stripe.customers.update(
      workspaceOrOrg.stripe_customer_id,
      {
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      },
    );

    return customer;
  }

  async createStripeCustomer(
    workspaceOrOrgId: string,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const user = await User.get(userId, ncMeta);

    if (!user) {
      NcError.genericNotFound('User', userId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
          entity: `${workspaceOrOrg.entity}_${workspaceOrOrg.id}`,
        },
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      });

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      }
    }

    return workspaceOrOrg.stripe_customer_id;
  }

  async createSubscriptionForm(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
      isAccountPage?: boolean;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const { seat, plan_id, price_id, isAccountPage = true } = payload;

    const { user } = req;

    if (!seat || !plan_id || !price_id) {
      throw new Error('Invalid payload');
    }

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existingSubscription && existingSubscription.status !== 'incomplete') {
      throw new Error('Subscription already exists');
    }

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);

    if (seatCount !== seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    const plan = await Plan.get(plan_id, ncMeta);

    if (!plan) {
      NcError.genericNotFound('Plan', plan_id);
    }

    if (!plan.is_active) {
      throw new Error('This plan is not available');
    }

    const price = plan.prices.find((p) => p.id === price_id);

    if (!price) {
      NcError.genericNotFound('Price', price_id);
    }

    if (
      price.lookup_key.includes('loyalty') &&
      (!workspaceOrOrg.loyal || workspaceOrOrg.loyalty_discount_used)
    ) {
      throw new Error('This plan is not available');
    }

    if (workspaceOrOrg.stripe_customer_id) {
      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        NcError.notImplemented('Internal customer not supported');
      }

      const stripe_customer = await stripe.customers.retrieve(
        workspaceOrOrg.stripe_customer_id,
      );

      if (!stripe_customer || stripe_customer.deleted) {
        this.logger.error(
          `Stripe customer not found for ${workspaceOrOrg.entity} ${workspaceOrOrg.id} with id ${workspaceOrOrg.stripe_customer_id}`,
        );

        // Clear the customer id & recreate
        workspaceOrOrg.stripe_customer_id = null;
      }

      const customerSubscription = await stripe.subscriptions.list({
        customer: workspaceOrOrg.stripe_customer_id,
      });

      if (customerSubscription.data.length) {
        const subscription = customerSubscription.data.find(
          (s) =>
            ((s.metadata.fk_org_id &&
              s.metadata.fk_org_id === workspaceOrOrg.id) ||
              (s.metadata.fk_workspace_id &&
                s.metadata.fk_workspace_id === workspaceOrOrg.id)) &&
            ['active', 'trialing', 'incomplete'].includes(s.status),
        );

        if (subscription) {
          await this.recoverSubscription(workspaceOrOrg.id, ncMeta);
          return {
            recover: true,
          };
        }
      }
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
          entity: `${workspaceOrOrg.entity}_${workspaceOrOrg.id}`,
        },
        invoice_settings: {
          custom_fields: [
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } ID`,
              value: workspaceOrOrg.id,
            },
            {
              name: `NocoDB ${
                workspaceOrOrg.entity === 'org' ? 'Org' : 'Workspace'
              } Title`,
              value: workspaceOrOrg.title,
            },
          ],
        },
      });

      if (workspaceOrOrg.entity === 'workspace') {
        await Workspace.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      } else {
        await Org.update(
          workspaceOrOrg.id,
          {
            stripe_customer_id: customer.id,
          },
          ncMeta,
        );

        workspaceOrOrg.stripe_customer_id = customer.id;
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: price.id,
          quantity: seat,
        },
      ],
      ui_mode: 'embedded',
      return_url: `${req.ncSiteUrl}/?afterPayment=true&workspaceId=${workspaceOrOrg.id}&session_id={CHECKOUT_SESSION_ID}&isAccountPage=${isAccountPage}`,
      automatic_tax: {
        enabled: true,
      },
      billing_address_collection: 'required',
      customer: workspaceOrOrg.stripe_customer_id,
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      tax_id_collection: {
        enabled: true,
      },
      subscription_data: {
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : {
                fk_org_id: workspaceOrOrg.id,
              }),
          fk_user_id: user.id,
          fk_plan_id: plan_id,
          plan_title: plan.title,
          period: price.recurring.interval,
        },
      },
      ...(workspaceOrOrg.segment_code === 1
        ? {
            allow_promotion_codes: true,
          }
        : {}),
    });

    await this.telemetryService.sendSystemEvent({
      event_type: 'payment_alert',
      payment_type: 'payment_triggered',
      message: `Payment checkout initiated for ${workspaceOrOrg.title} (${plan.title})`,
      user: { id: user.id, email: user.email },
      workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
      extra: {
        checkout_session_id: session.id,
        plan_id,
        plan_title: plan.title,
        price_id,
        seat_count: seat,
        period: price.recurring.interval,
      },
    });

    return session;
  }

  async updateSubscription(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError.notImplemented('Internal customer not supported');
    }

    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const oldPlan = await Plan.get(existingSub.fk_plan_id, ncMeta);
    if (!oldPlan) NcError.genericNotFound('Plan', existingSub.fk_plan_id);
    const oldPrice = oldPlan.prices.find(
      (p) => p.id === existingSub.stripe_price_id,
    )!;

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
    if (seatCount !== payload.seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    // if nothing changed → clear any schedule + undelete if canceled
    if (
      oldPlan.id === payload.plan_id &&
      oldPrice.id === payload.price_id &&
      seatCount === payload.seat
    ) {
      // resume if user had previously canceled
      if (existingSub.canceled_at) {
        await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
          cancel_at_period_end: false,
        });
        await Subscription.update(
          existingSub.id,
          { canceled_at: null },
          ncMeta,
        );
        await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, ncMeta);
      } else {
        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);
      }

      return { id: existingSub.stripe_subscription_id };
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError.genericNotFound(
        'Stripe subscription',
        existingSub.stripe_subscription_id,
      );

    if (
      workspaceOrOrg.entity === 'workspace' &&
      stripeSub.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the workspace');
    }
    if (
      workspaceOrOrg.entity === 'org' &&
      stripeSub.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the org');
    }

    const newPlan = await Plan.get(payload.plan_id, ncMeta);
    if (!newPlan) NcError.genericNotFound('Plan', payload.plan_id);
    if (!newPlan.is_active) throw new Error('This plan is not available');
    const newPrice = newPlan.prices.find((p) => p.id === payload.price_id)!;
    if (!newPrice) NcError.genericNotFound('Price', payload.price_id);

    // allow loyalty discount only if the user has not used it yet
    if (
      newPrice.lookup_key.includes('loyalty') &&
      (!workspaceOrOrg.loyal || workspaceOrOrg.loyalty_discount_used)
    ) {
      throw new Error('This plan is not available');
    }

    const item = stripeSub.items.data[0];

    let updatedSubscription;

    // CASE: monthly-to-yearly or yearly-to-monthly (same plan or lower plan)
    if (
      newPrice.recurring.interval !== oldPrice.recurring.interval &&
      PlanOrder[oldPlan.title] >= PlanOrder[newPlan.title]
    ) {
      // Monthly to Yearly: immediate change with proration (invoice immediately) + reset billing cycle
      if (
        newPrice.recurring.interval === 'year' &&
        oldPrice.recurring.interval === 'month'
      ) {
        updatedSubscription = await stripe.subscriptions.update(stripeSub.id, {
          items: [
            {
              id: item.id,
              price: newPrice.id,
              quantity: seatCount,
            },
          ],
          metadata: {
            ...(workspaceOrOrg.entity === 'workspace'
              ? { fk_workspace_id: workspaceOrOrg.id }
              : { fk_org_id: workspaceOrOrg.id }),
            fk_user_id: req.user.id,
            fk_plan_id: newPlan.id,
            plan_title: newPlan.title,
            period: newPrice.recurring.interval,
          },
          proration_behavior: 'always_invoice',
          billing_cycle_anchor: 'now',
        });

        await Subscription.update(
          existingSub.id,
          {
            fk_plan_id: newPlan.id,
            stripe_price_id: newPrice.id,
            period: newPrice.recurring.interval,
          },
          ncMeta,
        );

        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );

        return { id: stripeSub.id };
      }
      // Yearly to Monthly: schedule change at period end (no prorate)
      if (
        newPrice.recurring.interval === 'month' &&
        oldPrice.recurring.interval === 'year'
      ) {
        await this.schedulePlanChange(
          workspaceOrOrgId,
          newPrice,
          newPlan,
          {
            scheduleType: 'next',
          },
          ncMeta,
        );

        return {
          id: stripeSub.id,
          message: 'Plan change scheduled at period end',
        };
      }
    } else {
      // Yearly plan
      if (newPrice.recurring.interval === 'year') {
        // If the new price or plan is higher upgrade immediately (invoice now with prorations) + reset billing cycle
        if (
          !oldPrice ||
          calculateUnitPrice(newPrice, seatCount, newPrice.recurring.interval) >
            calculateUnitPrice(
              oldPrice,
              seatCount,
              oldPrice.recurring.interval as 'month' | 'year',
            ) ||
          PlanOrder[newPlan.title] > PlanOrder[oldPlan.title]
        ) {
          updatedSubscription = await stripe.subscriptions.update(
            stripeSub.id,
            {
              items: [
                {
                  id: item.id,
                  price: newPrice.id,
                  quantity: seatCount,
                },
              ],
              metadata: {
                ...(workspaceOrOrg.entity === 'workspace'
                  ? { fk_workspace_id: workspaceOrOrg.id }
                  : { fk_org_id: workspaceOrOrg.id }),
                fk_user_id: req.user.id,
                fk_plan_id: newPlan.id,
                plan_title: newPlan.title,
                period: newPrice.recurring.interval,
              },
              proration_behavior: 'always_invoice',
              billing_cycle_anchor: 'now',
            },
          );

          await Subscription.update(
            existingSub.id,
            {
              fk_plan_id: newPlan.id,
              stripe_price_id: newPrice.id,
              period: newPrice.recurring.interval,
            },
            ncMeta,
          );

          await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

          await this.updateNextInvoice(
            existingSub.id,
            await this.getNextInvoice(workspaceOrOrgId, ncMeta),
            ncMeta,
          );

          return { id: updatedSubscription.id };
        } else {
          await this.schedulePlanChange(
            workspaceOrOrgId,
            newPrice,
            newPlan,
            {
              scheduleType: 'next',
            },
            ncMeta,
          );

          return {
            id: stripeSub.id,
            message: 'Plan downgrade scheduled at period end',
          };
        }
      } else {
        // Monthly plan: change immediately with proration (invoice now) + reset billing cycle
        updatedSubscription = await stripe.subscriptions.update(stripeSub.id, {
          items: [
            {
              id: item.id,
              price: newPrice.id,
              quantity: seatCount,
            },
          ],
          metadata: {
            ...(workspaceOrOrg.entity === 'workspace'
              ? { fk_workspace_id: workspaceOrOrg.id }
              : { fk_org_id: workspaceOrOrg.id }),
            fk_user_id: req.user.id,
            fk_plan_id: newPlan.id,
            plan_title: newPlan.title,
            period: newPrice.recurring.interval,
          },
          proration_behavior: 'always_invoice',
          billing_cycle_anchor: 'now',
        });

        await Subscription.update(
          existingSub.id,
          {
            fk_plan_id: newPlan.id,
            stripe_price_id: newPrice.id,
            period: newPrice.recurring.interval,
          },
          ncMeta,
        );

        await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);

        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );

        return { id: updatedSubscription.id };
      }
    }
  }

  async reseatSubscriptionAwaited(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    const lockId = nanoid();
    const lockKey = `reseatSubscription:${workspaceOrOrgId}`;
    let lockAcquired = false;

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg) return;

    // if the workspace is a child of an org, we need to use the org id
    if (workspaceOrOrg.entity === 'workspace') {
      if (workspaceOrOrg?.fk_org_id) {
        workspaceOrOrgId = workspaceOrOrg.fk_org_id;
      }
    }

    try {
      // Acquire lock with retry logic
      lockAcquired = await acquireLock(lockKey, lockId);

      if (!lockAcquired) {
        // we use soft lock, so we proceed even if not acquired
        this.logger.warn(
          `Failed to acquire lock for workspace ${workspaceOrOrgId} after maximum wait time`,
        );
      }

      const existingSub = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );
      if (!existingSub) return;

      const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
      if (existingSub.seat_count === seatCount) return;

      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        await Subscription.update(
          existingSub.id,
          { seat_count: seatCount },
          ncMeta,
        );
      } else {
        const stripeSub = await stripe.subscriptions.retrieve(
          existingSub.stripe_subscription_id,
        );
        if (!stripeSub) throw new Error('Stripe subscription not found');

        if (
          stripeSub.metadata.fk_workspace_id &&
          stripeSub.metadata.fk_workspace_id !== existingSub.fk_workspace_id
        ) {
          throw new Error('Subscription does not belong to the workspace');
        }
        if (
          stripeSub.metadata.fk_org_id &&
          stripeSub.metadata.fk_org_id !== existingSub.fk_org_id
        ) {
          throw new Error('Subscription does not belong to the org');
        }

        await stripe.subscriptions.update(stripeSub.id, {
          items: [
            {
              id: stripeSub.items.data[0].id,
              price: existingSub.stripe_price_id,
              quantity: seatCount,
            },
          ],
          ...(existingSub.period === 'year' || existingSub.stripe_schedule_id
            ? { proration_behavior: 'always_invoice' }
            : {}),
        });

        await Subscription.update(
          existingSub.id,
          { seat_count: seatCount },
          ncMeta,
        );

        // if there is a schedule, update it too
        if (existingSub.stripe_schedule_id) {
          const stripePrice = await stripe.prices.retrieve(
            existingSub.schedule_stripe_price_id,
          );

          // update the schedule
          await this.schedulePlanChange(
            workspaceOrOrgId,
            stripePrice,
            await Plan.get(existingSub.schedule_fk_plan_id, ncMeta, true),
            {
              scheduleType: existingSub.schedule_type,
            },
            ncMeta,
          );
        }

        // update the next invoice
        await this.updateNextInvoice(
          existingSub.id,
          await this.getNextInvoice(workspaceOrOrgId, ncMeta),
          ncMeta,
        );
      }
    } catch (err) {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
      await this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'reseatSubscription',
        error_type: err?.name,
        message: err?.message,
        error_details: err?.stack,
        affected_resources: [
          workspaceOrOrgId,
          workspaceOrOrg?.title,
          initiator,
        ],
      });
      throw err; // Re-throw to ensure proper error handling
    } finally {
      // Always release the lock if we acquired it
      if (lockAcquired) {
        await releaseLock(lockKey, lockId);
      }
    }
  }

  async reseatSubscription(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
    initiator?: string,
  ) {
    // we don't want to block the request
    this.reseatSubscriptionAwaited(workspaceOrOrgId, ncMeta, initiator).catch(
      () => {
        // we handle the error in the promise
      },
    );
  }

  async cancelSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError.notImplemented('Internal customer not supported');
    }

    const stripeSub = await stripe.subscriptions.retrieve(
      existingSub.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError.genericNotFound(
        'Stripe subscription',
        existingSub.stripe_subscription_id,
      );

    if (
      workspaceOrOrg.entity === 'workspace' &&
      stripeSub.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the workspace');
    }
    if (
      workspaceOrOrg.entity === 'org' &&
      stripeSub.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the org');
    }

    // release the schedule if it exists
    if (existingSub.stripe_schedule_id) {
      await stripe.subscriptionSchedules.release(
        existingSub.stripe_schedule_id,
      );
    }

    const canceled = await stripe.subscriptions.update(stripeSub.id, {
      cancel_at_period_end: true,
    });

    await Subscription.update(
      existingSub.id,
      {
        status: canceled.status,
        canceled_at: canceled.cancel_at
          ? dayjs.unix(canceled.cancel_at).utc().toISOString()
          : null,
        stripe_schedule_id: null,
        schedule_phase_start: null,
        schedule_stripe_price_id: null,
        schedule_fk_plan_id: null,
        schedule_period: null,
        schedule_type: null,
      },
      ncMeta,
    );

    return canceled.id;
  }

  async getCheckoutSession(workspaceOrOrgId: string, sessionId: string) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError.notImplemented('Internal customer not supported');
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      NcError.genericNotFound('Checkout session', sessionId);
    }

    if (session.invoice) {
      const invoice = await stripe.invoices.retrieve(session.invoice as string);

      Object.assign(session, {
        invoice,
      });
    }

    return session;
  }

  async getCustomerPortal(
    workspaceOrOrgId: string,
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError.notImplemented('Internal customer not supported');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: workspaceOrOrg.stripe_customer_id,
      return_url: `${req.ncSiteUrl}?afterManage=true&workspaceId=${
        workspaceOrOrg.id
      }&isAccountPage=${req.query.isAccountPage ?? true}`,
    });

    return session;
  }

  async getSeatCount(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.entity === 'workspace') {
      return (
        await Subscription.calculateWorkspaceSeatCount(
          workspaceOrOrg.id,
          ncMeta,
        )
      ).seatCount;
    }

    return Subscription.calculateOrgSeatCount(workspaceOrOrg.id, ncMeta);
  }

  async getNextInvoice(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    try {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

      if (!workspaceOrOrg) {
        NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
      }

      if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
        return;
      }

      const subscription = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrg.id,
        ncMeta,
      );

      if (!subscription) {
        NcError.genericNotFound('Subscription', workspaceOrOrgId);
      }

      let invoice;

      if (subscription.schedule_stripe_price_id) {
        invoice = await stripe.invoices.createPreview({
          subscription_details: {
            items: [
              {
                price: subscription.schedule_stripe_price_id,
                quantity: subscription.seat_count,
              },
            ],
            start_date: dayjs(subscription.schedule_phase_start).unix(),
          },
        });
      } else {
        invoice = await stripe.invoices.createPreview({
          customer: workspaceOrOrg.stripe_customer_id,
          subscription: subscription.stripe_subscription_id,
        });
      }

      return invoice;
    } catch (err) {
      this.logger.error(
        `Error getting next invoice for workspace or org ${workspaceOrOrgId}:`,
      );
      this.logger.error(err);
    }
  }

  async listInvoice(
    workspaceOrOrgId: string,
    options: {
      starting_after?: string;
      ending_before?: string;
    } = {},
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return { data: [] };
    }

    const invoices = await stripe.invoices.list({
      customer: workspaceOrOrg.stripe_customer_id,
      limit: 10,
      starting_after: options.starting_after,
      ending_before: options.ending_before,
    });

    if (!invoices) {
      NcError.genericNotFound('Invoices', workspaceOrOrgId);
    }

    return invoices;
  }

  async updateNextInvoice(
    subscriptionId: string,
    invoice: Stripe.Response<Stripe.UpcomingInvoice>,
    ncMeta = Noco.ncMeta,
  ) {
    try {
      if (invoice) {
        await Subscription.update(
          subscriptionId,
          {
            upcoming_invoice_at: dayjs
              .unix(invoice.period_end)
              .utc()
              .toISOString(),
            upcoming_invoice_due_at: dayjs
              .unix(invoice.next_payment_attempt || invoice.due_date)
              .utc()
              .toISOString(),
            upcoming_invoice_amount: invoice.amount_due,
            upcoming_invoice_currency: invoice.currency,
          },
          ncMeta,
        );
      } else {
        await Subscription.update(
          subscriptionId,
          {
            upcoming_invoice_at: null,
            upcoming_invoice_due_at: null,
            upcoming_invoice_amount: null,
            upcoming_invoice_currency: null,
          },
          ncMeta,
        );
      }
    } catch (err) {
      this.logger.error(
        `Error updating next invoice for subscription ${subscriptionId}:`,
      );
      this.logger.error(err);
    }
  }

  async recoverSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      NcError.notImplemented('Internal customer not supported');
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existingSubscription) {
      const stripeSubscription = await stripe.subscriptions.retrieve(
        existingSubscription.stripe_subscription_id,
      );

      if (!stripeSubscription) {
        NcError.genericNotFound(
          'Stripe subscription',
          existingSubscription.stripe_subscription_id,
        );
      }

      if (
        workspaceOrOrg.entity === 'workspace' &&
        stripeSubscription.metadata.fk_workspace_id !== workspaceOrOrgId
      ) {
        throw new Error('Subscription does not belong to the workspace');
      }

      if (
        workspaceOrOrg.entity === 'org' &&
        stripeSubscription.metadata.fk_org_id !== workspaceOrOrgId
      ) {
        throw new Error('Subscription does not belong to the org');
      }

      await Subscription.update(existingSubscription.id, {
        stripe_price_id: stripeSubscription.items.data[0].price.id,
        seat_count: stripeSubscription.items.data[0].quantity,
        fk_plan_id: stripeSubscription.metadata.fk_plan_id,
        stripe_subscription_id: stripeSubscription.id,
        fk_workspace_id: stripeSubscription.metadata.fk_workspace_id || null,
        fk_org_id: stripeSubscription.metadata.fk_org_id || null,
        status: stripeSubscription.status,
        canceled_at: stripeSubscription.canceled_at
          ? dayjs.unix(stripeSubscription.canceled_at).utc().toISOString()
          : null,
        start_at: dayjs.unix(stripeSubscription.start_date).utc().toISOString(),
        period: stripeSubscription.items.data[0].price.recurring.interval,
        billing_cycle_anchor: dayjs
          .unix(stripeSubscription.billing_cycle_anchor)
          .utc()
          .toISOString(),
      });

      if (stripeSubscription.status === 'active') {
        await this.updateNextInvoice(
          existingSubscription.id,
          await this.getNextInvoice(workspaceOrOrg.id),
          ncMeta,
        );
      }

      return existingSubscription;
    }

    const stripeCustomer = await stripe.customers.retrieve(
      workspaceOrOrg.stripe_customer_id,
    );

    if (!stripeCustomer) {
      NcError.genericNotFound(
        'Stripe customer',
        workspaceOrOrg.stripe_customer_id,
      );
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
    });

    if (!subscriptions.data.length) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const subscriptionData = subscriptions.data.find(
      (s) =>
        ((s.metadata.fk_org_id && s.metadata.fk_org_id === workspaceOrOrg.id) ||
          (s.metadata.fk_workspace_id &&
            s.metadata.fk_workspace_id === workspaceOrOrg.id)) &&
        ['active', 'trialing', 'incomplete'].includes(s.status),
    );

    if (!subscriptionData) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const plan = await Plan.get(
      subscriptionData.metadata.fk_plan_id,
      ncMeta,
      true,
    );

    if (!plan) {
      NcError.genericNotFound('Plan', subscriptionData.metadata.fk_plan_id);
    }

    const price = plan.prices.find(
      (p) => p.id === subscriptionData.items.data[0].price.id,
    );

    if (!price) {
      NcError.genericNotFound('Price', subscriptionData.items.data[0].price.id);
    }

    const subscription = await Subscription.insert({
      fk_workspace_id:
        workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
      fk_org_id: workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
      fk_plan_id: plan.id,
      stripe_subscription_id: subscriptionData.id,
      stripe_price_id: price.id,
      seat_count: subscriptionData.items.data[0].quantity,
      status: subscriptionData.status,
      start_at: dayjs.unix(subscriptionData.start_date).utc().toISOString(),
      period: price.recurring.interval,
      billing_cycle_anchor: dayjs
        .unix(subscriptionData.billing_cycle_anchor)
        .utc()
        .toISOString(),
    });

    await this.migrateDb(workspaceOrOrg.id, ncMeta);

    if (subscriptionData.status === 'active') {
      await this.updateNextInvoice(
        subscription.id,
        await this.getNextInvoice(workspaceOrOrg.id),
        ncMeta,
      );
    }

    this.logger.log(
      `Subscription recovered for workspace or org ${workspaceOrOrg.id}`,
    );

    return subscription;
  }

  async schedulePlanChange(
    workspaceOrOrgId: string,
    newPrice: Stripe.Price,
    newPlan: Plan,
    options: {
      scheduleType: 'year' | 'next';
    } = {
      scheduleType: 'next',
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { scheduleType } = options;

    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existing) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const stripeSub = await stripe.subscriptions.retrieve(
      existing.stripe_subscription_id,
    );
    if (!stripeSub)
      NcError.genericNotFound(
        'Stripe subscription',
        existing.stripe_subscription_id,
      );

    let scheduleId = existing.stripe_schedule_id;
    let sched: Stripe.SubscriptionSchedule | null = null;
    if (!scheduleId) {
      sched = await stripe.subscriptionSchedules.create({
        from_subscription: stripeSub.id,
      });
      scheduleId = sched.id;
    } else {
      sched = await stripe.subscriptionSchedules.retrieve(scheduleId);

      // if the schedule is not active, we need to create a new one
      if (!['not_started', 'active'].includes(sched.status)) {
        sched = await stripe.subscriptionSchedules.create({
          from_subscription: stripeSub.id,
        });
        scheduleId = sched.id;
      }
    }

    const firstPhase = sched.phases[0];
    const existingPeriod = existing.period;

    const iterationsObject: { iterations?: number } = { iterations: 1 };
    if (scheduleType === 'year') {
      iterationsObject.iterations = existingPeriod === 'year' ? 1 : 12;
    }

    const preservedPhase = {
      start_date: firstPhase.start_date,
      items: firstPhase.items.map((item) => ({
        price: typeof item.price === 'string' ? item.price : item.price.id,
        quantity: existing.seat_count,
      })),
      ...iterationsObject,
    };

    const changePhase = {
      items: [{ price: newPrice.id, quantity: existing.seat_count }],
      metadata: {
        ...(stripeSub.metadata.fk_workspace_id && {
          fk_workspace_id: stripeSub.metadata.fk_workspace_id,
        }),
        ...(stripeSub.metadata.fk_org_id && {
          fk_org_id: stripeSub.metadata.fk_org_id,
        }),
        fk_user_id: stripeSub.metadata.fk_user_id,
        fk_plan_id: newPlan.id,
        plan_title: newPlan.title,
        period: newPrice.recurring.interval,
      },
    };

    const newSchedule = await stripe.subscriptionSchedules.update(scheduleId, {
      phases: [preservedPhase, changePhase],
      end_behavior: 'release',
      metadata: {
        schedule_type: scheduleType,
      },
    });

    const lastPhase = newSchedule.phases[newSchedule.phases.length - 1];

    await Subscription.update(
      existing.id,
      {
        stripe_schedule_id: scheduleId,
        schedule_phase_start: dayjs
          .unix(lastPhase.start_date)
          .utc()
          .toISOString(),
        schedule_stripe_price_id: newPrice.id,
        schedule_fk_plan_id: newPlan.id,
        schedule_period: newPrice.recurring.interval,
        schedule_type: scheduleType,
      },
      ncMeta,
    );

    await this.updateNextInvoice(
      existing.id,
      await this.getNextInvoice(workspaceOrOrgId, ncMeta),
      ncMeta,
    );
  }

  async scheduleLoyaltyDowngrade(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existing) NcError.genericNotFound('Subscription', workspaceOrOrgId);

    const plan = await Plan.get(existing.fk_plan_id, ncMeta, true);
    if (!plan) NcError.genericNotFound('Plan', existing.fk_plan_id);

    // find the loyalty vs. normal pair
    const loyaltyPrice = plan.prices.find(
      (p) => p.id === existing.stripe_price_id,
    );
    const normalPrice = plan.prices.find(
      (p) =>
        p.lookup_key ===
        LoyaltyPriceReverseLookupKeyMap[loyaltyPrice.lookup_key],
    );

    if (!loyaltyPrice || !normalPrice) {
      this.logger.log(`No loyalty/normal pair found for plan ${plan.id}`);
      return;
    }

    await this.schedulePlanChange(
      workspaceOrOrgId,
      normalPrice,
      plan,
      {
        scheduleType: 'year',
      },
      ncMeta,
    );
  }

  async clearScheduledDowngrade(
    workspaceOrOrgId: string,
    release = true,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    if (workspaceOrOrg.stripe_customer_id === NOCODB_INTERNAL) {
      return;
    }

    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    try {
      if (existing?.stripe_schedule_id && release) {
        await stripe.subscriptionSchedules.release(existing.stripe_schedule_id);
      }
    } catch (err) {
      this.logger.error(
        `Error clearing scheduled downgrade for workspace or org ${workspaceOrOrgId}: ${err.message}`,
      );
    }

    const existingPlan = await Plan.get(existing.fk_plan_id, ncMeta, true);

    const existingPrice = existingPlan.prices.find(
      (p) => p.id === existing.stripe_price_id,
    );

    if (existingPrice?.lookup_key.includes('loyalty')) {
      await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, ncMeta);
    } else {
      await Subscription.update(
        existing.id,
        {
          stripe_schedule_id: null,
          schedule_phase_start: null,
          schedule_stripe_price_id: null,
          schedule_fk_plan_id: null,
          schedule_period: null,
          schedule_type: null,
        },
        ncMeta,
      );
    }
  }

  async migrateDb(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    try {
      const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);
      if (!workspaceOrOrg)
        NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

      const subRec = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );
      if (!subRec) NcError.genericNotFound('Subscription', workspaceOrOrgId);

      const plan = await Plan.get(subRec.fk_plan_id, ncMeta);
      if (!plan) NcError.genericNotFound('Plan', subRec.fk_plan_id);

      await this.nocoJobsService.add(JobTypes.CloudDbMigrate, {
        workspaceOrOrgId,
        conditions:
          workspaceOrOrg.entity === 'org'
            ? {
                fk_org_id: workspaceOrOrg.id,
              }
            : {
                plan: plan.title,
              },
        oldDbServerId: workspaceOrOrg.fk_db_instance_id,
      });
    } catch (err) {
      this.telemetryService.sendSystemEvent({
        event_type: 'priority_error',
        error_trigger: 'migrateDb',
        error_type: err?.name,
        message: err?.message,
        error_details: err?.stack,
        affected_resources: [workspaceOrOrgId],
      });
    }
  }

  async requestUpgrade(
    workspaceOrOrgId: string,
    payload: {
      limitOrFeature: PlanLimitTypes | PlanFeatureTypes;
    },
    req: NcRequest,
  ) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const requester = req.user?.id
      ? req.user
      : {
          display_name: 'Anonymous',
        };

    if (!req.user?.id) {
      const requestedAt = await NocoCache.get(
        `requestUpgrade:${workspaceOrOrgId}`,
        CacheGetType.TYPE_STRING,
      );

      if (requestedAt) {
        const requestedAtTime = dayjs(requestedAt);
        const now = dayjs();

        if (requestedAtTime.isAfter(now.subtract(1, 'hour'))) {
          return true;
        }
      } else {
        await NocoCache.set(
          `requestUpgrade:${workspaceOrOrgId}`,
          dayjs().toISOString(),
        );
      }
    } else {
      // check if the user part of the workspace or org
      const user = await WorkspaceUser.get(workspaceOrOrgId, req.user.id);

      if (!user) {
        NcError.workspaceNotFound(workspaceOrOrgId);
      }
    }

    if (workspaceOrOrg.entity === 'workspace') {
      const workspace = workspaceOrOrg as Workspace;

      const owners = await WorkspaceUser.userList({
        fk_workspace_id: workspace.id,
        roles: WorkspaceUserRoles.OWNER,
      });

      if (!owners.length) {
        NcError.genericNotFound('Owners', workspace.id);
      }

      for (const owner of owners) {
        this.appHooksService.emit(AppEvents.WORKSPACE_UPGRADE_REQUEST, {
          context: {
            workspace_id: workspace.id,
            base_id: undefined,
          },
          workspace,
          requester,
          user: owner,
          limitOrFeature: payload.limitOrFeature,
          req,
        });
      }

      await this.telemetryService.sendSystemEvent({
        event_type: 'payment_alert',
        payment_type: 'upgrade_requested',
        message: `Upgrade requested for ${workspace.title} ${getUpgradeMessage(
          payload.limitOrFeature,
        )}`,
        user: req.user ? { id: req.user.id, email: req.user.email } : undefined,
        workspace: { id: workspace.id, title: workspace.title },
        extra: {
          limit_or_feature: payload.limitOrFeature,
          requester_type: req.user?.id ? 'authenticated' : 'anonymous',
          requester_name: requester.display_name || 'Unknown',
          owner_count: owners.length,
        },
      });
    }

    return true;
  }

  async handleWebhook(req: NcRequest): Promise<void> {
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.NC_STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      this.logger.error('⚠️  Webhook signature verification failed:', err);
      return;
    }

    const obj = event.data.object as Stripe.Invoice | Stripe.Subscription;

    try {
      switch (event.type) {
        case 'invoice.paid': {
          const invoiceObj = obj as Stripe.Invoice;

          const subscriptionId =
            typeof invoiceObj.parent.subscription_details.subscription ===
            'string'
              ? invoiceObj.parent.subscription_details.subscription
              : invoiceObj.parent.subscription_details.subscription?.id || '';

          let subRec: Subscription;
          let attempt = 0;

          // Retry as subscription sometimes takes a while to be created
          while (attempt < 10) {
            subRec = await Subscription.getByStripeSubscriptionId(
              subscriptionId,
            );
            if (subRec) break;
            attempt++;
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }

          if (!subRec) NcError.genericNotFound('Subscription', subscriptionId);

          const workspaceOrOrgId = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );

          this.migrateDb(workspaceOrOrgId).catch(() => {});

          await this.updateNextInvoice(
            subRec.id,
            await this.getNextInvoice(workspaceOrOrgId),
          );

          if (workspaceOrOrg) {
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'payment_succeeded',
              message: `Payment successful for ${workspaceOrOrg.title}`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
              extra: {
                subscription_id: subRec.id,
                stripe_subscription_id: subRec.stripe_subscription_id,
                invoice_id: (obj as Stripe.Invoice).id,
                amount_paid: (obj as Stripe.Invoice).amount_paid,
              },
            });
          }

          this.logger.log(
            `Invoice paid; next invoice scheduled for subscription ${subRec.id}`,
          );
          break;
        }

        case 'invoice.payment_failed': {
          const invoiceObj = obj as Stripe.Invoice;

          const subscriptionId =
            typeof invoiceObj.parent.subscription_details.subscription ===
            'string'
              ? invoiceObj.parent.subscription_details.subscription
              : invoiceObj.parent.subscription_details.subscription?.id || '';

          const subRec = await Subscription.getByStripeSubscriptionId(
            subscriptionId,
          );
          if (!subRec) NcError.genericNotFound('Subscription', subscriptionId);

          const wid = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(wid, Noco.ncMeta);

          // Send upgrade_failed notification for payment failure
          if (workspaceOrOrg) {
            await this.telemetryService.sendSystemEvent({
              event_type: 'payment_alert',
              payment_type: 'payment_failed',
              message: `Payment failed for ${workspaceOrOrg.title}. No plan applied.`,
              workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
              extra: {
                subscription_id: subRec.id,
                stripe_subscription_id: subRec.stripe_subscription_id,
                invoice_id: (obj as Stripe.Invoice).id,
                failure_reason:
                  (obj as Stripe.Invoice).last_finalization_error?.message ||
                  'Payment failed',
              },
            });
          }

          this.logger.log(`Payment failed for ${wid}. No plan applied.`);
          break;
        }

        case 'customer.subscription.created': {
          const stripeSub = obj as Stripe.Subscription;
          const planId = stripeSub.metadata.fk_plan_id;

          const workspaceOrOrgId =
            stripeSub.metadata.fk_org_id || stripeSub.metadata.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );
          if (!workspaceOrOrg)
            NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

          const price = stripeSub.items.data[0].price;
          const period = price.recurring.interval;
          const seatCount = stripeSub.items.data[0].quantity;

          // Insert new subscription record
          const subRec = await Subscription.insert({
            fk_user_id: stripeSub.metadata.fk_user_id,
            fk_workspace_id:
              workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
            fk_org_id:
              workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
            fk_plan_id: planId,
            stripe_subscription_id: stripeSub.id,
            stripe_price_id: price.id,
            seat_count: seatCount,
            status: stripeSub.status,
            start_at: dayjs.unix(stripeSub.start_date).utc().toISOString(),
            period,
            billing_cycle_anchor: dayjs
              .unix(stripeSub.billing_cycle_anchor)
              .utc()
              .toISOString(),
          });

          await this.telemetryService.sendSystemEvent({
            event_type: 'payment_alert',
            payment_type: 'subscription_created',
            message: `Subscription created for ${workspaceOrOrg.title} (${stripeSub.metadata.plan_title})`,
            workspace: { id: workspaceOrOrg.id, title: workspaceOrOrg.title },
            extra: {
              subscription_id: subRec.id,
              stripe_subscription_id: stripeSub.id,
              plan_title: stripeSub.metadata.plan_title,
              seat_count: seatCount,
              period,
              price_id: price.id,
            },
          });

          // mark loyalty used if applicable
          if (
            workspaceOrOrg.entity === 'workspace' &&
            workspaceOrOrg.loyal &&
            !workspaceOrOrg.loyalty_discount_used
          ) {
            await Workspace.update(workspaceOrOrg.id, {
              loyalty_discount_used: true,
            });
          }

          // schedule loyalty downgrade if this was a loyalty price
          if (price.lookup_key.includes('loyalty')) {
            await this.scheduleLoyaltyDowngrade(workspaceOrOrgId);
          } else {
            await this.updateNextInvoice(
              subRec.id,
              await this.getNextInvoice(workspaceOrOrgId),
            );
          }

          if (workspaceOrOrg.entity === 'workspace') {
            const workspace = await Workspace.get(workspaceOrOrg.id);

            NocoSocket.broadcastEventToWorkspaceUsers(
              { workspace_id: workspaceOrOrg.id, base_id: null },
              {
                event: EventType.USER_EVENT,
                payload: {
                  action: 'workspace_update',
                  payload: workspace,
                },
              },
            );
          }
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const stripeSub = obj as Stripe.Subscription;
          const subRec = await Subscription.getByStripeSubscriptionId(
            stripeSub.id,
          );
          if (!subRec) NcError.genericNotFound('Subscription', stripeSub.id);

          const workspaceOrOrgId = subRec.fk_org_id || subRec.fk_workspace_id;
          const workspaceOrOrg = await getWorkspaceOrOrg(
            workspaceOrOrgId,
            Noco.ncMeta,
          );
          if (!workspaceOrOrg)
            NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

          const price = stripeSub.items.data[0].price;
          const period = price.recurring?.interval || subRec.period;
          const seatCount = stripeSub.items.data[0].quantity;

          // update core subscription fields
          await Subscription.update(
            subRec.id,
            {
              stripe_price_id: price.id,
              seat_count: seatCount,
              status: stripeSub.status,
              start_at: dayjs.unix(stripeSub.start_date).utc().toISOString(),
              canceled_at: stripeSub.cancel_at
                ? dayjs.unix(stripeSub.cancel_at).utc().toISOString()
                : null,
              fk_plan_id: stripeSub.metadata.fk_plan_id,
              billing_cycle_anchor: dayjs
                .unix(stripeSub.billing_cycle_anchor)
                .utc()
                .toISOString(),
              period,
            },
            Noco.ncMeta,
          );

          // if they just moved onto a loyalty price again
          if (
            workspaceOrOrg.entity === 'workspace' &&
            workspaceOrOrg.loyal &&
            price.lookup_key.includes('loyalty') &&
            !workspaceOrOrg.loyalty_discount_used
          ) {
            await Workspace.update(workspaceOrOrg.id, {
              loyalty_discount_used: true,
            });
            await this.scheduleLoyaltyDowngrade(workspaceOrOrgId, Noco.ncMeta);
          }

          // refresh next invoice
          if (!stripeSub.cancel_at) {
            await this.updateNextInvoice(
              subRec.id,
              await this.getNextInvoice(workspaceOrOrgId),
            );
          }

          if (workspaceOrOrg.entity === 'workspace') {
            const workspace = await Workspace.get(workspaceOrOrg.id);

            NocoSocket.broadcastEventToWorkspaceUsers(
              { workspace_id: workspaceOrOrg.id, base_id: null },
              {
                event: EventType.USER_EVENT,
                payload: {
                  action: 'workspace_update',
                  payload: workspace,
                },
              },
            );
          }

          this.logger.log(
            `Subscription ${event.type} processed for ${workspaceOrOrgId}.`,
          );
          break;
        }

        case 'subscription_schedule.updated': {
          const sched = event.data.object as Stripe.SubscriptionSchedule;
          const subRec = await Subscription.getByStripeSubscriptionId(
            sched.subscription as string,
          );
          if (!subRec) {
            this.logger.warn(`No subscription found for schedule ${sched.id}`);
            break;
          }

          const now = dayjs().unix();
          const nextPhase =
            sched.phases.find((p) => p.start_date > now) ||
            sched.phases[sched.phases.length - 1];

          if (nextPhase) {
            const item = nextPhase.items[0] as any;
            await Subscription.update(
              subRec.id,
              {
                schedule_phase_start: dayjs
                  .unix(nextPhase.start_date)
                  .utc()
                  .toISOString(),

                schedule_stripe_price_id: item.price,
                schedule_period: nextPhase.metadata.period,
                schedule_fk_plan_id: nextPhase.metadata.fk_plan_id,
                schedule_type: sched.metadata.schedule_type as 'year' | 'next',
              },
              Noco.ncMeta,
            );
          }
          break;
        }

        case 'subscription_schedule.canceled':
        case 'subscription_schedule.released':
        case 'subscription_schedule.completed': {
          const sched = event.data.object as Stripe.SubscriptionSchedule;
          const subRec = await Subscription.getByStripeSubscriptionId(
            sched.subscription as string,
          );
          if (!subRec) {
            this.logger.warn(`No Subscription found for schedule ${sched.id}`);
            break;
          }
          await this.clearScheduledDowngrade(
            subRec.fk_org_id || subRec.fk_workspace_id,
            false,
          );
          break;
        }

        default:
          this.logger.warn(`Unhandled event type ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling webhook ${event.type}`);
      console.error(err);
      throw err;
    }
  }
}
