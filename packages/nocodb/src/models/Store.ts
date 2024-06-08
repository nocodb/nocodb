import type { SortType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';

// Store is used for storing key value pairs
export default class Store {
  key?: string;
  value?: string;
  type?: string;
  env?: string;
  tag?: string;
  base_id?: string;
  db_alias?: string;

  constructor(data: Partial<SortType>) {
    Object.assign(this, data);
  }

  public static async get(
    key: string,
    lookInCache = false,
    ncMeta = Noco.ncMeta,
  ): Promise<Store> {
    // get from cache if lookInCache is true
    if (lookInCache) {
      const storeData =
        key &&
        (await NocoCache.get(
          `${CacheScope.STORE}:${key}`,
          CacheGetType.TYPE_OBJECT,
        ));
      if (storeData) return storeData;
    }

    const storeData = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.STORE,
      {
        key,
      },
    );

    if (lookInCache)
      await NocoCache.set(`${CacheScope.STORE}:${key}`, storeData);

    return storeData;
  }

  static async saveOrUpdate(store: Store, ncMeta = Noco.ncMeta) {
    if (!store.key) {
      NcError.badRequest('Key is required');
    }

    const insertObj = extractProps(store, [
      'key',
      'value',
      'type',
      'env',
      'tag',
    ]);

    const existing = await Store.get(store.key, false, ncMeta);
    if (existing) {
      await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        insertObj,
        {
          key: store.key,
        },
      );
    } else {
      await ncMeta.metaInsert2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.STORE,
        insertObj,
        true,
      );
    }
    if (store.key) await NocoCache.del(`${CacheScope.STORE}:${store.key}`);
  }
}
