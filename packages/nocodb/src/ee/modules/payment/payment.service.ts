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
      throw new Error('Plan not found');
    }

    const price = plan.prices.find((p) => p.id === price_id);

    if (!price) {
      throw new Error('Price not found');
    }

    if (workspaceOrOrg.stripe_customer_id) {
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
        },
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

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);

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

    const item = subscription.items.data[0];

    const updatedSubscription = await stripe.subscriptions.update(
      existingSubscription.stripe_subscription_id,
      {
        items: [
          {
            id: item.id,
            price: payload.price_id,
            quantity: payload.seat,
          },
        ],
        cancel_at_period_end: false,
        expand: ['latest_invoice.payment_intent'],
        ...(existingSubscription.period === 'year'
          ? {
              proration_behavior: 'always_invoice',
            }
          : {}),
        metadata: {
          ...subscription.metadata,
          fk_plan_id: payload.plan_id,
        },
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

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);

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
        ...(existingSubscription.period === 'year'
          ? {
              proration_behavior: 'always_invoice',
            }
          : {}),
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

    const canceledSubscription = await stripe.subscriptions.update(
      existingSubscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      },
    );

    await Subscription.update(existingSubscription.id, {
      status: canceledSubscription.status,
      end_at: dayjs
        .unix(canceledSubscription.current_period_end)
        .utc()
        .toISOString(),
    });

    return canceledSubscription.id;
  }

  async getCheckoutSession(_workspaceOrOrgId: string, sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return session;
  }

  async getCustomerPortal(
    workspaceOrOrgId: string,
    req: NcRequest,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceOrOrg = await this.getWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
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
    const workspaceOrOrg = await this.getWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (workspaceOrOrg.entity === 'workspace') {
      return Subscription.calculateWorkspaceSeatCount(
        workspaceOrOrg.id,
        ncMeta,
      );
    }

    return Subscription.calculateOrgSeatCount(workspaceOrOrg.id, ncMeta);
  }

  async getNextInvoice(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    try {
      const workspaceOrOrg = await this.getWorkspaceOrOrg(
        workspaceOrOrgId,
        ncMeta,
      );

      if (!workspaceOrOrg) {
        NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
      }

      const subscription = await Subscription.getByWorkspaceOrOrg(
        workspaceOrOrg.id,
        ncMeta,
      );

      if (!subscription) {
        NcError.genericNotFound('Subscription', workspaceOrOrgId);
      }

      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: workspaceOrOrg.stripe_customer_id,
        subscription: subscription.stripe_subscription_id,
      });

      return invoice;
    } catch (err) {
      this.logger.error(
        `Error getting next invoice for workspace or org ${workspaceOrOrgId}:`,
      );
      this.logger.error(err);
    }
  }

  async updateNextInvoice(
    subscriptionId: string,
    invoice: Stripe.Response<Stripe.UpcomingInvoice>,
  ) {
    try {
      await Subscription.update(subscriptionId, {
        next_invoice_at: dayjs.unix(invoice.period_end).utc().toISOString(),
        next_invoice_due_at: dayjs
          .unix(invoice.next_payment_attempt || invoice.due_date)
          .utc()
          .toISOString(),
        next_invoice_amount: invoice.amount_due,
        next_invoice_currency: invoice.currency,
      });
    } catch (err) {
      this.logger.error(
        `Error updating next invoice for subscription ${subscriptionId}:`,
      );
      this.logger.error(err);
    }
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

          if (subscription.fk_workspace_id) {
            const workspaceId = subscription.fk_workspace_id;

            await this.updateNextInvoice(
              subscription.id,
              await this.getNextInvoice(workspaceId),
            );

            await Workspace.refreshPlanAndSubscription(workspaceId);

            this.logger.log(
              `Plan applied for workspace ${workspaceId} after successful payment`,
            );
          } else if (subscription.fk_org_id) {
            this.logger.log(
              `Org plans are not supported yet. Subscription ${subscriptionId} is for an org`,
            );
          }
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
          break;
        }

        case 'customer.subscription.created': {
          const subscription = dataObject as Stripe.Subscription;
          const plan_id = subscription.metadata.fk_plan_id;

          const workspaceOrOrgId =
            subscription.metadata.fk_workspace_id ||
            subscription.metadata.fk_org_id;

          const workspaceOrOrg = await this.getWorkspaceOrOrg(workspaceOrOrgId);

          const price = subscription.items.data[0].price;

          const period = price.recurring.interval;

          await Subscription.insert({
            fk_workspace_id:
              workspaceOrOrg.entity === 'workspace' ? workspaceOrOrg.id : null,
            fk_org_id:
              workspaceOrOrg.entity === 'org' ? workspaceOrOrg.id : null,
            fk_plan_id: plan_id,
            stripe_subscription_id: subscription.id,
            stripe_price_id: price.id,
            seat_count: subscription.items.data[0].quantity,
            status: subscription.status,
            start_at: dayjs.unix(subscription.start_date).utc().toISOString(),
            period,
          });

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

          const plan_id = dataObject.metadata.fk_plan_id;

          const nextInvoice = await this.getNextInvoice(
            subscription.fk_workspace_id,
            Noco.ncMeta,
          );

          await Subscription.update(subscription.id, {
            stripe_subscription_id: dataObject.id,
            stripe_price_id: dataObject.items.data[0].price.id,
            seat_count: dataObject.items.data[0].quantity,
            status: dataObject.status,
            start_at: dayjs.unix(dataObject.start_date).utc().toISOString(),
            end_at: dataObject.cancel_at
              ? dayjs.unix(dataObject.cancel_at).utc().toISOString()
              : null,
            fk_plan_id: plan_id,
            period: dataObject.items.data[0].price.recurring
              ? dataObject.items.data[0].price.recurring.interval
              : subscription.period,
            ...(nextInvoice
              ? {
                  next_invoice_at: dayjs
                    .unix(nextInvoice.period_end)
                    .utc()
                    .toISOString(),
                  next_invoice_due_at: dayjs
                    .unix(
                      nextInvoice.next_payment_attempt || nextInvoice.due_date,
                    )
                    .utc()
                    .toISOString(),
                  next_invoice_amount: nextInvoice.amount_due,
                  next_invoice_currency: nextInvoice.currency,
                }
              : {}),
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
