import {
  GRACE_PERIOD_DURATION,
  PlanFeatureTypes,
  PlanLimitTypes,
} from 'nocodb-sdk';
import dayjs from 'dayjs';
import { NcError } from '~/helpers/catchError';
import { Org, Subscription, Workspace } from '~/models';
import Noco from '~/Noco';
import Plan, {
  FreePlan,
  GenericFeatures,
  GenericLimits,
  GraceLimits,
} from '~/models/Plan';

async function getLimit(
  type: PlanLimitTypes,
  workspaceId?: string,
  ncMeta = Noco.ncMeta,
): Promise<{
  limit: number;
  plan?: Partial<Plan>;
}> {
  if (!workspaceId) {
    if (!GenericLimits[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return {
      limit: GenericLimits[type] || Infinity,
    };
  }

  const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

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
  ncMeta?: typeof Noco.ncMeta;
}): Promise<void> {
  const { workspaceId, type, delta, message, ncMeta = Noco.ncMeta } = args;

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
    if (type in GraceLimits) {
      const gracePeriodStartAt = workspace.grace_period_start_at;

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

        await Workspace.update(
          workspaceId,
          {
            grace_period_start_at: gracePeriodStartAt,
          },
          ncMeta,
        );

        return;
      }
    } else {
      NcError.planLimitExceeded(
        message?.({
          limit,
          plan: plan?.title,
        }) || `You have reached the limit of ${limit} (${type}) for your plan.`,
        {
          plan: plan?.title,
          limit,
          current: count,
        },
      );
    }
  }
}

async function getFeature(
  type: PlanFeatureTypes,
  workspaceId?: string,
  ncMeta = Noco.ncMeta,
) {
  if (!workspaceId) {
    if (!GenericFeatures[type]) {
      NcError.forbidden('You are not allowed to perform this action');
    }

    return GenericFeatures[type] || false;
  }

  const workspace = await Workspace.get(workspaceId, undefined, ncMeta);

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
): Promise<(Workspace & { entity: 'workspace' }) | (Org & { entity: 'org' })> {
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
};
