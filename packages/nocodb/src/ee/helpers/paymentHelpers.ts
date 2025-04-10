import { PlanFeatureTypes, PlanLimitTypes } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { Org, Subscription, Workspace } from '~/models';
import Noco from '~/Noco';
import Plan, { FreePlan, GenericFeatures, GenericLimits } from '~/models/Plan';

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
  getLimit,
  getFeature,
  GenericLimits,
  GenericFeatures,
  getWorkspaceOrOrg,
  getActivePlanAndSubscription,
};
