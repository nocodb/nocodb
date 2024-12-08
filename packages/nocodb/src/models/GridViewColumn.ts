import type { BoolType, GridColumnType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Upgrader from '~/Upgrader';
import View from '~/models/View';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class GridViewColumn implements GridColumnType {
  id: string;
  show: BoolType;
  order: number;
  width?: string;

  fk_view_id: string;
  fk_column_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  group_by?: BoolType;
  group_by_order?: number;
  group_by_sort?: string;

  aggregation?: string;

  constructor(data: GridViewColumn) {
    Object.assign(this, data);
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GridViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.GRID_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new GridViewColumn(v));
  }

  public static async get(
    context: NcContext,
    gridViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      gridViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GRID_VIEW_COLUMNS,
        gridViewColumnId,
      );
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
          viewColumn,
        );
      }
    }
    return viewColumn && new GridViewColumn(viewColumn);
  }

  static async insert(
    context: NcContext,
    column: Partial<GridViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(column, [
      'fk_view_id',
      'fk_column_id',
      'show',
      'base_id',
      'source_id',
      'order',
      'width',
      'group_by',
      'group_by_order',
      'group_by_sort',
    ]);

    insertObj.order =
      column?.order ??
      (await ncMeta.metaGetNextOrder(MetaTable.GRID_VIEW_COLUMNS, {
        fk_view_id: column.fk_view_id,
      }));

    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    insertObj.width = column?.width ?? '180px';

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      insertObj,
    );

    if (!(ncMeta as Upgrader).upgrader_mode) {
      // TODO: optimize this function & try to avoid if possible
      await View.fixPVColumnForView(context, column.fk_view_id, ncMeta);
    }

    // on new view column, delete any optimised single query cache
    {
      const view = await View.get(context, column.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return this.get(context, id, ncMeta).then(async (viewColumn) => {
      await NocoCache.appendToList(
        CacheScope.GRID_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GRID_VIEW_COLUMN}:${id}`,
      );
      return viewColumn;
    });
  }

  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<GridViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'order',
      'show',
      'width',
      'group_by',
      'group_by_order',
      'group_by_sort',
      'aggregation',
    ]);

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GRID_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    await NocoCache.update(
      `${CacheScope.GRID_VIEW_COLUMN}:${columnId}`,
      updateObj,
    );

    // on view column update, delete any optimised single query cache
    {
      const gridCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, gridCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(
        context,
        view.fk_model_id,
        [view],
        ncMeta,
      );
    }

    return res;
  }
}
