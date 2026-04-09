import { nanoid } from 'nanoid';
import { PlanTitles, resolvePlanMeta } from 'nocodb-sdk';
import { isEE } from './helpers';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { Workspace } from '~/models';

export const overrideFeature = async ({
  workspace_id,
  feature,
  allowed,
}: {
  workspace_id: string;
  feature: string;
  allowed: boolean;
}) => {
  return overridePlan({
    workspace_id,
    features: {
      [feature]: allowed,
    },
  });
};

export const overridePlan = async ({
  workspace_id,
  org_id,
  planTitle = PlanTitles.FREE,
  features,
  limits,
}: {
  workspace_id: string;
  org_id?: string;
  planTitle?: PlanTitles;
  features?: {
    [key: string]: boolean;
  };
  limits?: {
    [key: string]: number;
  };
}) => {
  if (isEE()) {
    // Workspace.get resolves payment via (fk_org_id || workspace.id).
    // Auto-detect org_id from the workspace if not provided.
    let subscriptionOwner = org_id || workspace_id;
    if (!org_id) {
      const ws = await Workspace.get(workspace_id, false);
      if (ws?.fk_org_id) {
        subscriptionOwner = ws.fk_org_id;
      }
    }
    const subscriptionAliasKey = `${CacheScope.SUBSCRIPTIONS_ALIAS}:${subscriptionOwner}`;
    const subscriptionCacheKey =
      (await NocoCache.get('root', subscriptionAliasKey)) ?? nanoid();
    await NocoCache.set('root', subscriptionAliasKey, subscriptionCacheKey);

    const baseSubscription = await NocoCache.get('root', subscriptionCacheKey);
    const planId = baseSubscription?.fk_plan_id ?? nanoid();
    const planMeta = {
      ...(features ?? {}),
      ...(limits ?? {}),
    };

    await NocoCache.set('root', subscriptionCacheKey, {
      ...baseSubscription,
      status: 'active',
      fk_plan_id: planId,
      meta: {
        ...(baseSubscription?.meta ?? {}),
        plan_meta: {
          ...(baseSubscription?.meta?.plan_meta ?? {}),
          ...planMeta,
        },
      },
    });

    const planCacheKey = `${CacheScope.PLANS}:${planId}`;
    await NocoCache.set('root', planCacheKey, {
      title: planTitle,
      meta: resolvePlanMeta(planTitle),
    });

    return {
      restore: async () => {
        await NocoCache.del('root', [
          subscriptionAliasKey,
          subscriptionCacheKey,
          planCacheKey,
        ]);
      },
    };
  }
  return { restore: () => {} };
};
