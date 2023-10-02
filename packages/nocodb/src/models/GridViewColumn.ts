import type { BoolType, GridColumnType } from 'nocodb-sdk';
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
  base_id?: string;
  source_id?: string;

  group_by?: BoolType;
  group_by_order?: number;
  group_by_sort?: string;

  constructor(data: GridViewColumn) {
    Object.assign(this, data);
  }

  public static async list(
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<GridViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.GRID_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(null, null, MetaTable.GRID_VIEW_COLUMNS, {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.GRID_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new GridViewColumn(v));
  }

  public static async get(gridViewColumnId: string, ncMeta = Noco.ncMeta) {
    let view =
      gridViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.GRID_VIEW_COLUMNS,
        gridViewColumnId,
      );
      await NocoCache.set(
        `${CacheScope.GRID_VIEW_COLUMN}:${gridViewColumnId}`,
        view,
      );
    }
    return view && new GridViewColumn(view);
  }

  static async insert(column: Partial<GridViewColumn>, ncMeta = Noco.ncMeta) {
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

    if (!(column.base_id && column.source_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      insertObj,
    );

    await NocoCache.set(`${CacheScope.GRID_VIEW_COLUMN}:${fk_column_id}`, id);

    // if cache is not present skip pushing it into the list to avoid unexpected behaviour
    const { list } = await NocoCache.getList(CacheScope.GRID_VIEW_COLUMN, [
      column.fk_view_id,
    ]);
    if (list.length)
      await NocoCache.appendToList(
        CacheScope.GRID_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.GRID_VIEW_COLUMN}:${id}`,
      );

    await View.fixPVColumnForView(column.fk_view_id, ncMeta);

    // on new view column, delete any optimised single query cache
    {
      const view = await View.get(column.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }

    return this.get(id, ncMeta);
  }

  static async update(
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
    ]);
    // get existing cache
    const key = `${CacheScope.GRID_VIEW_COLUMN}:${columnId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // set meta
    const res = await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.GRID_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // on view column update, delete any optimised single query cache
    {
      const gridCol = await this.get(columnId, ncMeta);
      const view = await View.get(gridCol.fk_view_id, ncMeta);
      await NocoCache.delAll(
        CacheScope.SINGLE_QUERY,
        `${view.fk_model_id}:${view.id}:*`,
      );
    }

    return res;
  }
}
