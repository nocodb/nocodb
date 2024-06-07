import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

export default class QrCodeColumn {
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id: string;
  fk_qr_value_column_id: string;

  constructor(data: Partial<QrCodeColumn>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    qrCode: Partial<QrCodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(qrCode, [
      'fk_column_id',
      'fk_qr_value_column_id',
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
      MetaTable.COL_QRCODE,
      insertObj,
    );

    return this.read(context, qrCode.fk_column_id, ncMeta);
  }
  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_QRCODE}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_QRCODE,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_QRCODE}:${columnId}`, column);
    }

    return column ? new QrCodeColumn(column) : null;
  }

  id: string;

  async getValueColumn(context: NcContext) {
    return Column.get(context, {
      colId: this.fk_qr_value_column_id,
    });
  }
}
