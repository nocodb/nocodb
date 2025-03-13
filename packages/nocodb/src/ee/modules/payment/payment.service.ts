import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import type { NcRequest } from 'nocodb-sdk';
import { Org, Plan, Subscription, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder');

@Injectable()
export class PaymentService {
  logger = new Logger('PaymentService');

  constructor() {}

  async getPlans(active = true) {
    const plans = await Plan.list();

    return plans.filter((plan) => !active || plan.is_active === active);
  }

  async getWorkspaceOrOrg(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<
    (Workspace & { entity: 'workspace' }) | (Org & { entity: 'org' })
  > {
    const workspace = await Workspace.get(workspaceOrOrgId, null, ncMeta);

    if (workspace) {
      return { ...workspace, entity: 'workspace' };
    }

    const org = await Org.get(workspaceOrOrgId, ncMeta);

    if (org) {
      return { ...org, entity: 'org' };
    }
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
      throw new Error('Product not found');
    }

    const { name: title, description, metadata } = product;

    // get the prices for the product
    const prices = await stripe.prices.list({
      product: payload.stripe_product_id,
      active: true,
    });

    if (!prices.data.length) {
      throw new Error('No prices found for the product');
    }

    const plan = {
      title,
      description,
      stripe_product_id: payload.stripe_product_id,
      is_active: payload.is_active || true,
      prices: prices.data.map((price) => price),
      meta: metadata,
    };

    return await Plan.insert(plan);
  }

  async syncPlan(planId: string) {
    const plan = await Plan.get(planId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const product = await stripe.products.retrieve(plan.stripe_product_id);

    if (!product) {
      throw new Error('Product not found');
    }

    const { name: title, description, metadata } = product;

    // get the prices for the product
    const prices = await stripe.prices.list({
      product: plan.stripe_product_id,
      active: true,
    });

    if (!prices.data.length) {
      throw new Error('No prices found for the product');
    }

    Object.assign(plan, {
      title,
      description,
      prices: prices.data.map((price) => price),
      meta: metadata,
      // Activate the plan on sync
      is_active: true,
    });

    return await Plan.update(plan.id, plan);
  }

  async disablePlan(planId: string) {
    const plan = await Plan.get(planId);

    if (!plan) {
      throw new Error('Plan not found');
    }

    return await Plan.update(plan.id, { is_active: false });
  }

  async createSubscription(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const { seat, plan_id, price_id } = payload;
    const { user } = req;

    if (!seat || !plan_id || !price_id) {
      throw new Error('Invalid payload');
    }

    const workspaceOrOrg = await this.getWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existingSubscription) {
      throw new Error('Subscription already exists');
    }

    const seatCount = await existingSubscription.getSeatCount(ncMeta);

    if (seatCount !== seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          ...(workspaceOrOrg.entity === 'workspace'
            ? { fk_workspace_id: workspaceOrOrg.id }
            : { fk_org_id: workspaceOrOrg.id }),
          fk_user_id: user.id,
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

    const plan = await Plan.get(plan_id, ncMeta);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = plan.prices.find((p) => p.id === price_id);

    if (!price) {
      throw new Error('Price not found');
    }

    const subscription = await stripe.subscriptions.create({
      customer: workspaceOrOrg.stripe_customer_id,
      items: [
        {
          price: price_id,
          quantity: seat,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
      metadata: {
        ...(workspaceOrOrg.entity === 'workspace'
          ? { fk_workspace_id: workspaceOrOrg.id }
          : { fk_org_id: workspaceOrOrg.id }),
        fk_plan_id: plan_id,
      },
    });

    await Subscription.insert({
      fk_workspace_id:
        workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
      fk_org_id: workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
      fk_plan_id: plan_id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: price_id,
      seat_count: seat,
      status: 'incomplete',
      start_at: dayjs.unix(subscription.start_date).utc().toISOString(),
    });

    if (subscription.pending_setup_intent !== null) {
      return {
        type: 'setup',
        id: subscription.id,
        clientSecret: (
          (subscription.latest_invoice as Stripe.Invoice)
            ?.payment_intent as Stripe.PaymentIntent
        )?.client_secret,
      };
    } else {
      return {
        type: 'payment',
        id: subscription.id,
        clientSecret: (
          (subscription.latest_invoice as Stripe.Invoice)
            ?.payment_intent as Stripe.PaymentIntent
        )?.client_secret,
      };
    }
  }

  async updateSubscription(
    workspaceOrOrgId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    req?: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await this.getWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!existingSubscription) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const seatCount = await existingSubscription.getSeatCount(ncMeta);

    if (seatCount !== payload.seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      throw new Error('Payment intent not found');
    }

    if (
      workspaceOrOrg.entity === 'workspace' &&
      subscription.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the workspace');
    }

    if (
      workspaceOrOrg.entity === 'org' &&
      subscription.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the org');
    }

    const plan = await Plan.get(payload.plan_id, ncMeta);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = plan.prices.find((p) => p.id === payload.price_id);

    if (!price) {
      throw new Error('Price not found');
    }

    const updatedSubscription = await stripe.subscriptions.update(
      existingSubscription.stripe_subscription_id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: payload.price_id,
            quantity: payload.seat,
          },
        ],
        expand: ['latest_invoice.payment_intent'],
      },
    );

    return {
      id: updatedSubscription.id,
    };
  }

  async reseatSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    // If subscription does not exist
    if (!existingSubscription) {
      return;
    }

    const seatCount = await existingSubscription.getSeatCount(ncMeta);

    if (existingSubscription.seat_count === seatCount) {
      return;
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      throw new Error('Payment intent not found');
    }

    if (
      subscription.metadata.fk_org_id &&
      subscription.metadata.fk_org_id !== existingSubscription.fk_org_id
    ) {
      throw new Error('Subscription does not belong to the org');
    }

    if (
      subscription.metadata.fk_workspace_id &&
      subscription.metadata.fk_workspace_id !==
        existingSubscription.fk_workspace_id
    ) {
      throw new Error('Subscription does not belong to the workspace');
    }

    const plan = await Plan.get(existingSubscription.fk_plan_id, ncMeta);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = plan.prices.find(
      (p) => p.id === existingSubscription.stripe_price_id,
    );

    if (!price) {
      throw new Error('Price not found');
    }

    await stripe.subscriptions.update(
      existingSubscription.stripe_subscription_id,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: existingSubscription.stripe_price_id,
            quantity: seatCount,
          },
        ],
        expand: ['latest_invoice.payment_intent'],
      },
    );

    return;
  }

  async cancelSubscription(
    workspaceOrOrgId: string,
    req?: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await this.getWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!existingSubscription) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    if (
      workspaceOrOrg.entity === 'workspace' &&
      subscription.metadata.fk_workspace_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the workspace');
    }

    if (
      workspaceOrOrg.entity === 'org' &&
      subscription.metadata.fk_org_id !== workspaceOrOrgId
    ) {
      throw new Error('Subscription does not belong to the org');
    }

    const canceledSubscription = await stripe.subscriptions.cancel(
      existingSubscription.stripe_subscription_id,
    );

    return canceledSubscription.id;
  }

  async getSeatCount(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const existingSubscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!existingSubscription) {
      return 0;
    }

    return await existingSubscription.getSeatCount(ncMeta);
  }

  async handleWebhook(req: NcRequest): Promise<void> {
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.NC_STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      this.logger.error(`⚠️  Webhook signature verification failed:`);
      this.logger.error(err);
      return;
    }

    const dataObject = event.data.object;

    try {
      switch (event.type) {
        case 'invoice.paid': {
          const subscriptionId = dataObject.subscription;
          const subscription = await Subscription.getByStripeSubscriptionId(
            subscriptionId,
          );

          if (!subscription) {
            throw new Error(`Subscription ${subscriptionId} not found`);
          }

          const workspaceId = subscription.fk_workspace_id;

          await Workspace.refreshPlanAndSubscription(workspaceId);

          this.logger.log(
            `Plan applied for workspace ${workspaceId} after successful payment`,
          );
          break;
        }

        case 'invoice.payment_failed': {
          const subscriptionId = dataObject.subscription;
          const subscription = await Subscription.getByStripeSubscriptionId(
            subscriptionId,
          );

          if (!subscription) {
            throw new Error(`Subscription ${subscriptionId} not found`);
          }

          const workspaceId = subscription.fk_workspace_id;

          await Workspace.refreshPlanAndSubscription(workspaceId);

          this.logger.log(
            `Payment failed for workspace ${workspaceId}. No plan applied`,
          );

          // Optionally notify the user or flag the workspace for limited access
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = await Subscription.getByStripeSubscriptionId(
            dataObject.id,
          );

          if (!subscription) {
            throw new Error(`Subscription ${dataObject.id} not found`);
          }

          await Subscription.update(subscription.id, {
            stripe_subscription_id: dataObject.id,
            stripe_price_id: dataObject.items.data[0].price.id,
            seat_count: dataObject.items.data[0].quantity,
            status: dataObject.status,
            start_at: dayjs.unix(dataObject.start_date).utc().toISOString(),
          });

          const workspaceId = subscription.fk_workspace_id;
          await Workspace.refreshPlanAndSubscription(workspaceId);

          this.logger.log(
            `Subscription ${event.type} processed for workspace ${workspaceId}.`,
          );
          break;
        }

        default:
          this.logger.warn(`Unhandled event type ${event.type}`);
      }
    } catch (err) {
      this.logger.error(`Error handling webhook ${event.type}:`);
      this.logger.error(err);
    }
  }
}
