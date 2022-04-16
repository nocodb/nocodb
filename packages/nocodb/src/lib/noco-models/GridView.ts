import Noco from '../noco/Noco';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import GridViewColumn from './GridViewColumn';
import View from './View';
import NocoCache from '../noco-cache/NocoCache';

export default class GridView {
  title: string;
  show: boolean;
  is_default: boolean;
  order: number;

  fk_view_id: string;

  columns?: GridViewColumn[];

  project_id?: string;
  base_id?: string;

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
        fk_view_id: viewId
      });
      await NocoCache.set(`${CacheScope.GRID_VIEW}:${viewId}`, view);
    }

    return view && new GridView(view);
  }

  static async insert(view: Partial<GridView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      fk_view_id: view.fk_view_id,
      project_id: view.project_id,
      base_id: view.base_id
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
}
