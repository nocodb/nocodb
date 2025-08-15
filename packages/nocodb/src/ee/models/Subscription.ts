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
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import { Base } from '~/models';

const NOCODB_SKIP_SEAT = process.env.NOCODB_SKIP_SEAT === 'true';

export default class Subscription {
  id: string;
  fk_workspace_id: string;
  fk_org_id: string;
  fk_plan_id: string;

  fk_user_id: string;

  stripe_subscription_id: string;
  stripe_price_id: string;

  seat_count: number;

  status: string;

  start_at: string;
  trial_end_at: string;
  canceled_at: string;
  billing_cycle_anchor: string;

  period: string;

  upcoming_invoice_at: string;
  upcoming_invoice_due_at: string;

  upcoming_invoice_amount: number;
  upcoming_invoice_currency: string;

  // Stripe schedule for downgrades
  stripe_schedule_id: string | null;
  schedule_phase_start: string | null;
  schedule_stripe_price_id: string | null;
  schedule_fk_plan_id: string | null;
  schedule_period: string | null;
  schedule_type: 'next' | 'year' | null;

  // Extra
  meta: Record<string, any> | null;

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

      subscription = prepareForResponse(subscription);

      await NocoCache.set(key, subscription);
      await NocoCache.set(
        `${CacheScope.SUBSCRIPTIONS_ALIAS}:${subscription.stripe_subscription_id}`,
        key,
      );
      await NocoCache.set(
        `${CacheScope.SUBSCRIPTIONS_ALIAS}:${
          // subscription.fk_org_id || subscription.fk_workspace_id
          subscription.fk_org_id || subscription.fk_workspace_id
        }`,
        key,
      );
    }

    return new Subscription(subscription);
  }

  public static async insert(
    subscription: Partial<Subscription>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(subscription, [
      'fk_workspace_id',
      'fk_org_id',
      'fk_plan_id',
      'fk_user_id',
      'stripe_subscription_id',
      'stripe_price_id',
      'seat_count',
      'status',
      'start_at',
      'billing_cycle_anchor',
      'trial_end_at',
      'canceled_at',
      'period',
      'upcoming_invoice_at',
      'upcoming_invoice_due_at',
      'upcoming_invoice_amount',
      'upcoming_invoice_currency',
      'meta',
      'stripe_schedule_id',
      'schedule_phase_start',
      'schedule_stripe_price_id',
      'schedule_fk_plan_id',
      'schedule_period',
      'schedule_type',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      prepareForDb(insertObj),
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
      'fk_plan_id',
      'fk_user_id',
      'status',
      'seat_count',
      'status',
      'trial_end_at',
      'canceled_at',
      'billing_cycle_anchor',
      'period',
      'upcoming_invoice_at',
      'upcoming_invoice_due_at',
      'upcoming_invoice_amount',
      'upcoming_invoice_currency',
      'meta',
      'stripe_schedule_id',
      'schedule_phase_start',
      'schedule_stripe_price_id',
      'schedule_fk_plan_id',
      'schedule_period',
      'schedule_type',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      prepareForDb(updateObj),
      subscriptionId,
    );

    await NocoCache.update(
      `${CacheScope.SUBSCRIPTIONS}:${subscriptionId}`,
      updateObj,
    );

    return true;
  }

  public static async delete(subscriptionId: string, ncMeta = Noco.ncMeta) {
    const subscription = await this.get(subscriptionId, ncMeta);

    if (!subscription) return false;

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTIONS,
      subscriptionId,
    );

    const key = `${CacheScope.SUBSCRIPTIONS}:${subscriptionId}`;
    await NocoCache.del(key);
    await NocoCache.del(
      `${CacheScope.SUBSCRIPTIONS_ALIAS}:${subscription.stripe_subscription_id}`,
    );
    await NocoCache.del(
      `${CacheScope.SUBSCRIPTIONS_ALIAS}:${
        subscription.fk_org_id || subscription.fk_workspace_id
      }`,
    );

    return true;
  }

  public static async calculateWorkspaceSeatCount(
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

    const bases = await Base.list(workspaceId, ncMeta);

    const activeBaseIds = (bases ?? []).map((b) => b.id);

    const baseUsers = await ncMeta.metaList2(
      workspaceId,
      RootScopes.WORKSPACE,
      MetaTable.PROJECT_USERS,
      {
        condition: {
          fk_workspace_id: workspaceId,
        },
        xcCondition: {
          _and: [
            {
              base_id: {
                in: activeBaseIds,
              },
            },
          ],
        },
      },
    );

    /*
      Count users based on their roles in either workspace or base
      and exclude users with roles that do not consume a seat
    */
    const seatUsersMap = new Map<string, true>();

    const nonSeatUsersMap = new Map<string, true>();

    for (const user of workspaceUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }

      if (!nonSeatUsersMap.has(userId) && NON_SEAT_ROLES.includes(role)) {
        nonSeatUsersMap.set(userId, true);
      }
    }

    for (const user of baseUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }

      if (nonSeatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        // If user is present in nonSeatUsersMap and in some base it is seat user then remove it
        nonSeatUsersMap.delete(userId);
      } else if (
        !nonSeatUsersMap.has(userId) &&
        NON_SEAT_ROLES.includes(role)
      ) {
        nonSeatUsersMap.set(userId, true);
      }
    }

    if (NOCODB_SKIP_SEAT) {
      const users = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.USERS,
        {
          xcCondition: {
            _and: [
              {
                id: {
                  in: Array.from(seatUsersMap.keys()),
                },
              },
            ],
          },
        },
      );

      for (const user of users) {
        if (user.email?.includes('@nocodb.com')) {
          seatUsersMap.delete(user.id);
          nonSeatUsersMap.set(user.id, true);
        }
      }
    }

    return {
      seatCount: seatUsersMap.size,
      nonSeatCount: nonSeatUsersMap.size,
      seatUsersMap,
      nonSeatUsersMap,
    };
  }

  public static async calculateOrgSeatCount(
    orgId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    // Get all workspace users across all workspaces in the organization
    const workspaceUsers = await ncMeta.knexConnection
      .select('fk_user_id', 'roles')
      .from(MetaTable.WORKSPACE_USER)
      .where(
        'fk_workspace_id',
        'in',
        ncMeta
          .knex(MetaTable.WORKSPACE)
          .select('id')
          .where('fk_org_id', orgId)
          .where((kn) => {
            kn.where('deleted', false).orWhereNull('deleted');
          }),
      )
      .where((kn) => {
        kn.where('deleted', false).orWhereNull('deleted');
      });

    // Get all base users across all bases in all workspaces in the organization
    const baseUsers = await ncMeta.knexConnection
      .select(
        `${MetaTable.PROJECT_USERS}.fk_user_id`,
        `${MetaTable.PROJECT_USERS}.roles`,
      )
      .from(MetaTable.PROJECT_USERS)
      .innerJoin(
        MetaTable.PROJECT,
        `${MetaTable.PROJECT_USERS}.base_id`,
        `${MetaTable.PROJECT}.id`,
      )
      .innerJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.PROJECT}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .where(`${MetaTable.WORKSPACE}.fk_org_id`, orgId)
      .where((kn) => {
        kn.where(`${MetaTable.PROJECT}.deleted`, false).orWhereNull(
          `${MetaTable.PROJECT}.deleted`,
        );
      })
      .where((kn) => {
        kn.where(`${MetaTable.WORKSPACE}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE}.deleted`,
        );
      });

    /*
      Count users based on their roles in either workspace or base
      and exclude users with roles that do not consume a seat
    */
    const seatUsersMap = new Map<string, true>();
    const nonSeatUsersMap = new Map<string, true>();

    // Process workspace users
    for (const user of workspaceUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }

      if (!nonSeatUsersMap.has(userId) && NON_SEAT_ROLES.includes(role)) {
        nonSeatUsersMap.set(userId, true);
      }
    }

    // Process base users
    for (const user of baseUsers) {
      const userId = user.fk_user_id;
      const role = user.roles;
      if (!seatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        seatUsersMap.set(userId, true);
      }

      if (nonSeatUsersMap.has(userId) && !NON_SEAT_ROLES.includes(role)) {
        // If user is present in nonSeatUsersMap and in some base it is seat user then remove it
        nonSeatUsersMap.delete(userId);
      } else if (
        !nonSeatUsersMap.has(userId) &&
        NON_SEAT_ROLES.includes(role)
      ) {
        nonSeatUsersMap.set(userId, true);
      }
    }

    return seatUsersMap.size;
  }

  public static async getByWorkspaceOrOrg(
    workspaceOrOrgId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const aliasKey = `${CacheScope.SUBSCRIPTIONS_ALIAS}:${workspaceOrOrgId}`;
    const cacheKey = await NocoCache.get(aliasKey, CacheGetType.TYPE_STRING);

    let subscription = await NocoCache.get(cacheKey, CacheGetType.TYPE_OBJECT);
    if (!subscription) {
      subscription = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SUBSCRIPTIONS,
        {},
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
                    in: ['active', 'trialing', 'incomplete', 'past_due'],
                  },
                },
              ],
            },
          ],
        },
      );
    }

    if (
      !subscription ||
      !['active', 'trialing', 'incomplete', 'past_due'].includes(
        subscription.status,
      )
    )
      return null;

    return new Subscription(prepareForResponse(subscription));
  }

  public static async getByStripeSubscriptionId(
    stripeSubscriptionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const aliasKey = `${CacheScope.SUBSCRIPTIONS_ALIAS}:${stripeSubscriptionId}`;
    const cacheKey = await NocoCache.get(aliasKey, CacheGetType.TYPE_STRING);
    let subscription = await NocoCache.get(cacheKey, CacheGetType.TYPE_OBJECT);
    if (!subscription) {
      subscription = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SUBSCRIPTIONS,
        {},
        null,
        {
          stripe_subscription_id: {
            eq: stripeSubscriptionId,
          },
        },
      );
    }

    if (!subscription) return null;

    return new Subscription(prepareForResponse(subscription));
  }
}
