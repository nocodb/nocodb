import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import {
  getModelContext,
  setModelContext,
  throwMissingContext,
} from '~/helpers/modelContext';

export default class QrCodeColumn {
  base_id?: string;
  fk_workspace_id?: string;
  fk_column_id: string;
  fk_qr_value_column_id: string;
  error: string;

  constructor(data: Partial<QrCodeColumn>) {
    Object.assign(this, data);
  }

  get context(): NcContext {
    const ctx = getModelContext(this);
    if (ctx) return ctx;
    if (this.fk_workspace_id && this.base_id) {
      return {
        workspace_id: this.fk_workspace_id,
        base_id: this.base_id,
      } as NcContext;
    }
    throwMissingContext('QrCodeColumn');
  }

  public static async insert(
    context: NcContext,
    qrCode: Partial<QrCodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(qrCode, [
      'fk_column_id',
      'fk_qr_value_column_id',
      'error',
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
        context,
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
      await NocoCache.set(
        context,
        `${CacheScope.COL_QRCODE}:${columnId}`,
        column,
      );
    }

    if (!column) return null;
    const instance = new QrCodeColumn(column);
    setModelContext(instance, context);
    return instance;
  }

  id: string;

  async getValueColumn() {
    return Column.get(this.context, {
      colId: this.fk_qr_value_column_id,
    });
  }

  public static async update(
    context: NcContext,
    columnId: string,
    data: Partial<QrCodeColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(data, [
      'fk_column_id',
      'fk_qr_value_column_id',
      'error',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_QRCODE,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.COL_QRCODE}:${columnId}`,
      updateObj,
    );
  }
}
