import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models';

export default class QrCodeColumn {
  fk_column_id: string;
  fk_qr_value_column_id: string;

  constructor(data: Partial<QrCodeColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    qrCode: Partial<QrCodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(qrCode, [
      'fk_column_id',
      'fk_qr_value_column_id',
    ]);

    await ncMeta.metaInsert2(null, null, MetaTable.COL_QRCODE, insertObj);

    return this.read(qrCode.fk_column_id, ncMeta);
  }
  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_QRCODE}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_QRCODE,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_QRCODE}:${columnId}`, column);
    }

    return column ? new QrCodeColumn(column) : null;
  }

  id: string;

  static async update(
    id: string,
    qrCode: Partial<QrCodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(qrCode, [
      'fk_column_id',
      'fk_qr_value_column_id',
    ]);
    // get existing cache
    const key = `${CacheScope.COL_QRCODE}:${id}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.COL_QRCODE, updateObj, id);
  }

  async getValueColumn() {
    return Column.get({
      colId: this.fk_qr_value_column_id,
    });
  }
}
