import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';

export default class Subscription {
  id: string;
  fk_workspace_id: string;
  fk_plan_id: string;
  fk_user_id: string;

  stripe_subscription_id: string;
  stripe_price_id: string;

  seat_count: number;

  status: string;

  start_at: string;
  end_at: string;

  // timestamps
  created_at: string;
  updated_at: string;

  constructor(subscription: Partial<Subscription>) {
    Object.assign(this, subscription);
  }

  public static async get(subscriptionId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.SUBSCRIPTIONS}:${subscriptionId}`;
    let subscription = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!subscription) {
      subscription = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SUBSCRIPTIONS,
        {
          id: subscriptionId,
        },
      );

      if (!subscription) return null;

      await NocoCache.set(key, subscription);
    }

    return new Subscription(subscription);
  }

  public static async insert(
    subscription: Partial<Subscription>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(subscription, [
      'fk_workspace_id',
      'fk_plan_id',
      'fk_user_id',
      'stripe_subscription_id',
      'stripe_price_id',
      'seat_count',
      'status',
      'start_at',
      'end_at',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      insertObj,
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    subscriptionId: string,
    subscription: Partial<Subscription>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(subscription, [
      'stripe_price_id',
      'status',
      'seat_count',
      'status',
      'end_at',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      updateObj,
      subscriptionId,
    );

    await NocoCache.update(
      `${CacheScope.SUBSCRIPTIONS}:${subscriptionId}`,
      updateObj,
    );

    return true;
  }

  public static async delete(subscriptionId: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      subscriptionId,
    );

    const key = `${CacheScope.SUBSCRIPTIONS}:${subscriptionId}`;
    await NocoCache.del(key);

    return true;
  }

  public static async getByWorkspace(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const subscription = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      null,
      null,
      {
        _and: [
          {
            fk_workspace_id: {
              eq: workspaceId,
            },
          },
          {
            _or: [
              {
                status: {
                  eq: 'active',
                },
              },
              {
                status: {
                  eq: 'trialing',
                },
              },
            ],
          },
        ],
      },
    );

    if (!subscription) return null;

    return new Subscription(subscription);
  }

  public static async getByStripeSubscriptionId(
    stripeSubscriptionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const subscription = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      null,
      null,
      {
        stripe_subscription_id: {
          eq: stripeSubscriptionId,
        },
      },
    );

    if (!subscription) return null;

    return new Subscription(subscription);
  }
}
