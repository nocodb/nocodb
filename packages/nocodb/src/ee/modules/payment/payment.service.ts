import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import {
  AppEvents,
  LoyaltyPriceReverseLookupKeyMap,
  PlanOrder,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { Org, Plan, Subscription, Workspace, WorkspaceUser } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import {
  calculateUnitPrice,
  getWorkspaceOrOrg,
} from '~/helpers/paymentHelpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType } from '~/utils/globals';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder');

@Injectable()
export class PaymentService {
  logger = new Logger('PaymentService');

  constructor(private readonly appHooksService: AppHooksService) {}

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

    if (!prices.data.length) {
      throw new Error('No prices found for the product');
    }

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
    const plan = await Plan.get(planId);

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

    if (!prices.data.length) {
      throw new Error('No prices found for the product');
    }

    Object.assign(plan, {
      title,
      description,
      prices: prices.data.map((price) => price),
      meta: metadata,
      is_active: payload?.is_active,
    });

    return await Plan.update(plan.id, plan);
  }

  async disablePlan(planId: string) {
    const plan = await Plan.get(planId);

    if (!plan) {
      NcError.genericNotFound('Plan', planId);
    }

    return await Plan.update(plan.id, { is_active: false });
  }

  async customerUpdate(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

    if (!workspaceOrOrg) {
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);
    }

    if (!workspaceOrOrg.stripe_customer_id) {
      NcError.genericNotFound('Customer', workspaceOrOrgId);
    }

    const customer = await stripe.customers.update(
      workspaceOrOrg.stripe_customer_id,
      {
        invoice_settings: {
          custom_fields: [
            { name: 'NocoDB Workspace ID', value: workspaceOrOrg.id },
            { name: 'NocoDB Workspace Title', value: workspaceOrOrg.title },
          ],
        },
      },
    );

    return customer;
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
            ((s.metadata.fk_workspace_id &&
              s.metadata.fk_workspace_id === workspaceOrOrg.id) ||
              (s.metadata.fk_org_id &&
                s.metadata.fk_org_id === workspaceOrOrg.id)) &&
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
            { name: 'NocoDB Workspace ID', value: workspaceOrOrg.id },
            { name: 'NocoDB Workspace Title', value: workspaceOrOrg.title },
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

    const currentItem = stripeSub.items.data[0];
    const oldInterval = currentItem.price.recurring.interval as
      | 'month'
      | 'year';
    const newInterval = newPrice.recurring.interval as 'month' | 'year';

    const isPlanRankUp = PlanOrder[newPlan.title] > PlanOrder[oldPlan.title];
    const isUnitPriceUp =
      calculateUnitPrice(newPrice, seatCount, newInterval) >
      calculateUnitPrice(oldPrice, seatCount, oldInterval);

    if (
      (newInterval === 'year' && oldInterval === 'month') ||
      isPlanRankUp ||
      isUnitPriceUp
    ) {
      // immediate change + proration + reset cycle
      const updated = await stripe.subscriptions.update(stripeSub.id, {
        items: [
          {
            id: currentItem.id,
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
          period: newInterval,
        },
        proration_behavior: 'always_invoice',
        billing_cycle_anchor: 'now',
      });

      // drop any pending schedule
      await this.clearScheduledDowngrade(workspaceOrOrgId, true, ncMeta);
      return { id: updated.id };
    }

    if (oldInterval === 'year' && newInterval === 'month') {
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

    // same‐interval but lower price or same interval downgrade
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

  async reseatSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) return;

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
    if (existingSub.seat_count === seatCount) return;

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
        await Plan.get(existingSub.schedule_fk_plan_id, ncMeta),
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

  async cancelSubscription(workspaceOrOrgId: string, ncMeta = Noco.ncMeta) {
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
    if (!workspaceOrOrg)
      NcError.genericNotFound('Workspace or Org', workspaceOrOrgId);

    const existingSub = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );
    if (!existingSub) NcError.genericNotFound('Subscription', workspaceOrOrgId);

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
        canceled_at: dayjs
          .unix(canceled.current_period_end)
          .utc()
          .toISOString(),
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

  async getCheckoutSession(_workspaceOrOrgId: string, sessionId: string) {
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
        invoice = await stripe.invoices.retrieveUpcoming({
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
        ((s.metadata.fk_workspace_id &&
          s.metadata.fk_workspace_id === workspaceOrOrg.id) ||
          (s.metadata.fk_org_id &&
            s.metadata.fk_org_id === workspaceOrOrg.id)) &&
        ['active', 'trialing', 'incomplete'].includes(s.status),
    );

    if (!subscriptionData) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const plan = await Plan.get(subscriptionData.metadata.fk_plan_id, ncMeta);

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

    const plan = await Plan.get(existing.fk_plan_id, ncMeta);
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
    const existing = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrgId,
      ncMeta,
    );

    if (existing?.stripe_schedule_id && release)
      await stripe.subscriptionSchedules.release(existing.stripe_schedule_id);

    const existingPlan = await Plan.get(existing.fk_plan_id, ncMeta);

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
          const subRec = await Subscription.getByStripeSubscriptionId(
            (obj as Stripe.Invoice).subscription as string,
          );
          if (!subRec)
            NcError.genericNotFound(
              'Subscription',
              (obj as Stripe.Invoice).subscription as string,
            );

          await this.updateNextInvoice(
            subRec.id,
            await this.getNextInvoice(subRec.fk_workspace_id),
          );

          this.logger.log(
            `Invoice paid; next invoice scheduled for subscription ${subRec.id}`,
          );
          break;
        }

        case 'invoice.payment_failed': {
          const subRec = await Subscription.getByStripeSubscriptionId(
            (obj as Stripe.Invoice).subscription as string,
          );
          if (!subRec)
            NcError.genericNotFound(
              'Subscription',
              (obj as Stripe.Invoice).subscription as string,
            );

          const wid = subRec.fk_workspace_id || subRec.fk_org_id;
          this.logger.log(`Payment failed for ${wid}. No plan applied.`);
          break;
        }

        case 'customer.subscription.created': {
          const stripeSub = obj as Stripe.Subscription;
          const planId = stripeSub.metadata.fk_plan_id;
          const workspaceOrOrgId =
            stripeSub.metadata.fk_workspace_id || stripeSub.metadata.fk_org_id!;
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
          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const stripeSub = obj as Stripe.Subscription;
          const subRec = await Subscription.getByStripeSubscriptionId(
            stripeSub.id,
          );
          if (!subRec) NcError.genericNotFound('Subscription', stripeSub.id);

          const workspaceOrOrgId = subRec.fk_workspace_id || subRec.fk_org_id!;
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
            subRec.fk_workspace_id || subRec.fk_org_id!,
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
    }
  }
}
