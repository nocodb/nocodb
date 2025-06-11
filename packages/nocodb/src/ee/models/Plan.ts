import { ncIsBoolean, PlanLimitTypes, PlanOrder, PlanTitles } from 'nocodb-sdk';
import { PlanFeatureTypes } from 'nocodb-sdk';
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

const sortPlan = (a: Plan, b: Plan) => {
  return (PlanOrder[a.title] ?? 0) - (PlanOrder[b.title] ?? 0);
};

export default class Plan {
  id: string;
  title: PlanTitles;
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

    const descriptions: string[] = [];

    for (const [key, value] of Object.entries(
      (response.meta || {}) as Record<string, string>,
    )) {
      if (key.startsWith('limit_')) {
        response.meta[key] = +value;
      } else if (key.startsWith('feature_')) {
        response.meta[key] = ncIsBoolean(value) ? value : value === 'true';
      } else if (key.startsWith('description_')) {
        descriptions.push(value);
      }
    }

    Object.assign(response, {
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

    return plans.map((plan) => this.prepare(plan)).sort(sortPlan);
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

    return plans.map((plan) => this.prepare(plan)).sort(sortPlan);
  }
}

export const GenericLimits = {
  [PlanLimitTypes.LIMIT_FREE_WORKSPACE]: 8,
  [PlanLimitTypes.LIMIT_TABLE_PER_BASE]: 200,
  [PlanLimitTypes.LIMIT_COLUMN_PER_TABLE]: 500,
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_TABLE]: 25,
  [PlanLimitTypes.LIMIT_VIEW_PER_TABLE]: 200,
  [PlanLimitTypes.LIMIT_FILTER_PER_VIEW]: 50,
  [PlanLimitTypes.LIMIT_SORT_PER_VIEW]: 10,
  [PlanLimitTypes.LIMIT_BASE_PER_WORKSPACE]: 500,
} as const;

export const GenericFeatures = {
  [PlanFeatureTypes.FEATURE_AI]: false,
  [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: false,
  [PlanFeatureTypes.FEATURE_AT_MENTION]: false,
  [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: false,
  [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: false,
  [PlanFeatureTypes.FEATURE_CUSTOM_URL]: false,
  [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: false,
  [PlanFeatureTypes.FEATURE_EXTENSIONS]: false,
  [PlanFeatureTypes.FEATURE_FILE_MODE]: false,
  [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: false,
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: false,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: false,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: false,
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: false,
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: false,
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: false,
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: false,
  [PlanFeatureTypes.FEATURE_SCRIPTS]: false,
  [PlanFeatureTypes.FEATURE_SSO]: false,
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: false,
  [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: false,
  [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]: false,
} as const;

export const GraceLimits = {
  [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 100000,
  [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 10000,
  [PlanLimitTypes.LIMIT_API_CALL]: 100000,
  [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 10000,
};

const legacyLimitAndFeatures = {
  [PlanLimitTypes.LIMIT_EDITOR]: 50,
  [PlanLimitTypes.LIMIT_COMMENTER]: 50,
  [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 600000,
  [PlanLimitTypes.LIMIT_API_CALL]: -1,
  [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: -1,
  [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: -1,
  [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: -1,
  [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: -1,
  [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: -1,
  [PlanLimitTypes.LIMIT_API_PER_SECOND]: 10,
  [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: -1,
  [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: -1,
  [PlanLimitTypes.LIMIT_AI_TOKEN]: -1,
  [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: -1,
  [PlanFeatureTypes.FEATURE_AI]: true,
  [PlanFeatureTypes.FEATURE_AI_INTEGRATIONS]: true,
  [PlanFeatureTypes.FEATURE_AT_MENTION]: true,
  [PlanFeatureTypes.FEATURE_AUDIT_WORKSPACE]: true,
  [PlanFeatureTypes.FEATURE_COMMENT_RESOLVE]: true,
  [PlanFeatureTypes.FEATURE_CUSTOM_URL]: true,
  [PlanFeatureTypes.FEATURE_DISCUSSION_MODE]: true,
  [PlanFeatureTypes.FEATURE_EXTENSIONS]: true,
  [PlanFeatureTypes.FEATURE_FILE_MODE]: true,
  [PlanFeatureTypes.FEATURE_FORM_URL_REDIRECTION]: true,
  [PlanFeatureTypes.FEATURE_FORM_CUSTOM_LOGO]: true,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: true,
  [PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION]: true,
  [PlanFeatureTypes.FEATURE_GROUP_BY_AGGREGATIONS]: true,
  [PlanFeatureTypes.FEATURE_HIDE_BRANDING]: true,
  [PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER]: true,
  [PlanFeatureTypes.FEATURE_PERSONAL_VIEWS]: true,
  [PlanFeatureTypes.FEATURE_SCRIPTS]: true,
  [PlanFeatureTypes.FEATURE_SSO]: true,
  [PlanFeatureTypes.FEATURE_WEBHOOK_CUSTOM_PAYLOAD]: true,
  [PlanFeatureTypes.FEATURE_WORKSPACE_CUSTOM_LOGO]: true,
  [PlanFeatureTypes.FEATURE_CURRENT_USER_FILTER]: true,
};

export const FreePlan = Plan.prepare({
  title: PlanTitles.FREE,
  description: 'Free plan',
  meta: {
    ...GenericLimits,
    ...GenericFeatures,
    // Free plan specific limits
    [PlanLimitTypes.LIMIT_EDITOR]: 3,
    [PlanLimitTypes.LIMIT_COMMENTER]: 10,
    [PlanLimitTypes.LIMIT_RECORD_PER_WORKSPACE]: 1000,
    [PlanLimitTypes.LIMIT_API_CALL]: 1000,
    [PlanLimitTypes.LIMIT_AUTOMATION_RUN]: 100,
    [PlanLimitTypes.LIMIT_AUTOMATION_RETENTION]: 0,
    [PlanLimitTypes.LIMIT_AUDIT_RETENTION]: 14,
    [PlanLimitTypes.LIMIT_EXTERNAL_SOURCE_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_STORAGE_PER_WORKSPACE]: 1000,
    [PlanLimitTypes.LIMIT_API_PER_SECOND]: 5,
    [PlanLimitTypes.LIMIT_WEBHOOK_PER_WORKSPACE]: 50,
    [PlanLimitTypes.LIMIT_EXTENSION_PER_WORKSPACE]: 1,
    [PlanLimitTypes.LIMIT_AI_TOKEN]: 0,
    [PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE]: 0,
    [PlanFeatureTypes.FEATURE_FORM_FIELD_ON_CONDITION]: true,
    ...(process.env.NODE_ENV === 'test'
      ? {
          [PlanFeatureTypes.FEATURE_SSO]: true,
        }
      : {}),
    ...(!process.env.NC_STRIPE_SECRET_KEY ? legacyLimitAndFeatures : {}),
  },
  free: true,
});
