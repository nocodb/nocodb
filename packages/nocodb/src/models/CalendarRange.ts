import type { CalendarRangeType } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class CalendarRange implements CalendarRangeType {
  id?: string;
  fk_from_column_id?: string;
  fk_to_column_id?: string | null;
  fk_view_id?: string;

  constructor(data: Partial<CalendarRange>) {
    Object.assign(this, data);
  }

  public static async insert(
    data: Partial<CalendarRange>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'fk_from_column_id',
      'fk_to_column_id',
      'fk_view_id',
    ]);

    const { id } = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.CALENDAR_VIEW_RANGE,
      insertObj,
    );

    await NocoCache.appendToList(
      CacheScope.CALENDAR_VIEW_RANGE,
      [data.fk_view_id],
      `${CacheScope.CALENDAR_VIEW_RANGE}:${id}`,
    );

    return this.get(id, ncMeta);
  }

  public static async bulkInsert(
    data: Partial<CalendarRange>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = [];

    for (const d of data) {
      const tempObj = extractProps(d, [
        'fk_from_column_id',
        'fk_to_column_id',
        'fk_view_id',
      ]);
      insertObj.push(tempObj);
    }

    const bulkData = await ncMeta.bulkMetaInsert(
      null,
      null,
      MetaTable.CALENDAR_VIEW_RANGE,
      insertObj,
    );

    for (const d of bulkData) {
      await NocoCache.appendToList(
        CacheScope.CALENDAR_VIEW_RANGE,
        [d.fk_view_id],
        `${CacheScope.CALENDAR_VIEW_RANGE}:${d.id}`,
      );
      await NocoCache.set(`${CacheScope.CALENDAR_VIEW_RANGE}:${d.id}`, d);
    }

    return true;
  }

  public static async get(
    calendarRangeId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CalendarRange> {
    let data =
      calendarRangeId &&
      (await NocoCache.get(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${calendarRangeId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!data) {
      data = await ncMeta.metaGet2(
        null,
        null,
        MetaTable.CALENDAR_VIEW_RANGE,
        calendarRangeId,
      );
      await NocoCache.set(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${calendarRangeId}`,
        data,
      );
    }
    return data && new CalendarRange(data);
  }

  public static async read(fk_view_id: string, ncMeta = Noco.ncMeta) {
    const cachedList = await NocoCache.getList(CacheScope.CALENDAR_VIEW_RANGE, [
      fk_view_id,
    ]);
    let { list: ranges } = cachedList;
    const { isNoneList } = cachedList;
    if (!isNoneList && !ranges.length) {
      ranges = await ncMeta.metaList2(
        null, //,
        null, //model.db_alias,
        MetaTable.CALENDAR_VIEW_RANGE,
        { condition: { fk_view_id } },
      );
      await NocoCache.setList(
        CacheScope.CALENDAR_VIEW_RANGE,
        [fk_view_id],
        ranges.map(({ created_at, updated_at, ...others }) => others),
      );
    }

    return ranges?.length
      ? {
          ranges: ranges.map(
            ({ created_at, updated_at, ...c }) => new CalendarRange(c),
          ),
        }
      : null;
  }

  public static async find(
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CalendarRange> {
    const data = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        fk_view_id,
      },
    );

    return data && new CalendarRange(data);
  }
}
