import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { Column } from '~/models/index';
import { NcError } from '~/helpers/catchError';

export default abstract class LongTextColumn {
  id: string;

  fk_workspace_id?: string;
  base_id: string;
  fk_model_id: string;
  fk_column_id: string;

  constructor(data: Partial<LongTextColumn>) {
    Object.assign(this, data);
  }

  public static castType(data: LongTextColumn): LongTextColumn {
    return data;
  }

  protected static async _insert(
    context: NcContext,
    longTextColumn: Partial<LongTextColumn> & {
      fk_model_id: string;
      fk_column_id: string;
    },
    props: string[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(longTextColumn, [
      'fk_workspace_id',
      'base_id',
      'fk_model_id',
      'fk_column_id',
      ...(props || []),
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
      MetaTable.COL_LONG_TEXT,
      insertObj,
    );

    return this.read(context, longTextColumn.fk_column_id, ncMeta);
  }

  public static async read(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let column =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_LONG_TEXT}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!column) {
      column = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.COL_LONG_TEXT,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_LONG_TEXT}:${columnId}`, column);
    }

    return column ? this.castType(column) : null;
  }

  protected static async _update(
    context: NcContext,
    columnId: string,
    longTextColumn: Partial<LongTextColumn>,
    props: string[],
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(longTextColumn, [...(props || [])]);

    // set meta
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COL_LONG_TEXT,
      updateObj,
      {
        fk_column_id: columnId,
      },
    );

    await NocoCache.update(
      `${CacheScope.COL_LONG_TEXT}:${columnId}`,
      updateObj,
    );
  }
}
