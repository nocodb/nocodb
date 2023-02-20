import Noco from '../Noco';
import { KanbanType, UITypes } from 'nocodb-sdk';
import { CacheGetType, CacheScope, MetaTable } from '../utils/globals';
import View from './View';
import NocoCache from '../cache/NocoCache';

export default class KanbanView implements KanbanType {
  fk_view_id: string;
  title: string;
  project_id?: string;
  base_id?: string;
  fk_grp_col_id?: string;
  fk_cover_image_col_id?: string;
  meta?: string | Record<string, any>;

  // below fields are not in use at this moment
  // keep them for time being
  show?: boolean;
  order?: number;
  uuid?: string;
  public?: boolean;
  password?: string;
  show_all_fields?: boolean;

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

  public static async IsColumnBeingUsedAsGroupingField(
    columnId: string,
    ncMeta = Noco.ncMeta
  ) {
    return (
      (
        await ncMeta.metaList2(null, null, MetaTable.KANBAN_VIEW, {
          condition: {
            fk_grp_col_id: columnId,
          },
        })
      ).length > 0
    );
  }

  static async insert(view: Partial<KanbanView>, ncMeta = Noco.ncMeta) {
    const columns = await View.get(view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(ncMeta))
      .then((m) => m.getColumns(ncMeta));

    const insertObj = {
      project_id: view.project_id,
      base_id: view.base_id,
      fk_view_id: view.fk_view_id,
      fk_grp_col_id: view.fk_grp_col_id,
      fk_cover_image_col_id:
        view?.fk_cover_image_col_id ||
        columns?.find((c) => c.uidt === UITypes.Attachment)?.id,
      meta: view.meta,
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
