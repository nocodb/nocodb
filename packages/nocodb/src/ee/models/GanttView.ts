import GanttViewCE from 'src/models/GanttView';
import type { BoolType, DateDependencyType, MetaType } from 'nocodb-sdk';
import type { GanttType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import DateDependency from '~/ee/models/DateDependency';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class GanttView extends GanttViewCE implements GanttType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  // View-owned DateDependency rule (Airtable-style per-Gantt config). Loaded
  // eagerly by GanttView.get so the frontend store doesn't need a separate
  // round-trip. When null, the view falls back to the table-level default
  // rule (DateDependency.getByModelId).
  date_dependency?: DateDependencyType | null;

  constructor(data: GanttView) {
    super(data);
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
    // Only set the cache when metaGet2 actually returned a row — otherwise we
    // pollute the cache with a falsy entry that defeats subsequent lookups
    // (the `if (!view)` short-circuit treats null-cached as a miss too).
    if (!view) {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.GANTT_VIEW,
        {
          fk_view_id: viewId,
        },
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

    const result = new GanttView(view);
    // Eager-load the view-owned dependency rule so consumers can read both
    // off `viewMeta.view`. Stored on the result object — not the cached
    // GanttView row — because the rule lives in nc_date_dependency and is
    // invalidated independently (DateDependency.update / clearColumnRef).
    // Round-trip cost is one indexed lookup (fk_gantt_view_id), with its
    // own NocoCache layer inside DateDependency.getByGanttViewId.
    result.date_dependency = await DateDependency.getByGanttViewId(
      context,
      viewId,
      ncMeta,
    );
    return result;
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
      {
        fk_view_id: ganttId,
      },
    );

    await NocoCache.update(
      context,
      `${CacheScope.GANTT_VIEW}:${ganttId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
