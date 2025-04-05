import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import dayjs from 'dayjs';
import { Subscription } from '~/models';
import Noco from '~/Noco';
import { MetaTable, RootScopes } from '~/utils/globals';

const stripe = new Stripe(process.env.NC_STRIPE_SECRET_KEY || 'placeholder');

@Injectable()
export class SubscriptionScheduleProcessor {
  private logger = new Logger(SubscriptionScheduleProcessor.name);

  constructor() {}

  async job() {
    const ncMeta = Noco.ncMeta;

    const scheduledSubscriptions = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      {
        xcCondition: {
          _and: [
            {
              status: {
                in: ['active', 'trialing', 'incomplete'],
              },
            },
            {
              // starts within 1 hours 1 minute
              scheduled_plan_start_at: {
                le: dayjs().add(61, 'minutes').toISOString(),
              },
            },
          ],
        },
      },
    );

    if (scheduledSubscriptions.length === 0) {
      this.logger.log('No scheduled subscriptions found.');
      return;
    }

    for (const subscription of scheduledSubscriptions) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
        );

        const item = stripeSubscription.items.data[0];

        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          items: [
            {
              id: item.id,
              price: subscription.scheduled_stripe_price_id,
              quantity: subscription.seat_count,
            },
          ],
          metadata: {
            ...stripeSubscription.metadata,
            fk_plan_id: subscription.scheduled_fk_plan_id,
          },
          proration_behavior: 'none',
          billing_cycle_anchor: 'now',
        });

        await Subscription.update(
          subscription.id,
          {
            stripe_price_id: subscription.scheduled_stripe_price_id,
            fk_plan_id: subscription.scheduled_fk_plan_id,
            status: stripeSubscription.status,
            scheduled_fk_plan_id: null,
            scheduled_stripe_price_id: null,
            scheduled_plan_start_at: null,
            scheduled_plan_period: null,
          },
          ncMeta,
        );
      } catch (error) {
        this.logger.error(`Error processing subscription ${subscription.id}`);
        this.logger.error(error);
      }
    }

    this.logger.log('Processed scheduled subscriptions successfully.');
  }
}
