import type { GridType, MetaType } from 'nocodb-sdk';
import GridViewColumn from '~/models/GridViewColumn';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class GridView implements GridType {
  fk_view_id: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  row_height?: number;
  columns?: GridViewColumn[];

  constructor(data: GridView) {
    Object.assign(this, data);
  }

  async getColumns(): Promise<GridViewColumn[]> {
    return (this.columns = await GridViewColumn.list(this.fk_view_id));
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.GRID_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.GRID_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.GRID_VIEW}:${viewId}`, view);
    }

    return view && new GridView(view);
  }

  static async insert(view: Partial<GridView>, ncMeta = Noco.ncMeta) {
    const insertObj = extractProps(view, [
      'fk_view_id',
      'base_id',
      'source_id',
      'row_height',
    ]);

    if (!(insertObj.base_id && insertObj.source_id)) {
      const viewRef = await View.get(insertObj.fk_view_id, ncMeta);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(null, null, MetaTable.GRID_VIEW, insertObj, true);

    return this.get(view.fk_view_id, ncMeta);
  }

  static async getWithInfo(id: string, ncMeta = Noco.ncMeta) {
    const view = await this.get(id, ncMeta);
    return view;
  }

  static async update(
    viewId: string,
    body: Partial<GridView>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.GRID_VIEW}:${viewId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    const updateObj = extractProps(body, ['row_height', 'meta']);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta ?? {});
    }

    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // update meta
    return await ncMeta.metaUpdate(null, null, MetaTable.GRID_VIEW, updateObj, {
      fk_view_id: viewId,
    });
  }
}
