import type { BoolType, MetaType } from 'nocodb-sdk';
import type { CalendarType } from 'nocodb-sdk';
import View from '~/models/View';
import { extractProps } from '~/helpers/extractProps';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import CalendarRange from '~/models/CalendarRange';

export default class CalendarView implements CalendarType {
  fk_view_id: string;
  title: string;
  base_id?: string;
  source_id?: string;
  meta?: MetaType;
  calendar_range?: Array<Partial<CalendarRange>>;
  fk_cover_image_col_id?: string;
  // below fields are not in use at this moment
  // keep them for time being
  show?: BoolType;
  public?: BoolType;
  password?: string;
  show_all_fields?: BoolType;

  constructor(data: CalendarView) {
    Object.assign(this, data);
  }

  public static async get(viewId: string, ncMeta = Noco.ncMeta) {
    let view =
      viewId &&
      (await NocoCache.get(
        `${CacheScope.CALENDAR_VIEW}:${viewId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (view) {
      const calendarRange = await CalendarRange.read(viewId, ncMeta);
      if (calendarRange) {
        view.calendar_range = calendarRange.ranges;
      } else {
        view.calendar_range = [];
      }
    } else {
      view = await ncMeta.metaGet2(null, null, MetaTable.CALENDAR_VIEW, {
        fk_view_id: viewId,
      });
      const calendarRange = await CalendarRange.read(viewId);
      if (calendarRange) {
        view.calendar_range = calendarRange.ranges;
      }
      await NocoCache.set(`${CacheScope.CALENDAR_VIEW}:${viewId}`, view);
    }

    return view && new CalendarView(view);
  }

  static async insert(view: Partial<CalendarView>, ncMeta = Noco.ncMeta) {
    const insertObj = {
      base_id: view.base_id,
      source_id: view.source_id,
      fk_view_id: view.fk_view_id,
      meta: view.meta,
    };

    const viewRef = await View.get(view.fk_view_id);

    if (!(view.base_id && view.source_id)) {
      insertObj.base_id = viewRef.base_id;
      insertObj.source_id = viewRef.source_id;
    }

    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.CALENDAR_VIEW,
      insertObj,
      true,
    );

    return this.get(view.fk_view_id, ncMeta);
  }

  static async update(
    calendarId: string,
    body: Partial<CalendarView>,
    ncMeta = Noco.ncMeta,
  ) {
    // get existing cache
    const key = `${CacheScope.CALENDAR_VIEW_COLUMN}:${calendarId}`;
    let o = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    const updateObj = extractProps(body, ['fk_cover_image_col_id', 'meta']);

    if (updateObj.meta && typeof updateObj.meta === 'object') {
      updateObj.meta = JSON.stringify(updateObj.meta ?? {});
    }

    if (o) {
      o = { ...o, ...updateObj };
      // set cache
      await NocoCache.set(key, o);
    }

    if (body.calendar_range) {
      await NocoCache.del(`${CacheScope.CALENDAR_VIEW_RANGE}:${calendarId}`);
      await ncMeta.metaDelete(
        null,
        null,
        MetaTable.CALENDAR_VIEW_RANGE,
        {},
        {
          fk_view_id: calendarId,
        },
      );
      await CalendarRange.bulkInsert(
        body.calendar_range.map((range) => {
          return {
            fk_view_id: calendarId,
            ...range,
          };
        }),
      );
    }
    // update meta
    return await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.CALENDAR_VIEW,
      updateObj,
      {
        fk_view_id: calendarId,
      },
    );
  }
}
