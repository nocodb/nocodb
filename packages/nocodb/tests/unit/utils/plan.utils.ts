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
      (await NocoCache.get('root', subscriptionAliasKey)) ?? nanoid();
    await NocoCache.set('root', subscriptionAliasKey, subscriptionCacheKey);
    const planId =
      (await NocoCache.get('root', subscriptionCacheKey)) ?? nanoid();
    const baseSubscription = await NocoCache.get('root', subscriptionCacheKey);
    await NocoCache.set('root', subscriptionCacheKey, {
      ...baseSubscription,
      status: 'active',
      fk_plan_id: planId,
    });

    const { FreePlan } = await import('~/ee/models/Plan.ts');
    const planCacheKey = `${CacheScope.PLANS}:${planId}`;
    const basePlan = (await NocoCache.get('root', planCacheKey)) ?? FreePlan;
    const overriddenPlan = {
      ...basePlan,
      meta: {
        ...basePlan.meta,
        [feature]: allowed,
      },
    };
    await NocoCache.set('root', planCacheKey, overriddenPlan);

    // delete workspace cache
    await NocoCache.del('root', `${CacheScope.WORKSPACE}:${workspace_id}`);

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
