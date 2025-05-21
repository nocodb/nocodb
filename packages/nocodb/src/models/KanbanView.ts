import { UITypes } from 'nocodb-sdk';
import type { BoolType, KanbanType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import View from '~/models/View';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import {
  parseMetaProp,
  prepareForDb,
  prepareForResponse,
  stringifyMetaProp,
} from '~/utils/modelUtils';

export default class KanbanView implements KanbanType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
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

  public static async get(
    context: NcContext,
    viewId: string,
    ncMeta = Noco.ncMeta,
  ) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.KANBAN_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.KANBAN_VIEW,
        {
          fk_view_id: viewId,
        },
      );

      view = prepareForResponse(view);

      await NocoCache.set(`${CacheScope.KANBAN_VIEW}:${viewId}`, view);
    }

    return view && new KanbanView(view);
  }

  public static async getViewsByGroupingColId(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      {
        condition: {
          fk_grp_col_id: columnId,
        },
      },
    );
  }

  static async insert(
    context: NcContext,
    view: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    const columns = await View.get(context, view.fk_view_id, ncMeta)
      .then((v) => v?.getModel(context, ncMeta))
      .then((m) => m.getColumns(context, ncMeta));

    const insertObj = extractProps(view, [
      'base_id',
      'source_id',
      'fk_view_id',
      'fk_grp_col_id',
      'meta',
    ]);

    insertObj.fk_cover_image_col_id =
      view?.fk_cover_image_col_id !== undefined
        ? view?.fk_cover_image_col_id
        : columns?.find((c) => c.uidt === UITypes.Attachment)?.id;

    insertObj.meta = {
      fk_cover_image_object_fit:
        parseMetaProp(insertObj)?.fk_cover_image_object_fit || 'fit',
    };

    insertObj.meta = stringifyMetaProp(insertObj);

    const viewRef = await View.get(context, insertObj.fk_view_id, ncMeta);

    if (!insertObj.source_id) {
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    kanbanId: string,
    body: Partial<KanbanView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, [
      'fk_cover_image_col_id',
      'fk_grp_col_id',
      'meta',
    ]);

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.KANBAN_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: kanbanId,
      },
    );

    await NocoCache.update(
      `${CacheScope.KANBAN_VIEW}:${kanbanId}`,
      prepareForResponse(updateObj),
    );

    const view = await View.get(context, kanbanId);

    // on update, delete any optimised single query cache
    await View.clearSingleQueryCache(
      context,
      view.fk_model_id,
      [{ id: kanbanId }],
      ncMeta,
    );

    return res;
  }
}
