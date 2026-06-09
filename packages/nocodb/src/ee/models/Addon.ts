import type { PlanAddonTypes } from 'nocodb-sdk';
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

export default class Addon {
  id?: string;
  addon_key: PlanAddonTypes;
  title?: string;
  description?: string;
  stripe_product_id: string;
  prices?: Stripe.Price[];
  is_active?: boolean;
  meta?: Record<string, any>;

  // timestamps
  created_at?: string;
  updated_at?: string;

  constructor(addon: Partial<Addon>) {
    Object.assign(this, addon);
  }

  public static prepare(data: Partial<Addon>): Addon {
    return prepareForResponse(data, ['prices', 'meta']);
  }

  public static async get(addonId: string, ncMeta = Noco.ncMeta) {
    const key = `${CacheScope.ADDONS}:${addonId}`;
    let addon = await NocoCache.get('root', key, CacheGetType.TYPE_OBJECT);
    if (!addon) {
      addon = await ncMeta.metaGet2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.ADDONS,
        {
          id: addonId,
        },
      );

      if (!addon) return null;

      await NocoCache.set('root', key, addon);
    }

    return this.prepare(addon);
  }

  public static async getByKey(addonKey: PlanAddonTypes, ncMeta = Noco.ncMeta) {
    const addon = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ADDONS,
      {
        addon_key: addonKey,
      },
    );

    if (!addon) return null;

    return this.prepare(addon);
  }

  public static async insert(addon: Partial<Addon>, ncMeta = Noco.ncMeta) {
    const insertObj: Record<string, any> = extractProps(addon, [
      'addon_key',
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
      MetaTable.ADDONS,
      prepareForDb(insertObj, ['prices', 'meta']),
    );

    return this.get(id, ncMeta);
  }

  public static async update(
    addonId: string,
    addon: Partial<Addon>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj: Record<string, any> = extractProps(addon, [
      'title',
      'description',
      'is_active',
      'prices',
      'meta',
    ]);

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ADDONS,
      prepareForDb(updateObj, ['prices', 'meta']),
      addonId,
    );

    await NocoCache.del('root', `${CacheScope.ADDONS}:${addonId}`);

    return this.get(addonId, ncMeta);
  }

  public static async list(ncMeta = Noco.ncMeta): Promise<Addon[]> {
    const addons = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.ADDONS,
    );

    return addons.map((addon) => this.prepare(addon));
  }
}
