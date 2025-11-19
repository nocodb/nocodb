import { NON_SEAT_ROLES, ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
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
    let subscription = await NocoCache.get(
      'root',
      key,
      CacheGetType.TYPE_OBJECT,
    );
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

      await NocoCache.set('root', key, subscription);
      await NocoCache.set(
        'root',
        `${CacheScope.SUBSCRIPTIONS_ALIAS}:${subscription.stripe_subscription_id}`,
        key,
      );
      await NocoCache.set(
        'root',
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
      'root',
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
    await NocoCache.del('root', key);
    await NocoCache.del(
      'root',
      `${CacheScope.SUBSCRIPTIONS_ALIAS}:${subscription.stripe_subscription_id}`,
    );
    await NocoCache.del(
      'root',
      `${CacheScope.SUBSCRIPTIONS_ALIAS}:${
        subscription.fk_org_id || subscription.fk_workspace_id
      }`,
    );

    return true;
  }

  /**
   * Calculates seat count for a workspace including team users
   *
   * This method counts users who consume seats based on their roles in:
   * 1. Direct workspace assignments
   * 2. Direct base assignments within the workspace
   * 3. Team memberships where teams are assigned to the workspace or its bases
   *
   * Seat counting logic:
   * - A user is counted as seat-consuming if they have ANY seat-consuming role at ANY level
   * - This includes: direct base roles, direct workspace roles, base team roles, workspace team roles
   * - If a user has multiple roles, having even one seat-consuming role makes them count as seat-consuming
   * - Team member roles (manager/member) are not considered for seat counting
   *
   * @param workspaceId Workspace ID
   * @param ncMeta Database metadata instance
   * @returns Object containing seat count, non-seat count, and user maps
   */
  public static async calculateWorkspaceSeatCount(
    workspaceId: string,
    ncMeta = Noco.ncMeta,
  ) {
    // Get active base IDs for this workspace
    const bases = await Base.list(workspaceId, ncMeta);
    const activeBaseIds = (bases ?? []).map((b) => b.id);

    // Note: Query implementation specific to PostgreSQL due to ARRAY_AGG usage
    // Subquery for workspace team roles (teams → workspace roles per user)
    const workspaceTeamRolesSubquery = ncMeta.knexConnection
      .select(
        'pa.principal_ref_id as user_id',
        ncMeta.knex.raw(
          'ARRAY_AGG(DISTINCT wta.roles) as workspace_team_roles',
        ),
      )
      .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
      .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as wta`, function () {
        this.on('wta.principal_ref_id', '=', 'pa.resource_id')
          .andOn('wta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
          .andOn('wta.resource_type', '=', ncMeta.knex.raw('?', ['workspace']))
          .andOn('wta.resource_id', '=', ncMeta.knex.raw('?', [workspaceId]))
          .andOn(
            ncMeta.knex.raw('COALESCE(wta.deleted, FALSE)'),
            '=',
            ncMeta.knex.raw('?', [false]),
          );
      })
      .where('pa.principal_type', '=', 'user')
      .where('pa.resource_type', '=', 'team')
      .where(
        ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
        '=',
        ncMeta.knex.raw('?', [false]),
      )
      .groupBy('pa.principal_ref_id')
      .as('wtr');

    // Subquery for base team roles (teams → base roles per user)
    const baseTeamRolesSubquery = ncMeta.knexConnection
      .select(
        'pa.principal_ref_id as user_id',
        ncMeta.knex.raw('ARRAY_AGG(DISTINCT bta.roles) as base_team_roles'),
      )
      .from(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as pa`)
      .join(`${MetaTable.PRINCIPAL_ASSIGNMENTS} as bta`, function () {
        this.on('bta.principal_ref_id', '=', 'pa.resource_id')
          .andOn('bta.principal_type', '=', ncMeta.knex.raw('?', ['team']))
          .andOn('bta.resource_type', '=', ncMeta.knex.raw('?', ['base']))
          .andOn(
            ncMeta.knex.raw('COALESCE(bta.deleted, FALSE)'),
            '=',
            ncMeta.knex.raw('?', [false]),
          );
        if (activeBaseIds.length > 0) {
          this.andOnIn('bta.resource_id', activeBaseIds);
        } else {
          // If no active bases, make the join condition always false
          this.andOn(ncMeta.knex.raw('?', [0]), '=', ncMeta.knex.raw('?', [1]));
        }
      })
      .where('pa.principal_type', '=', 'user')
      .where('pa.resource_type', '=', 'team')
      .where(
        ncMeta.knex.raw('COALESCE(pa.deleted, FALSE)'),
        '=',
        ncMeta.knex.raw('?', [false]),
      )
      .groupBy('pa.principal_ref_id')
      .as('btr');

    // Single comprehensive query to get all user roles
    const allUserRoles = await ncMeta.knexConnection
      .select(
        `${MetaTable.USERS}.id as user_id`,
        'wu.roles as workspace_role',
        'bu.roles as base_role',
        'wtr.workspace_team_roles as workspace_team_role',
        'btr.base_team_roles as base_team_role',
      )
      .from(MetaTable.USERS)
      // Left join with direct workspace users
      .leftJoin(`${MetaTable.WORKSPACE_USER} as wu`, function () {
        this.on(`${MetaTable.USERS}.id`, '=', 'wu.fk_user_id')
          .andOn('wu.fk_workspace_id', '=', ncMeta.knex.raw('?', [workspaceId]))
          .andOn(
            ncMeta.knex.raw('COALESCE(wu.deleted, FALSE)'),
            '=',
            ncMeta.knex.raw('?', [false]),
          );
      })
      // Left join with direct base users
      .leftJoin(`${MetaTable.PROJECT_USERS} as bu`, function () {
        this.on(`${MetaTable.USERS}.id`, '=', 'bu.fk_user_id').andOn(
          'bu.fk_workspace_id',
          '=',
          ncMeta.knex.raw('?', [workspaceId]),
        );
        if (activeBaseIds.length > 0) {
          this.andOnIn('bu.base_id', activeBaseIds);
        } else {
          // If no active bases, make the join condition always false
          this.andOn('1', '=', '0');
        }
      })
      // Left join with workspace team roles subquery
      .leftJoin(
        workspaceTeamRolesSubquery,
        'wtr.user_id',
        `${MetaTable.USERS}.id`,
      )
      // Left join with base team roles subquery
      .leftJoin(baseTeamRolesSubquery, 'btr.user_id', `${MetaTable.USERS}.id`)
      // Filter: only users who have at least one role assignment
      .where(function () {
        this.whereNotNull('wu.fk_user_id')
          .orWhereNotNull('bu.fk_user_id')
          .orWhereNotNull('wtr.user_id')
          .orWhereNotNull('btr.user_id');
      });

    /*
      Count users based on their roles - if they have ANY seat-consuming role at ANY level,
      they are counted as seat-consuming. This includes:
      - Direct base assignments
      - Direct workspace assignments
      - Base team roles
      - Workspace team roles
    */
    const seatUsersMap = new Map<string, true>();
    const nonSeatUsersMap = new Map<string, true>();

    for (const userRole of allUserRoles) {
      const userId = userRole.user_id;

      // Collect all roles that the user has
      const effectiveRoles = [];

      // Extract base level role
      if (userRole.base_role && userRole.base_role !== ProjectRoles.INHERIT) {
        effectiveRoles.push(userRole.base_role);
      } // Extract base team roles (now an array)
      else if (
        userRole.base_team_role &&
        Array.isArray(userRole.base_team_role)
      ) {
        effectiveRoles.push(...userRole.base_team_role);
      }

      // Extract workspace role
      if (
        userRole.workspace_role &&
        userRole.workspace_role !== WorkspaceUserRoles.INHERIT
      ) {
        effectiveRoles.push(userRole.workspace_role);
      } // Extract workspace team roles (now an array)
      else if (
        userRole.workspace_team_role &&
        Array.isArray(userRole.workspace_team_role)
      ) {
        effectiveRoles.push(...userRole.workspace_team_role);
      }

      // Check if user has any seat-consuming role among all their roles
      const hasSeatConsumingRole = effectiveRoles.some(
        (role) => !NON_SEAT_ROLES.includes(role),
      );

      if (hasSeatConsumingRole) {
        // User has at least one seat-consuming role at any level
        if (!seatUsersMap.has(userId)) {
          seatUsersMap.set(userId, true);
        }

        // Remove from non-seat map if present (role override)
        if (nonSeatUsersMap.has(userId)) {
          nonSeatUsersMap.delete(userId);
        }
      } else {
        // User has only non-seat roles or no roles
        // Only add to non-seat map if not already in seat map (no override)
        if (!seatUsersMap.has(userId) && !nonSeatUsersMap.has(userId)) {
          nonSeatUsersMap.set(userId, true);
        }
      }
    }

    // Handle NocoDB internal users (skip seat counting for @nocodb.com emails)
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

  /**
   * Calculates seat count for an organization by aggregating all workspace seat counts
   *
   * TODO: Update in next iteration to include team users across all workspaces
   * Currently only counts direct workspace and base users
   *
   * @param orgId Organization ID
   * @param ncMeta Database metadata instance
   * @returns Total seat count for the organization
   */
  public static async calculateOrgSeatCount(
    orgId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    // Get all workspace users across all workspaces in the organization
    const workspaceUsers = await ncMeta.knexConnection
      .select('fk_user_id', 'roles')
      .from(MetaTable.WORKSPACE_USER)
      .whereIn(
        'fk_workspace_id',
        ncMeta
          .knex(MetaTable.WORKSPACE)
          .select('id')
          .where('fk_org_id', orgId)
          .where((kn) => {
            kn.where('deleted', ncMeta.knex.raw('?', [false])).orWhereNull(
              'deleted',
            );
          }),
      )
      .where((kn) => {
        kn.where('deleted', ncMeta.knex.raw('?', [false])).orWhereNull(
          'deleted',
        );
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
        kn.where(
          `${MetaTable.PROJECT}.deleted`,
          ncMeta.knex.raw('?', [false]),
        ).orWhereNull(`${MetaTable.PROJECT}.deleted`);
      })
      .where((kn) => {
        kn.where(
          `${MetaTable.WORKSPACE}.deleted`,
          ncMeta.knex.raw('?', [false]),
        ).orWhereNull(`${MetaTable.WORKSPACE}.deleted`);
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
    const cacheKey = await NocoCache.get(
      'root',
      aliasKey,
      CacheGetType.TYPE_STRING,
    );

    let subscription =
      cacheKey &&
      (await NocoCache.get('root', cacheKey, CacheGetType.TYPE_OBJECT));
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
    const cacheKey = await NocoCache.get(
      'root',
      aliasKey,
      CacheGetType.TYPE_STRING,
    );
    let subscription = await NocoCache.get(
      'root',
      cacheKey,
      CacheGetType.TYPE_OBJECT,
    );
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
