import { UITypes } from 'nocodb-sdk';
import type { BoolType, KanbanType, MetaType } from 'nocodb-sdk';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class KanbanView implements KanbanType {
  fk_view_id: string;
  title: string;
  base_id?: string;
  source_id?: string;
  fk_grp_col_id?: string;
  fk_cover_image_col_id?: string;
  meta?: MetaType;

  // below fields are not in use at this moment
  // keep them for time being
  show?: BoolType;
  order?: number;
  uuid?: string;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: KanbanView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
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
    ncMeta = Noco.ncMeta,
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

    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'fk_grp_col_id',
      'meta',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id ||
      columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    if (!(view.base_id && view.source_id)) {
      const viewRef = await View.get(view.fk_view_id);
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.KANBAN_VIEW,
      insertObj,
      true,
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    kanbanId: string,
    body: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.KANBAN_VIEW}:${kanbanId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    const updateObj = extractProps(body, [
      'fk_cover_image_col_id',
      'fk_grp_col_id',
      'meta',
    ]);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta ?? {});
    }

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
      },
    );
  }
}
