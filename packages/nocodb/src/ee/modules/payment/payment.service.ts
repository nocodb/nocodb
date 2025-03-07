import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import type { NcRequest } from 'nocodb-sdk';
import { Plan, Subscription, User, Workspace } from '~/models';
import { NcError } from '~/helpers/catchError';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder');

@Injectable()
export class PaymentService {
  logger = new Logger('PaymentService');

  constructor() {}

  async getPlans(active = true) {
    const plans = await Plan.list();

    return plans.filter((plan) => !active || plan.is_active === active);
  }

  async getSeatCount(workspaceId: string, _req: NcRequest) {
    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    return {
      count: await Workspace.getSeatCount(workspaceId),
    };
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
    workspaceId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    req: NcRequest,
  ) {
    const { seat, plan_id, price_id } = payload;
    const { user } = req;

    if (!seat || !plan_id || !price_id) {
      throw new Error('Invalid payload');
    }

    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      NcError.workspaceNotFound(workspaceId);
    }

    const existingSubscription = await Subscription.getByWorkspace(workspaceId);

    if (existingSubscription) {
      throw new Error('Subscription already exists for the workspace');
    }

    const workspaceSeatCount = await Workspace.getSeatCount(workspaceId);

    if (workspaceSeatCount !== seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    if (!user.stripe_customer_id) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          id: user.id,
        },
      });

      await User.update(user.id, {
        stripe_customer_id: customer.id,
      });

      user.stripe_customer_id = customer.id;
    }

    const plan = await Plan.get(plan_id);

    if (!plan) {
      throw new Error('Plan not found');
    }

    const price = plan.prices.find((p) => p.id === price_id);

    if (!price) {
      throw new Error('Price not found');
    }

    const subscription = await stripe.subscriptions.create({
      customer: user.stripe_customer_id,
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
        fk_workspace_id: workspaceId,
        fk_user_id: user.id,
        fk_plan_id: plan_id,
      },
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
    workspaceId: string,
    payload: {
      seat: number;
      plan_id: string;
      price_id: string;
    },
    _req: NcRequest,
  ) {
    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const workspaceSeatCount = await Workspace.getSeatCount(workspaceId);

    if (workspaceSeatCount !== payload.seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    const existingSubscription = await Subscription.getByWorkspace(workspaceId);

    if (!existingSubscription) {
      throw new Error('Subscription not found');
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      throw new Error('Payment intent not found');
    }

    if (subscription.metadata.fk_workspace_id !== workspaceId) {
      throw new Error('Subscription does not belong to the workspace');
    }

    const plan = await Plan.get(payload.plan_id);

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
      clientSecret: (
        (updatedSubscription.latest_invoice as Stripe.Invoice)
          ?.payment_intent as Stripe.PaymentIntent
      )?.client_secret,
    };
  }

  async cancelSubscription(workspaceId: string, _req: NcRequest) {
    const workspace = await Workspace.get(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const existingSubscription = await Subscription.getByWorkspace(workspaceId);

    if (!existingSubscription) {
      throw new Error('Subscription not found');
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (subscription.metadata.fk_workspace_id !== workspaceId) {
      throw new Error('Subscription does not belong to the workspace');
    }

    const canceledSubscription = await stripe.subscriptions.cancel(
      existingSubscription.stripe_subscription_id,
    );

    return canceledSubscription.id;
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
        case 'customer.subscription.created': {
          const metadata = dataObject.metadata;
          if (
            !metadata?.fk_workspace_id ||
            !metadata?.fk_user_id ||
            !metadata?.fk_plan_id
          ) {
            throw new Error('Missing metadata on subscription.created');
          }

          await Subscription.insert({
            fk_workspace_id: metadata.fk_workspace_id,
            fk_plan_id: metadata.fk_plan_id,
            fk_user_id: metadata.fk_user_id,
            stripe_subscription_id: dataObject.id,
            stripe_customer_id: dataObject.customer,
            stripe_price_id: dataObject.items.data[0].price.id,
            seat_count: dataObject.items.data[0].quantity,
            status: dataObject.status,
            start_at: dayjs.unix(dataObject.start_date).utc().toISOString(),
          });

          this.logger.log(`Subscription created but plan not yet applied`);
          break;
        }

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
            stripe_customer_id: dataObject.customer,
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
