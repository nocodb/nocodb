import Noco from '../../lib/noco/Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../noco-cache/NocoCache';
import extractProps from '../noco/meta/helpers/extractProps';

export default class CurrencyColumn {
  currency_locale: string;
  currency_code: string;
  fk_column_id: string;

  constructor(data: Partial<CurrencyColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<CurrencyColumn>,
    ncMeta = Noco.ncMeta
  ) {
    await ncMeta.metaInsert2(null, null, MetaTable.COL_CURRENCY, {
      fk_column_id: data.fk_column_id,
      currency_locale: data.currency_locale,
      currency_code: data.currency_code
    });

    return this.read(data.fk_column_id, ncMeta);
  }
  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_CURRENCY}:${columnId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_CURRENCY,
        { fk_column_id: columnId }
      );
      await NocoCache.set(`${CacheScope.COL_CURRENCY}:${columnId}`, column);
    }

    return column ? new CurrencyColumn(column) : null;
  }

  id: string;

  static async update(
    id: string,
    currency: Partial<CurrencyColumn>,
    ncMeta = Noco.ncMeta
  ) {
    const updateObj = extractProps(currency, [
      'currency_locale',
      'currency_code',
      'fk_column_id'
    ]);
    // get existing cache
    const key = `${CacheScope.COL_CURRENCY}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.COL_CURRENCY, updateObj, id);
  }
}
