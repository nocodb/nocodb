import type { BoolType, DateDependencyType, GanttType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import DateDependency from '~/models/DateDependency';

export default class GanttView implements GanttType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  date_dependency?: DateDependencyType | null;
  // legacy/unused — kept for type compatibility
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: GanttView) {
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
        context,
        `${CacheScope.GANTT_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GANTT_VIEW,
        { fk_view_id: viewId },
      );
      if (view) {
        await NocoCache.set(
          context,
          `${CacheScope.GANTT_VIEW}:${viewId}`,
          view,
        );
      }
    }

    if (!view) return null;

    // Eagerly load the view-owned DateDependency rule. Null when the view
    // doesn't have its own rule — callers fall back to the table-level
    // default (`fk_gantt_view_id IS NULL`) via DateDependency.getByModelId.
    view.date_dependency = await DateDependency.getByGanttViewId(
      context,
      viewId,
      ncMeta,
    );

    return new GanttView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<GanttView>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = {
      base_id: view.base_id,
      source_id: view.source_id,
      fk_view_id: view.fk_view_id,
      meta: view.meta,
    };

    await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    ganttId: string,
    body: Partial<GanttView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['meta']);

    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.GANTT_VIEW,
      prepareForDb(updateObj),
      { fk_view_id: ganttId },
    );

    await NocoCache.update(
      context,
      `${CacheScope.GANTT_VIEW}:${ganttId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
