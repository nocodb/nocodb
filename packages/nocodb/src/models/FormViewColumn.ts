import type {
  BoolType,
  FormColumnType,
  MetaType,
  StringOrNullType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { deserializeJSON, serializeJSON } from '~/utils/serialize';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class FormViewColumn implements FormColumnType {
  id?: string;
  fk_view_id?: string;
  fk_column_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  label?: StringOrNullType;
  help?: StringOrNullType;
  description?: StringOrNullType;
  required?: BoolType;
  enable_scanner?: BoolType;
  uuid?: StringOrNullType;
  show?: BoolType;
  order?: number;
  meta?: MetaType;

  constructor(data: FormViewColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    formViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      formViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW_COLUMNS,
        formViewColumnId,
      );

      if (viewColumn) {
        viewColumn.meta =
          viewColumn.meta && typeof viewColumn.meta === 'string'
            ? JSON.parse(viewColumn.meta)
            : viewColumn.meta;

        await NocoCache.set(
          `${CacheScope.FORM_VIEW_COLUMN}:${formViewColumnId}`,
          viewColumn,
        );
      }
    }

    return viewColumn && new FormViewColumn(viewColumn);
  }

  static async insert(
    context: NcContext,
    column: Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'label',
      'help',
      'description',
      'required',
      'enable_scanner',
      'meta',
    ]);

    insertObj.order = await ncMeta.metaGetNextOrder(
      MetaTable.FORM_VIEW_COLUMNS,
      {
        fk_view_id: insertObj.fk_view_id,
      },
    );

    if (insertObj.meta) {
      insertObj.meta = serializeJSON(insertObj.meta);
    }

    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW_COLUMNS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.FORM_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.FORM_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<FormViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.FORM_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: viewColumns } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !viewColumns.length) {
      viewColumns = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.FORM_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );

      for (const viewColumn of viewColumns) {
        viewColumn.meta = deserializeJSON(viewColumn.meta);
      }

      await NocoCache.setList(
        CacheScope.FORM_VIEW_COLUMN,
        [viewId],
        viewColumns,
      );
    }
    viewColumns.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return viewColumns?.map((v) => new FormViewColumn(v));
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<FormViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'label',
      'help',
      'description',
      'required',
      'show',
      'order',
      'meta',
      'enable_scanner',
    ]);

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.FORM_VIEW_COLUMNS,
      prepareForDb(updateObj),
      columnId,
    );

    await NocoCache.update(
      `${CacheScope.FORM_VIEW_COLUMN}:${columnId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
