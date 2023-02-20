import Noco from '../Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import GridViewColumn from './GridViewColumn';
import View from './View';
import NocoCache from '../cache/NocoCache';
import { extractProps } from '../meta/helpers/extractProps';

export default class GridView {
  fk_view_id: string;
  project_id?: string;
  base_id?: string;

  meta?: string;
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
        CacheGetType.TYPE_OBJECT
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
    const insertObj = {
      fk_view_id: view.fk_view_id,
      project_id: view.project_id,
      base_id: view.base_id,
      row_height: view.row_height,
    };
    if (!(view.project_id && view.base_id)) {
      const viewRef = await View.get(view.fk_view_id, ncMeta);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
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
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.GRID_VIEW}:${viewId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    const updateObj = extractProps(body, ['row_height']);
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
