import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

export default class MapViewColumn {
  id: string;
  show?: BoolType;
  order?: number;

  fk_view_id: string;
  fk_column_id: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;

  constructor(data: MapViewColumn) {
    Object.assign(this, data);
  }

  public static async get(
    context: NcContext,
    mapViewColumnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let viewColumn =
      mapViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.MAP_VIEW_COLUMN}:${mapViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!viewColumn) {
      viewColumn = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MAP_VIEW_COLUMNS,
        mapViewColumnId,
      );
      if (viewColumn) {
        await NocoCache.set(
          `${CacheScope.MAP_VIEW_COLUMN}:${mapViewColumnId}`,
          viewColumn,
        );
      }
    }
    return viewColumn && new MapViewColumn(viewColumn);
  }
  static async insert(
    context: NcContext,
    column: Partial<MapViewColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      fk_view_id: column.fk_view_id,
      fk_column_id: column.fk_column_id,
      order: await ncMeta.metaGetNextOrder(MetaTable.MAP_VIEW_COLUMNS, {
        fk_view_id: column.fk_view_id,
      }),
      show: column.show,
      base_id: column.base_id,
      source_id: column.source_id,
    };

    if (!insertObj.source_id) {
      const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);
      insertObj.source_id = viewRef.source_id;
    }

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MAP_VIEW_COLUMNS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (viewCol) => {
      await NocoCache.appendToList(
        CacheScope.MAP_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.MAP_VIEW_COLUMN}:${id}`,
      );
      return viewCol;
    });
  }

  public static async list(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<MapViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.MAP_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MAP_VIEW_COLUMNS,
        {
          condition: {
            fk_view_id: viewId,
          },
          orderBy: {
            order: 'asc',
          },
        },
      );
      await NocoCache.setList(CacheScope.MAP_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new MapViewColumn(v));
  }

  // todo: update prop names
  static async update(
    context: NcContext,
    columnId: string,
    body: Partial<MapViewColumn>,
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

    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MAP_VIEW_COLUMNS,
      updateObj,
      columnId,
    );

    // get existing cache
    const key = `${CacheScope.MAP_VIEW_COLUMN}:${columnId}`;
    await NocoCache.update(key, updateObj);

    // on view column update, delete any optimised single query cache
    {
      const viewCol = await this.get(context, columnId, ncMeta);
      const view = await View.get(context, viewCol.fk_view_id, ncMeta);
      await View.clearSingleQueryCache(context, view.fk_model_id, [view]);
    }

    return res;
  }
}
