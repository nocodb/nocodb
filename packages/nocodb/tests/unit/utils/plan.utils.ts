import { isEE } from 'playwright/setup/db';
import { nanoid } from 'nanoid';
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
  if (isEE()) {
    const subscriptionAliasKey = `${CacheScope.SUBSCRIPTIONS_ALIAS}:${workspace_id}`;
    const subscriptionCacheKey =
      (await NocoCache.get(subscriptionAliasKey)) ?? nanoid();
    await NocoCache.set(subscriptionAliasKey, subscriptionCacheKey);
    const planId = (await NocoCache.get(subscriptionCacheKey)) ?? nanoid();
    const baseSubscription = await NocoCache.get(subscriptionCacheKey);
    await NocoCache.set(subscriptionCacheKey, {
      ...baseSubscription,
      status: 'active',
      fk_plan_id: planId,
    });

    const { FreePlan } = await import('~/ee/models/Plan.ts');
    const planCacheKey = `${CacheScope.PLANS}:${planId}`;
    const basePlan = (await NocoCache.get(planCacheKey)) ?? FreePlan;
    const overriddenPlan = {
      ...basePlan,
      meta: {
        ...basePlan.meta,
        [feature]: allowed,
      },
    };
    await NocoCache.set(planCacheKey, overriddenPlan);

    // delete workspace cache
    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspace_id}`);

    return {
      restore: async () => {
        await NocoCache.del([
          subscriptionAliasKey,
          subscriptionCacheKey,
          planCacheKey,
        ]);
      },
    };
  }
  return { restore: () => {} };
};
