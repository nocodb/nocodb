import Noco from '../Noco';
import { KanbanType } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import View from './View';
import NocoCache from '../cache/NocoCache';

export default class KanbanView implements KanbanType {
  fk_view_id: string;
  title: string;
  project_id?: string;
  base_id?: string;
  grp_column_id?: string;
  stack_meta?: string | object;

  // TODO: check these
  show: boolean;
  is_default: boolean;
  order: number;

  constructor(data: KanbanView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!view) {
      view = await ncMeta.metaGet2(null, null, MetaTable.KANBAN_VIEW, {
        fk_view_id: viewId,
      });
      await NocoCache.set(`${CacheScope.KANBAN_VIEW}:${viewId}`, view);
    }

    return view && new KanbanView(view);
  }

  static async insert(view: Partial<KanbanView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      project_id: view.project_id,
      base_id: view.base_id,
      fk_view_id: view.fk_view_id,
      grp_column_id: view.grp_column_id,
      // TODO: more
    };
    if (!(view.project_id && view.base_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.project_id = viewRef.project_id;
      insertObj.base_id = viewRef.base_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.KANBAN_VIEW,
      insertObj,
      true
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    kanbanId: string,
    body: Partial<KanbanView>,
    ncMeta = Noco.ncMeta
  ) {
    // get existing cache
    const key = `${CacheScope.KANBAN_VIEW}:${kanbanId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);
    const updateObj = {
      ...body,
      stack_meta:
        typeof body.stack_meta === 'string'
          ? body.stack_meta
          : JSON.stringify(body.stack_meta ?? {}),
    };
    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }
    // update meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.KANBAN_VIEW,
      updateObj,
      {
        fk_view_id: kanbanId,
      }
    );
  }
}
