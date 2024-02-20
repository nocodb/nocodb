import type { CalendarRangeType } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';

export default class CalendarRange implements CalendarRangeType {
  id?: string;
  fk_from_column_id?: string;
  fk_to_column_id?: string | null;
  fk_view_id?: string;

  constructor(data: Partial<CalendarRange>) {
    Object.assign(this, data);
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
    const uniqueFks: string[] = [
      ...new Set(bulkData.map((d) => d.fk_view_id)),
    ] as string[];

    for (const fk of uniqueFks) {
      await NocoCache.deepDel(
        CacheScope.CALENDAR_VIEW_RANGE,
        fk,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${d.fk_view_id}`,
        d,
      );

      await NocoCache.appendToList(
        CacheScope.CALENDAR_VIEW_RANGE,
        [d.fk_view_id],
        `${CacheScope.CALENDAR_VIEW_RANGE}:${d.id}`,
      );
    }

    return true;
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
