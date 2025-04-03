import { PlanLimitTypes } from 'nocodb-sdk';
import type { PlanFeatureTypes } from 'nocodb-sdk';
import type Stripe from 'stripe';
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
import { GenericFeatures, GenericLimits } from '~/helpers/paymentHelpers';

export default class Plan {
  id: string;
  title: string;
  description: string;
  stripe_product_id: string;
  is_active: boolean;

  prices: Stripe.Price[];

  meta: { [key in PlanLimitTypes]: number } & {
    [key in PlanFeatureTypes]: boolean;
  } & {
    description_1?: string;
    description_2?: string;
    description_3?: string;
    description_4?: string;
    description_5?: string;
  };

  free?: boolean;

  // timestamps
  created_at: string;
  updated_at: string;

  constructor(plan: Partial<Plan>) {
    Object.assign(this, plan);
  }

  public static prepare(data: Partial<Plan>): Plan {
    const response = prepareForResponse(data, ['prices', 'meta']);

    const limits: Record<string, number> = {
      ...GenericLimits,
    };
    const features: Record<string, boolean> = {
      ...GenericFeatures,
    };
    const descriptions: string[] = [];

    for (const [key, value] of Object.entries(
      (response.meta || {}) as Record<string, string>,
    )) {
      if (key.startsWith('limit_')) {
        limits[key] = +value;
      } else if (key.startsWith('feature_')) {
        features[key] = !!value;
      } else if (key.startsWith('description_')) {
        descriptions.push(value);
      }
    }

    Object.assign(response, {
      limits,
      features,
      descriptions,
    });

    return response;
  }

  public static async get(planId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.PLANS}:${planId}`;
    let plan = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (!plan) {
      plan = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.PLANS,
        {
          id: planId,
        },
      );

      if (!plan) return null;

      await NocoCache.set(key, this.prepare(plan));
    }

    return this.prepare(plan);
  }

  public static async insert(plan: Partial<Plan>, ncMeta = Noco.ncMeta) {
    const insertObj: Record<string, any> = extractProps(plan, [
      'title',
      'description',
      'stripe_product_id',
      'is_active',
      'prices',
      'meta',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
      prepareForDb(insertObj, ['prices', 'meta']),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    planId: string,
    plan: Partial<Plan>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(plan, [
      'title',
      'description',
      'is_active',
      'prices',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
      prepareForDb(updateObj, ['prices', 'meta']),
      planId,
    );

    await NocoCache.update(`${CacheScope.PLANS}:${planId}`, this.prepare(plan));

    return true;
  }

  public static async delete(planId: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
      planId,
    );

    const key = `${CacheScope.PLANS}:${planId}`;
    await NocoCache.del(key);

    return true;
  }

  static async list() {
    const plans = await Noco.ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
    );

    return plans
      .map((plan) => this.prepare(plan))
      .sort((a, b) => {
        return a.prices[0].unit_amount - b.prices[0].unit_amount;
      });
  }

  static async getWithCondition(
    condition: Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    const plans = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
      {
        condition,
      },
    );

    return plans
      .map((plan) => this.prepare(plan))
      .sort((a, b) => {
        return a.prices[0].unit_amount - b.prices[0].unit_amount;
      });
  }
}

export const FreePlan = Plan.prepare({
  title: 'Free',
  description: 'Free plan',
  meta: {
    ...GenericLimits,
    ...GenericFeatures,
    // Free plan specific limits
    [PlanLimitTypes.LIMIT_EDITOR]: 5,
    [PlanLimitTypes.LIMIT_USER]: 25,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000,
    [PlanLimitTypes.LIMIT_API_CALL]: 1000,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 7,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 14,
    [PlanLimitTypes.LIMIT_SOURCE_PER_BASE]: 1,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 1024,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
    [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 0,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 0,
  },
  free: true,
});
