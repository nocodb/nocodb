import type { BoolType, MetaType } from 'nocodb-sdk';
import type { TimelineType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import TimelineRange from '~/models/TimelineRange';

export default class TimelineView implements TimelineType {
  fk_view_id: string;
  title: string;
  fk_workspace_id?: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  timeline_range?: Array<Partial<TimelineRange>>;
  // below fields are not in use at this moment
  // keep them for time being
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: TimelineView) {
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
        `${CacheScope.TIMELINE_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (view) {
      const timelineRange = await TimelineRange.read(context, viewId, ncMeta);
      if (timelineRange) {
        view.timeline_range = timelineRange.ranges;
      } else {
        view.timeline_range = [];
      }
    } else {
      view = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.TIMELINE_VIEW,
        {
          fk_view_id: viewId,
        },
      );
      const timelineRange = await TimelineRange.read(context, viewId, ncMeta);
      if (view && timelineRange) {
        view.timeline_range = timelineRange.ranges;
      }
      await NocoCache.set(
        context,
        `${CacheScope.TIMELINE_VIEW}:${viewId}`,
        view,
      );
    }

    return view && new TimelineView(view);
  }

  static async insert(
    context: NcContext,
    view: Partial<TimelineView>,
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
      MetaTable.TIMELINE_VIEW,
      insertObj,
      true,
    );

    return this.get(context, view.fk_view_id, ncMeta);
  }

  static async update(
    context: NcContext,
    timelineId: string,
    body: Partial<TimelineView>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(body, ['meta']);

    if (body.timeline_range) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.TIMELINE_VIEW_RANGE,
        {
          fk_view_id: timelineId,
        },
      );
      // if timeline range is updated, delete cache
      await NocoCache.del(context, `${CacheScope.TIMELINE_VIEW}:${timelineId}`);
      await TimelineRange.bulkInsert(
        context,
        body.timeline_range.map((range) => {
          return {
            fk_view_id: timelineId,
            ...range,
          };
        }),
        ncMeta,
      );
    }

    // update meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TIMELINE_VIEW,
      prepareForDb(updateObj),
      {
        fk_view_id: timelineId,
      },
    );

    // update cache
    await NocoCache.update(
      context,
      `${CacheScope.TIMELINE_VIEW}:${timelineId}`,
      prepareForResponse(updateObj),
    );

    return res;
  }
}
