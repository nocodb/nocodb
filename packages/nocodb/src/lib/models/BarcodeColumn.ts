import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';

export default class BarcodeColumn {
  id: string;
  fk_column_id: string;
  fk_barcode_value_column_id: string;
  barcode_format: string;

  constructor(data: Partial<BarcodeColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<BarcodeColumn>,
    ncMeta = Noco.ncMeta
  ) {
    await ncMeta.metaInsert2(null, null, MetaTable.COL_BARCODE, {
      fk_column_id: data.fk_column_id,
      fk_barcode_value_column_id: data.fk_barcode_value_column_id,
      barcode_format: data.barcode_format,
    });

    return this.read(data.fk_column_id, ncMeta);
  }
  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_BARCODE}:${columnId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_BARCODE,
        { fk_column_id: columnId }
      );
      await NocoCache.set(`${CacheScope.COL_BARCODE}:${columnId}`, column);
    }

    return column ? new BarcodeColumn(column) : null;
  }

  static async update(
    id: string,
    barcode: Partial<BarcodeColumn>,
    ncMeta = Noco.ncMeta
  ) {
    const updateObj = extractProps(barcode, [
      'fk_column_id',
      'fk_barcode_value_column_id',
      'barcode_format',
    ]);
    // get existing cache
    const key = `${CacheScope.COL_BARCODE}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.COL_BARCODE, updateObj, id);
  }
}
