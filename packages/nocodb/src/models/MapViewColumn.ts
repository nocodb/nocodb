import type { BoolType } from 'nocodb-sdk';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class MapViewColumn {
  id: string;
  show?: BoolType;
  order?: number;

  fk_view_id: string;
  fk_column_id: string;
  base_id?: string;
  source_id?: string;

  constructor(data: MapViewColumn) {
    Object.assign(this, data);
  }

  public static async get(mapViewColumnId: string, ncMeta = Noco.ncMeta) {
    let view =
      mapViewColumnId &&
      (await NocoCache.get(
        `${CacheScope.MAP_VIEW_COLUMN}:${mapViewColumnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.MAP_VIEW_COLUMNS,
        mapViewColumnId,
      );
      await NocoCache.set(
        `${CacheScope.MAP_VIEW_COLUMN}:${mapViewColumnId}`,
        view,
      );
    }
    return view && new MapViewColumn(view);
  }
  static async insert(column: Partial<MapViewColumn>, ncMeta = Noco.ncMeta) {
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

    if (!(column.base_id && column.source_id)) {
      const viewRef = await View.get(column.fk_view_id, ncMeta);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    const { id, fk_column_id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.MAP_VIEW_COLUMNS,
      insertObj,
    );

    await NocoCache.set(`${CacheScope.MAP_VIEW_COLUMN}:${fk_column_id}`, id);

    // if cache is not present skip pushing it into the list to avoid unexpected behaviour
    const { list } = await NocoCache.getList(CacheScope.MAP_VIEW_COLUMN, [
      column.fk_view_id,
    ]);
    if (list?.length)
      await NocoCache.appendToList(
        CacheScope.MAP_VIEW_COLUMN,
        [column.fk_view_id],
        `${CacheScope.MAP_VIEW_COLUMN}:${id}`,
      );

    return this.get(id, ncMeta);
  }

  public static async list(
    viewId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<MapViewColumn[]> {
    const cachedList = await NocoCache.getList(CacheScope.MAP_VIEW_COLUMN, [
      viewId,
    ]);
    let { list: views } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !views.length) {
      views = await ncMeta.metaList2(null, null, MetaTable.MAP_VIEW_COLUMNS, {
        condition: {
          fk_view_id: viewId,
        },
        orderBy: {
          order: 'asc',
        },
      });
      await NocoCache.setList(CacheScope.MAP_VIEW_COLUMN, [viewId], views);
    }
    views.sort(
      (a, b) =>
        (a.order != null ? a.order : Infinity) -
        (b.order != null ? b.order : Infinity),
    );
    return views?.map((v) => new MapViewColumn(v));
  }
}
