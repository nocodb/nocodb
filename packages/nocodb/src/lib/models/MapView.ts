import Noco from '../Noco';
import { MapType } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import View from './View';
import NocoCache from '../cache/NocoCache';
import MapViewColumn from './MapViewColumn';

export default class MapView implements MapType {
  fk_view_id: string;
  title: string;
  project_id?: string;
  base_id?: string;
  fk_geo_data_col_id?: string;
  meta?: string | Record<string, unknown>;

  // below fields are not in use at this moment
  // keep them for time being
  show?: boolean;
  uuid?: string;
  public?: boolean;
  password?: string;
  show_all_fields?: boolean;

  constructor(data: MapView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.MAP_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.MAP_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.MAP_VIEW}:${viewId}`, view);
    }

    return view && new MapView(view);
  }

  static async insert(view: Partial<MapView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      project_id: view.project_id,
      base_id: view.base_id,
      fk_view_id: view.fk_view_id,
      fk_geo_data_col_id: view.fk_geo_data_col_id,
      meta: view.meta,
    };

    const viewRef = await View.get(view.fk_view_id);

    if (!(view.project_id && view.base_id)) {
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }

    await ncMeta.metaInsert2(null, null, MetaTable.MAP_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    mapId: string,
    body: Partial<MapView>,
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.MAP_VIEW}:${mapId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    const updateObj = {
      ...body,
      meta:
        typeof body.meta === 'string'
          ? body.meta
          : JSON.stringify(body.meta ?? {}),
    };
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }

    if (body.fk_geo_data_col_id != null) {
      const mapViewColumns = await MapViewColumn.list(mapId);
      const mapViewMappedByColumn = mapViewColumns.find(
        (mapViewColumn) =>
          mapViewColumn.fk_column_id === body.fk_geo_data_col_id
      );
      await View.updateColumn(body.fk_view_id, mapViewMappedByColumn.id, {
        show: true,
      });

    }

    // update meta
    return await ncMeta.metaUpdate(null, null, MetaTable.MAP_VIEW, updateObj, {
      fk_view_id: mapId,
    });
  }
}
