import { NON_SEAT_ROLES } from 'nocodb-sdk';
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
  fk_org_id: string;
  fk_plan_id: string;

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

  private static async calculateWorkspaceSeatCount(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const workspaceUsers = await ncMeta.metaList2(
      workspaceId,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        xcCondition: {
          _and: [
            {
              fk_workspace_id: {
                eq: workspaceId,
              },
            },
            {
              _or: [
                {
                  deleted: {
                    eq: false,
                  },
                },
                {
                  deleted: {
                    eq: null,
                  },
                },
              ],
            },
          ],
        },
      },
    );

    const baseUsers = await ncMeta.metaList2(
      workspaceId,
      RootScopes.WORKSPACE,
      MetaTable.PROJECT_USERS,
      {
        condition: {
          fk_workspace_id: workspaceId,
        },
      },
    );

    /*
      Count users based on their roles in either workspace or base
      and exclude users with roles that do not consume a seat
    */
    const seatUsersMap = new Map<string, true>();

    for (const user of workspaceUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }
    }

    for (const user of baseUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }
    }

    return seatUsersMap.size;
  }

  private static async calculateOrgSeatCount(
    orgId: string,
    _ncMeta = Noco.ncMeta,
  ): Promise<number> {
    throw new Error('Method not implemented.');
  }

  public static async getByWorkspaceOrOrg(
    workspaceOrOrgId: string,
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
            _or: [
              {
                fk_workspace_id: {
                  eq: workspaceOrOrgId,
                },
              },
              {
                fk_org_id: {
                  eq: workspaceOrOrgId,
                },
              },
            ],
          },
          {
            _or: [
              {
                status: {
                  in: ['active', 'trialing', 'incomplete'],
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

  public async getSeatCount(ncMeta = Noco.ncMeta) {
    if (this.fk_org_id) {
      return Subscription.calculateOrgSeatCount(this.fk_org_id, ncMeta);
    }

    return Subscription.calculateWorkspaceSeatCount(
      this.fk_workspace_id,
      ncMeta,
    );
  }
}
