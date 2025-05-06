import {
  GRACE_PERIOD_DURATION,
  NON_SEAT_ROLES,
  PlanFeatureTypes,
  PlanLimitTypes,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import type Stripe from 'stripe';
import { NcError } from '~/helpers/catchError';
import { Domain, Org, Subscription, Workspace } from '~/models';
import Noco from '~/Noco';
import Plan, {
  FreePlan,
  GenericFeatures,
  GenericLimits,
  GraceLimits,
} from '~/models/Plan';

async function getLimit(
  type: PlanLimitTypes,
  workspaceOrId?: string | Workspace,
  ncMeta = Noco.ncMeta,
): Promise<{
  limit: number;
  plan?: Partial<Plan>;
}> {
  if (!workspaceOrId) {
    if (GenericLimits[type] === undefined || GenericLimits[type] === null) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    if (GenericLimits[type] === -1) {
      return {
        limit: Infinity,
      };
    }

    return {
      limit: GenericLimits[type] ?? Infinity,
    };
  }

  const workspace =
    typeof workspaceOrId === 'string'
      ? await Workspace.get(workspaceOrId, undefined, ncMeta)
      : workspaceOrId;

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  const plan = workspace?.payment?.plan;

  const limit = plan?.meta?.[type] ?? GenericLimits[type] ?? Infinity;

  if (limit === -1) {
    return {
      limit: Infinity,
      plan,
    };
  }

  return {
    limit,
    plan,
  };
}

async function checkLimit(args: {
  workspace?: Workspace;
  workspaceId?: string;
  type: PlanLimitTypes;
  count?: number;
  delta?: number;
  message?: (args: { limit?: number; plan?: string }) => string;
  throwError?: boolean;
  ncMeta?: typeof Noco.ncMeta;
}): Promise<void> {
  const {
    workspaceId,
    type,
    delta,
    message,
    throwError = true,
    ncMeta = Noco.ncMeta,
  } = args;

  try {
    let workspace = args.workspace;

    if (!workspace) {
      if (!workspaceId)
        NcError.badRequest('Workspace ID or workspace is required');

      workspace = await Workspace.get(workspaceId, undefined, ncMeta);
    }

    if (!workspace) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    const plan = workspace?.payment?.plan;

    const limit = plan?.meta?.[type] ?? GenericLimits[type] ?? Infinity;

    const statName =
      type === PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE ? 'row_count' : type;

    const count = args.count ?? workspace.stats?.[statName] ?? 0;

    if (limit === -1) {
      return;
    }

    if (count + (delta || 0) > limit) {
      if (type in GraceLimits && plan?.free) {
        let gracePeriodStartAt = workspace.grace_period_start_at;

        if (type === PlanLimitTypes.LIMIT_API_CALL)
          gracePeriodStartAt = workspace.api_grace_period_start_at;
        if (type === PlanLimitTypes.LIMIT_AUTOMATION_RUN)
          gracePeriodStartAt = workspace.automation_grace_period_start_at;

        if (gracePeriodStartAt) {
          const gracePeriodEndAt = dayjs(gracePeriodStartAt)
            .add(GRACE_PERIOD_DURATION, 'day')
            .endOf('day')
            .toDate();

          if (dayjs().isBefore(gracePeriodEndAt)) {
            if (count + (delta || 0) > GraceLimits[type]) {
              NcError.planLimitExceeded(
                message?.({
                  limit: GraceLimits[type],
                  plan: plan?.title,
                }) ||
                  `You have reached the limit of ${limit} (${type}) for your plan.`,
                {
                  plan: plan?.title,
                  limit: GraceLimits[type],
                  current: count,
                },
              );
            }
            return;
          }

          NcError.planLimitExceeded(
            message?.({
              limit: GraceLimits[type],
              plan: plan?.title,
            }) ||
              `You have reached the limit of ${limit} (${type}) for your plan.`,
            {
              plan: plan?.title,
              limit: GraceLimits[type],
              current: count,
            },
          );
        } else {
          const gracePeriodStartAt = ncMeta.now();

          const updateObject: Partial<Workspace> = {};

          if (type === PlanLimitTypes.LIMIT_API_CALL) {
            updateObject.api_grace_period_start_at = gracePeriodStartAt;
          } else if (type === PlanLimitTypes.LIMIT_AUTOMATION_RUN) {
            updateObject.automation_grace_period_start_at = gracePeriodStartAt;
          } else {
            updateObject.grace_period_start_at = gracePeriodStartAt;
          }

          await Workspace.update(workspaceId, updateObject, ncMeta);

          return;
        }
      } else {
        NcError.planLimitExceeded(
          message?.({
            limit,
            plan: plan?.title,
          }) ||
            `You have reached the limit of ${limit} (${type}) for your plan.`,
          {
            plan: plan?.title,
            limit,
            current: count,
          },
        );
      }
    }
  } catch (e) {
    if (throwError) {
      throw e;
    }
  }
}

async function checkSeatLimit(
  workspaceId: string,
  fkUserId: string | null,
  oldRole: WorkspaceUserRoles | ProjectRoles,
  newRole: WorkspaceUserRoles | ProjectRoles,
  ncMeta = Noco.ncMeta,
) {
  const { seatCount, nonSeatCount, seatUsersMap } =
    await Subscription.calculateWorkspaceSeatCount(workspaceId, ncMeta);

  /**
   * If user is already seatUser then no need to increase count to check
   */
  const increaseCount = fkUserId ? (seatUsersMap.has(fkUserId) ? 0 : 1) : 1;

  if (!NON_SEAT_ROLES.includes(newRole) && NON_SEAT_ROLES.includes(oldRole)) {
    const { limit: editorLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_EDITOR,
      workspaceId,
      ncMeta,
    );

    // check if user limit is reached or going to be exceeded
    if (seatCount + increaseCount > editorLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${editorLimitForWorkspace} editors are allowed for your plan, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: editorLimitForWorkspace,
          current: seatCount,
        },
      );
    }
  }

  if (NON_SEAT_ROLES.includes(newRole) && !NON_SEAT_ROLES.includes(oldRole)) {
    const { limit: commenterLimitForWorkspace, plan } = await getLimit(
      PlanLimitTypes.LIMIT_COMMENTER,
      workspaceId,
      ncMeta,
    );

    // check if commenter limit is reached or going to be exceeded
    if (nonSeatCount + 1 > commenterLimitForWorkspace) {
      NcError.planLimitExceeded(
        `Only ${commenterLimitForWorkspace} commenters are allowed for your plan, for more please upgrade your plan`,
        {
          plan: plan?.title,
          limit: commenterLimitForWorkspace,
          current: nonSeatCount,
        },
      );
    }
  }
}

