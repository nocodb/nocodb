import { nanoid } from 'nanoid';
import { PlanTitles, resolvePlanMeta } from 'nocodb-sdk';
import { isEE } from './helpers';
import { CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

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
  planTitle = PlanTitles.FREE,
  features,
  limits,
}: {
  workspace_id: string;
  planTitle?: PlanTitles;
  features?: {
    [key: string]: boolean;
  };
  limits?: {
    [key: string]: number;
  };
}) => {
  if (isEE()) {
    const subscriptionAliasKey = `${CacheScope.SUBSCRIPTIONS_ALIAS}:${workspace_id}`;
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
