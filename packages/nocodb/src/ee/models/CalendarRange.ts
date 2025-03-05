import CalendarRangeCE from 'src/models/CalendarRange';
import type { CalendarRangeType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';

export default class CalendarRange
  extends CalendarRangeCE
  implements CalendarRangeType
{
  fk_to_column_id?: string | null;

  public static async bulkInsert(
    context: NcContext,
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

    if (!insertObj.length) {
      return false;
    }

    const bulkData = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      insertObj,
    );
    const uniqueFks: string[] = [
      ...new Set(bulkData.map((d) => d.fk_view_id)),
    ] as string[];

    for (const fk of uniqueFks) {
      await NocoCache.deepDel(
        `${CacheScope.CALENDAR_VIEW_RANGE}:${fk}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(`${CacheScope.CALENDAR_VIEW_RANGE}:${d.id}`, d);

      await NocoCache.appendToList(
        CacheScope.CALENDAR_VIEW_RANGE,
        [d.fk_view_id],
        `${CacheScope.CALENDAR_VIEW_RANGE}:${d.id}`,
      );
    }

    return true;
  }

  public static async IsColumnBeingUsedAsRange(
    context: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        xcCondition: {
          _or: [
            {
              fk_from_column_id: {
                eq: columnId,
              },
            },
            {
              fk_to_column_id: {
                eq: columnId,
              },
            },
          ],
        },
      },
    );
  }
}
