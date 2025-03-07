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

export const DefaultLimits = {
  limit_workspace_row: 10 * 1000,
  limit_base: 5,
  limit_source: 1,
  limit_table: 100,
  limit_column: 500,
  limit_table_row: 10 * 1000,
  limit_webhook: 5,
  limit_view: 200,
  limit_filter: 30,
  limit_sort: 10,
} as const;

export const FreePlan = {
  title: 'Free',
  description: 'Free plan',
  meta: DefaultLimits,
  free: true,
} as const;

export default class Plan {
  id: string;
  title: string;
  description: string;
  stripe_product_id: string;
  is_active: boolean;

  prices: {
    id: string;
    type: string;
    billing_scheme: string;
    currency: string;
    unit_amount: number;
  }[];

  meta: {
    limit_workspace_row?: number;
    limit_base?: number;
    limit_source?: number;
    limit_table?: number;
    limit_column?: number;
    limit_table_row?: number;
    limit_webhook?: number;
    limit_view?: number;
    limit_filter?: number;
    limit_sort?: number;
  };

  free?: boolean;

  // timestamps
  created_at: string;
  updated_at: string;

  constructor(plan: Partial<Plan>) {
    Object.assign(this, plan);
  }

  public static prepare(data: Partial<Plan>) {
    const response = prepareForResponse(data, ['prices', 'meta']);

    Object.assign(response, {
      limits: {
        ...DefaultLimits,
        ...response.meta,
      },
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

    return plans.map((plan) => this.prepare(plan));
  }

  static async getWithCondition(
    condition: Record<string, any>,
    ncMeta = Noco.ncMeta,
  ) {
    const plans = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.PLANS,
      condition,
    );

    return plans.map((plan) => this.prepare(plan));
  }
}