async function getFeature(
  type: PlanFeatureTypes,
  workspaceOrId?: string | Workspace,
  ncMeta = Noco.ncMeta,
) {
  if (!workspaceOrId) {
    if (!GenericFeatures[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return GenericFeatures[type] || false;
  }

  const workspace =
    typeof workspaceOrId === 'string'
      ? await Workspace.get(workspaceOrId, undefined, ncMeta)
      : workspaceOrId;

  if (!workspace) {
    NcError.forbidden('You are not allowed to perform this action');
  }

  return (
    workspace?.payment?.plan?.meta?.[type] || GenericFeatures[type] || false
  );
}

async function getWorkspaceOrOrg(
  workspaceOrOrgId: string,
  ncMeta = Noco.ncMeta,
): Promise<
  | (Workspace & {
      entity: 'workspace';
      loyal?: boolean;
      loyalty_discount_used?: boolean;
    })
  | (Org & { entity: 'org'; loyal?: boolean; loyalty_discount_used?: boolean })
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

async function getActivePlanAndSubscription(
  workspaceOrOrgId: string,
  ncMeta = Noco.ncMeta,
) {
  const subscription = await Subscription.getByWorkspaceOrOrg(
    workspaceOrOrgId,
    ncMeta,
  );

  if (!subscription) return { plan: FreePlan };

  const plan = await Plan.get(subscription.fk_plan_id, ncMeta);

  return { plan, subscription };
}

// if Cloud, then check if sso is available for the workspace/org
export async function checkIfWorkspaceSSOAvail(
  workspaceId: string,
  throwError = true,
) {
  if (process.env.NC_CLOUD !== 'true') {
    if (throwError)
      NcError.forbidden('This feature is not available in self-hosted version');
    else return false;
  }

  const isSSOEnabled = await getFeature(
    PlanFeatureTypes.FEATURE_SSO,
    workspaceId,
  );

  if (!isSSOEnabled) {
    if (throwError)
      NcError.forbidden('SSO is not available for this workspace');
    else return false;
  }

  return true;
}

export function calculateUnitPrice(
  price: Stripe.Price,
  workspaceSeatCount: number,
  mode: 'month' | 'year',
) {
  if (price.billing_scheme === 'tiered' && price.tiers_mode === 'volume') {
    const tier = price.tiers.find(
      (tier: any) => workspaceSeatCount <= (tier.up_to ?? Infinity),
    );

    if (!tier) return 0;

    return (
      (tier.unit_amount + tier.flat_amount) / 100 / (mode === 'year' ? 12 : 1)
    );
  } else if (
    price.billing_scheme === 'tiered' &&
    price.tiers_mode === 'graduated'
  ) {
    let remainingSeats = workspaceSeatCount;
    let total = 0;
    let previousUpTo = 0;

    for (const tier of price.tiers) {
      const tierLimit = tier.up_to ?? Infinity;
      const tierSeats = Math.min(remainingSeats, tierLimit);
      const seatsInTier = tierSeats - (previousUpTo ?? 0);

      if (seatsInTier > 0) {
        total += tier.unit_amount + (tier.flat_amount || 0);
        remainingSeats -= seatsInTier;
      }

      if (tier.up_to === null || workspaceSeatCount <= tierLimit) break;

      previousUpTo = tierLimit;
    }

    return total / 100 / (mode === 'year' ? 12 : 1);
  }

  return price.unit_amount / 100 / (mode === 'year' ? 12 : 1);
}

// check if email only allowed through sso LOGIN
export const checkIfEmailAllowedNonSSO = async (
  workspaceId: string,
  email: string,
) => {
  const domains = await Domain.list({
    workspaceId,
  });

  return (
    !!email && domains?.some((d: Domain) => d.domain === email?.split('@')[1])
  );
};
export {
  PlanLimitTypes,
  PlanFeatureTypes,
  checkLimit,
  getLimit,
  getFeature,
  GenericLimits,
  GenericFeatures,
  getWorkspaceOrOrg,
  getActivePlanAndSubscription,
  checkSeatLimit,
};
