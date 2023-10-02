import type { SortType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { extractProps } from '~/helpers/extractProps';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

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

  public static get(key: string, ncMeta = Noco.ncMeta): Promise<Store> {
    return ncMeta.metaGet(null, null, MetaTable.STORE, { key });
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

    const existing = await Store.get(store.key, ncMeta);
    if (existing) {
      await ncMeta.metaUpdate(null, null, MetaTable.STORE, insertObj, {
        key: store.key,
      });
    } else {
      await ncMeta.metaInsert(null, null, MetaTable.STORE, insertObj);
    }
  }
}
