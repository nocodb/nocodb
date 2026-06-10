import type { PlanAddonTypes } from 'nocodb-sdk';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class SubscriptionAddon {
  id?: string;
  fk_subscription_id: string;
  fk_addon_id: string;
  addon_key: PlanAddonTypes;
  stripe_subscription_item_id?: string | null;
  seat_count?: number;
  status?: 'active' | 'canceled';
  meta?: Record<string, any>;

  // timestamps
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<SubscriptionAddon>) {
    Object.assign(this, data);
  }

  public static prepare(data: Partial<SubscriptionAddon>): SubscriptionAddon {
    return prepareForResponse(data, ['meta']);
  }

  public static async get(id: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.SUBSCRIPTION_ADDONS}:${id}`;
    let row = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
    if (!row) {
      row = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SUBSCRIPTION_ADDONS,
        {
          id,
        },
      );

      if (!row) return null;

      await NocoCache.set('root', key, row);
    }

    return new SubscriptionAddon(this.prepare(row));
  }

  public static async insert(
    data: Partial<SubscriptionAddon>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj: Record<string, any> = extractProps(data, [
      'fk_subscription_id',
      'fk_addon_id',
      'addon_key',
      'stripe_subscription_item_id',
      'seat_count',
      'status',
      'meta',
    ]);

    const { id } = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTION_ADDONS,
      prepareForDb(insertObj),
    );

    const subscriptionAddon = await this.get(id, ncMeta);

    await NocoCache.appendToList(
      'root',
      CacheScope.SUBSCRIPTION_ADDONS,
      [data.fk_subscription_id],
      `${CacheScope.SUBSCRIPTION_ADDONS}:${id}`,
    );

    return subscriptionAddon;
  }

  public static async update(
    id: string,
    data: Partial<SubscriptionAddon>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(data, [
      'stripe_subscription_item_id',
      'seat_count',
      'status',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.SUBSCRIPTION_ADDONS,
      prepareForDb(updateObj),
      id,
    );

    await NocoCache.deepDel(
      'root',
      `${CacheScope.SUBSCRIPTION_ADDONS}:${id}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.get(id, ncMeta);
  }

  public static async listActive(
    fk_subscription_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<SubscriptionAddon[]> {
    // An unpersisted subscription (e.g. test plan overrides) has no id and thus
    // no add-on rows — short-circuit before the metaList query binds undefined.
    if (!fk_subscription_id) return [];

    const cachedList = await NocoCache.getList(
      'root',
      CacheScope.SUBSCRIPTION_ADDONS,
      [fk_subscription_id],
    );
    const { list: cachedRows, isNoneList } = cachedList;

    if (!isNoneList && !cachedRows.length) {
      const rows = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.SUBSCRIPTION_ADDONS,
        {
          xcCondition: {
            _and: [
              { fk_subscription_id: { eq: fk_subscription_id } },
              { status: { eq: 'active' } },
            ],
          },
        },
      );

      await NocoCache.setList(
        'root',
        CacheScope.SUBSCRIPTION_ADDONS,
        [fk_subscription_id],
        rows,
      );

      return rows.map((row) => new SubscriptionAddon(this.prepare(row)));
    }

    return cachedRows.map((row) => new SubscriptionAddon(this.prepare(row)));
  }

  public static async getActiveByKey(
    fk_subscription_id: string,
    addon_key: PlanAddonTypes,
    ncMeta = Noco.ncMeta,
  ): Promise<SubscriptionAddon | null> {
    const active = await this.listActive(fk_subscription_id, ncMeta);
    return active.find((a) => a.addon_key === addon_key) ?? null;
  }
}
