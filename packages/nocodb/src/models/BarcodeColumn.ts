import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models/index';
import { NcError } from '~/helpers/catchError';

export default class BarcodeColumn {
  id: string;
  fk_workspace_id?: string;
  fk_base_id?: string;
  fk_column_id: string;
  fk_barcode_value_column_id: string;
  barcode_format: string;

  constructor(data: Partial<BarcodeColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    barcodeColumn: Partial<BarcodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(barcodeColumn, [
      'fk_column_id',
      'fk_barcode_value_column_id',
      'barcode_format',
    ]);

    const column = await Column.get(
      context,
      {
        colId: insertObj.fk_column_id,
      },
      ncMeta,
    );

    if (!column) {
      NcError.fieldNotFound(insertObj.fk_column_id);
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_BARCODE,
      insertObj,
    );

    return this.read(context, barcodeColumn.fk_column_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_BARCODE}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_BARCODE,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_BARCODE}:${columnId}`, column);
    }

    return column ? new BarcodeColumn(column) : null;
  }

  async getValueColumn(context: NcContext, ncMeta = Noco.ncMeta) {
    return Column.get(
      context,
      {
        colId: this.fk_barcode_value_column_id,
      },
      ncMeta,
    );
  }
}
