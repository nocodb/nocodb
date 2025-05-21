import type { MetaType } from 'nocodb-sdk';
import type { MapType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import MapViewColumn from '~/models/MapViewColumn';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

export default class MapView implements MapType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  fk_geo_data_col_id?: string;
  meta?: MetaType;

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

  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.MAP_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MAP_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      await NocoCache.set(`${CacheScope.MAP_VIEW}:${viewId}`, view);
    }

    return view && new MapView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<MapView>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      base_id: view.base_id,
      source_id: view.source_id,
      fk_view_id: view.fk_view_id,
      fk_geo_data_col_id: view.fk_geo_data_col_id,
      meta: view.meta,
    };

    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MAP_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    mapId: string,
    body: Partial<MapView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['fk_geo_data_col_id', 'meta']);

    if (body.fk_geo_data_col_id != null) {
      const mapViewColumns = await MapViewColumn.list(context, mapId);
      const mapViewMappedByColumn = mapViewColumns.find(
        (mapViewColumn) =>
          mapViewColumn.fk_column_id === body.fk_geo_data_col_id,
      );
      await View.updateColumn(
        context,
        body.fk_view_id,
        mapViewMappedByColumn.id,
        {
          show: true,
        },
      );
    }

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MAP_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: mapId,
      },
    );

    await NocoCache.update(
      `${CacheScope.MAP_VIEW}:${mapId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
