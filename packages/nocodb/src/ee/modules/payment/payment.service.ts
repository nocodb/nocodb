import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import { AppEvents, PlanOrder, WorkspaceUserRoles } from 'nocodb-sdk';
import type { PlanFeatureTypes, PlanLimitTypes, PlanTitles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { Org, Plan, Subscription, Workspace, WorkspaceUser } from '~/models';
import { NcError } from '~/helpers/catchError';
import Noco from '~/Noco';
import { getWorkspaceOrOrg } from '~/helpers/paymentHelpers';
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

    if (price.lookup_key.includes('loyalty') && !workspaceOrOrg.loyal) {
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
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);
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

    const existingPlan = await Plan.get(
      existingSubscription.fk_plan_id,
      ncMeta,
    );
    if (!existingPlan) {
      NcError.genericNotFound('Plan', existingSubscription.fk_plan_id);
    }

    const existingPrice = existingPlan.prices.find(
      (p) => p.id === existingSubscription.stripe_price_id,
    );

    const seatCount = await this.getSeatCount(workspaceOrOrgId, ncMeta);
    if (seatCount !== payload.seat) {
      throw new Error(
        'There was a mismatch in the seat count, please try again',
      );
    }

    if (
      existingPlan.id === payload.plan_id &&
      existingPrice.id === payload.price_id &&
      seatCount === payload.seat
    ) {
      if (existingSubscription.scheduled_plan_start_at) {
        await Subscription.update(existingSubscription.id, {
          scheduled_fk_plan_id: null,
          scheduled_stripe_price_id: null,
          scheduled_plan_start_at: null,
          scheduled_plan_period: null,
        });

        await this.updateNextInvoice(
          existingSubscription.id,
          await this.getNextInvoice(workspaceOrOrg.id),
        );
      }

      if (existingSubscription.canceled_at) {
        await stripe.subscriptions.update(
          existingSubscription.stripe_subscription_id,
          {
            cancel_at_period_end: false,
          },
        );

        await Subscription.update(existingSubscription.id, {
          canceled_at: null,
        });
      }

      return { id: existingSubscription.stripe_subscription_id };
    }

    const subscription = await stripe.subscriptions.retrieve(
      existingSubscription.stripe_subscription_id,
    );

    if (!subscription) {
      NcError.genericNotFound(
        'Stripe subscription',
        existingSubscription.stripe_subscription_id,
      );
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
      NcError.genericNotFound('Plan', payload.plan_id);
    }

    if (!plan.is_active) {
      throw new Error('This plan is not available');
    }

    const price = plan.prices.find((p) => p.id === payload.price_id);
    if (!price) {
      NcError.genericNotFound('Price', payload.price_id);
    }

    if (price.lookup_key.includes('loyalty') && !workspaceOrOrg.loyal) {
      throw new Error('This plan is not available');
    }

    const item = subscription.items.data[0];

    let updatedSubscription;

    // CASE: monthly-to-yearly or yearly-to-monthly (same plan or lower plan)
    if (
      price.recurring.interval !== item.price.recurring.interval &&
      PlanOrder[existingPlan.title] >= PlanOrder[plan.title]
    ) {
      // Monthly to Yearly: immediate change with proration (invoice immediately) + reset billing cycle
      if (
        price.recurring.interval === 'year' &&
        item.price.recurring.interval === 'month'
      ) {
        updatedSubscription = await stripe.subscriptions.update(
          subscription.id,
          {
            items: [
              {
                id: item.id,
                price: price.id,
                quantity: seatCount,
              },
            ],
            metadata: {
              ...(workspaceOrOrg.entity === 'workspace'
                ? { fk_workspace_id: workspaceOrOrg.id }
                : { fk_org_id: workspaceOrOrg.id }),
              fk_user_id: req.user.id,
              fk_plan_id: plan.id,
            },
            proration_behavior: 'always_invoice',
            billing_cycle_anchor: 'now',
            cancel_at_period_end: false,
          },
        );
        return { id: updatedSubscription.id };
      }
      // Yearly to Monthly: schedule change at period end (no prorate)
      if (
        price.recurring.interval === 'month' &&
        item.price.recurring.interval === 'year'
      ) {
        // calculate upcoming_invoice with preview using scheduled plan
        const upcomingInvoice = await stripe.invoices.createPreview({
          subscription_details: {
            items: [
              {
                price: price.id,
                quantity: seatCount,
              },
            ],
            start_date: subscription.current_period_end,
          },
        });

        if (existingSubscription.canceled_at) {
          await stripe.subscriptions.update(
            existingSubscription.stripe_subscription_id,
            {
              cancel_at_period_end: false,
            },
          );
        }

        await Subscription.update(existingSubscription.id, {
          scheduled_fk_plan_id: plan.id,
          scheduled_stripe_price_id: price.id,
          scheduled_plan_start_at: dayjs
            .unix(subscription.current_period_end)
            .utc()
            .toISOString(),
          scheduled_plan_period: price.recurring.interval,
          upcoming_invoice_at: dayjs
            .unix(upcomingInvoice.period_start)
            .utc()
            .toISOString(),
          upcoming_invoice_due_at: dayjs
            .unix(
              upcomingInvoice.next_payment_attempt || upcomingInvoice.due_date,
            )
            .utc()
            .toISOString(),
          upcoming_invoice_amount: upcomingInvoice.amount_due,
          upcoming_invoice_currency: upcomingInvoice.currency,
          ...(existingSubscription.canceled_at ? { canceled_at: null } : {}),
        });

        return {
          id: subscription.id,
          message: 'Plan change scheduled at period end',
        };
      }
    } else {
      // Yearly plan
      if (price.recurring.interval === 'year') {
        // If the new price or plan is higher upgrade immediately (invoice now with prorations) + reset billing cycle
        if (
          !existingPrice ||
          price.unit_amount > existingPrice.unit_amount ||
          PlanOrder[plan.title] > PlanOrder[existingPlan.title]
        ) {
          updatedSubscription = await stripe.subscriptions.update(
            subscription.id,
            {
              items: [
                {
                  id: item.id,
                  price: price.id,
                  quantity: seatCount,
                },
              ],
              metadata: {
                ...(workspaceOrOrg.entity === 'workspace'
                  ? { fk_workspace_id: workspaceOrOrg.id }
                  : { fk_org_id: workspaceOrOrg.id }),
                fk_user_id: req.user.id,
                fk_plan_id: plan.id,
              },
              proration_behavior: 'always_invoice',
              billing_cycle_anchor: 'now',
              cancel_at_period_end: false,
            },
          );
          return { id: updatedSubscription.id };
        } else {
          // calculate upcoming_invoice with preview using scheduled plan
          const upcomingInvoice = await stripe.invoices.createPreview({
            subscription_details: {
              items: [
                {
                  price: price.id,
                  quantity: seatCount,
                },
              ],
              start_date: subscription.current_period_end,
            },
          });

          if (existingSubscription.canceled_at) {
            await stripe.subscriptions.update(
              existingSubscription.stripe_subscription_id,
              {
                cancel_at_period_end: false,
              },
            );
          }

          // For a downgrade on a yearly plan schedule update at period end
          await Subscription.update(existingSubscription.id, {
            scheduled_fk_plan_id: plan.id,
            scheduled_stripe_price_id: price.id,
            scheduled_plan_start_at: dayjs
              .unix(subscription.current_period_end)
              .utc()
              .toISOString(),
            scheduled_plan_period: price.recurring.interval,
            upcoming_invoice_at: dayjs
              .unix(upcomingInvoice.period_start)
              .utc()
              .toISOString(),
            upcoming_invoice_due_at: dayjs
              .unix(
                upcomingInvoice.next_payment_attempt ||
                  upcomingInvoice.due_date,
              )
              .utc()
              .toISOString(),
            upcoming_invoice_amount: upcomingInvoice.amount_due,
            upcoming_invoice_currency: upcomingInvoice.currency,
            ...(existingSubscription.canceled_at ? { canceled_at: null } : {}),
          });

          return {
            id: subscription.id,
            message: 'Plan downgrade scheduled at period end',
          };
        }
      } else {
        // Monthly plan: change immediately with proration (invoice now) + reset billing cycle
        updatedSubscription = await stripe.subscriptions.update(
          subscription.id,
          {
            items: [
              {
                id: item.id,
                price: price.id,
                quantity: seatCount,
              },
            ],
            metadata: {
              ...(workspaceOrOrg.entity === 'workspace'
                ? { fk_workspace_id: workspaceOrOrg.id }
                : { fk_org_id: workspaceOrOrg.id }),
              fk_user_id: req.user.id,
              fk_plan_id: plan.id,
            },
            proration_behavior: 'always_invoice',
            billing_cycle_anchor: 'now',
            cancel_at_period_end: false,
          },
        );

        return { id: updatedSubscription.id };
      }
    }
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
        cancel_at_period_end: false,
        expand: ['latest_invoice.payment_intent'],
        // invoice immediately if the plan is yearly or change is scheduled
        ...(existingSubscription.period === 'year' ||
        existingSubscription.scheduled_plan_start_at
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
    const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId, ncMeta);

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
      canceled_at: dayjs
        .unix(canceledSubscription.current_period_end)
        .utc()
        .toISOString(),
      scheduled_fk_plan_id: null,
      scheduled_stripe_price_id: null,
      scheduled_plan_start_at: null,
      scheduled_plan_period: null,
      upcoming_invoice_at: null,
      upcoming_invoice_due_at: null,
      upcoming_invoice_amount: null,
      upcoming_invoice_currency: null,
    });

    return canceledSubscription.id;
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

      if (subscription.scheduled_stripe_price_id) {
        invoice = await stripe.invoices.createPreview({
          subscription_details: {
            items: [
              {
                price: subscription.scheduled_stripe_price_id,
                quantity: subscription.seat_count,
              },
            ],
            start_date: dayjs(subscription.scheduled_plan_start_at).unix(),
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

    const subscription = await Subscription.getByWorkspaceOrOrg(
      workspaceOrOrg.id,
    );

    if (!subscription) {
      NcError.genericNotFound('Subscription', workspaceOrOrgId);
    }

    const invoices = await stripe.invoices.list({
      customer: workspaceOrOrg.stripe_customer_id,
      subscription: subscription.stripe_subscription_id,
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
  ) {
    try {
      await Subscription.update(subscriptionId, {
        upcoming_invoice_at: dayjs.unix(invoice.period_end).utc().toISOString(),
        upcoming_invoice_due_at: dayjs
          .unix(invoice.next_payment_attempt || invoice.due_date)
          .utc()
          .toISOString(),
        upcoming_invoice_amount: invoice.amount_due,
        upcoming_invoice_currency: invoice.currency,
      });
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
      );
    }

    this.logger.log(
      `Subscription recovered for workspace or org ${workspaceOrOrg.id}`,
    );

    return subscription;
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
            NcError.genericNotFound('Subscription', subscriptionId);
          }

          if (subscription.fk_workspace_id) {
            const workspaceId = subscription.fk_workspace_id;

            await this.updateNextInvoice(
              subscription.id,
              await this.getNextInvoice(workspaceId),
            );

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
            NcError.genericNotFound('Subscription', subscriptionId);
          }

          const workspaceOrOrgId =
            subscription.fk_org_id || subscription.fk_workspace_id;

          this.logger.log(
            `Payment failed for ${workspaceOrOrgId}. No plan applied`,
          );
          break;
        }

        case 'customer.subscription.created': {
          const subscription = dataObject as Stripe.Subscription;
          const plan_id = subscription.metadata.fk_plan_id;

          const workspaceOrOrgId =
            subscription.metadata.fk_workspace_id ||
            subscription.metadata.fk_org_id;

          const workspaceOrOrg = await getWorkspaceOrOrg(workspaceOrOrgId);

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
            billing_cycle_anchor: dayjs
              .unix(subscription.billing_cycle_anchor)
              .utc()
              .toISOString(),
          });

          break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = await Subscription.getByStripeSubscriptionId(
            dataObject.id,
          );

          if (!subscription) {
            NcError.genericNotFound('Subscription', dataObject.id);
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
            canceled_at: dataObject.cancel_at
              ? dayjs.unix(dataObject.cancel_at).utc().toISOString()
              : null,
            fk_plan_id: plan_id,
            billing_cycle_anchor: dayjs
              .unix(dataObject.billing_cycle_anchor)
              .utc()
              .toISOString(),
            period: dataObject.items.data[0].price.recurring
              ? dataObject.items.data[0].price.recurring.interval
              : subscription.period,
            ...(nextInvoice
              ? {
                  upcoming_invoice_at: dayjs
                    .unix(nextInvoice.period_end)
                    .utc()
                    .toISOString(),
                  upcoming_invoice_due_at: dayjs
                    .unix(
                      nextInvoice.next_payment_attempt || nextInvoice.due_date,
                    )
                    .utc()
                    .toISOString(),
                  upcoming_invoice_amount: nextInvoice.amount_due,
                  upcoming_invoice_currency: nextInvoice.currency,
                }
              : {}),
          });

          const workspaceOrOrgId =
            subscription.fk_org_id || subscription.fk_workspace_id;

          this.logger.log(
            `Subscription ${event.type} processed for ${workspaceOrOrgId}.`,
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
