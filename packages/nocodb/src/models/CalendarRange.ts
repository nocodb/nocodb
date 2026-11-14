import { UITypes } from 'nocodb-sdk';
import type { CalendarRangeType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from '~/helpers/ncError';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import Column from '~/models/Column';

const CALENDAR_DATE_UITYPES: string[] = [
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
];

// Stable order so ranges[0] never changes between reads or cache states.
const compareRanges = (a: any, b: any) => {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
};

export default class CalendarRange implements CalendarRangeType {
  id?: string;
  fk_from_column_id?: string;
  label?: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_view_id?: string;

  constructor(data: Partial<CalendarRange>) {
    Object.assign(this, data);
  }

  // Multiple ranges (or a start/end pair) must be date columns of one uidt
  // and timezone (ranges[0] decides both when querying), none used twice.
  public static async validateRanges(
    context: NcContext,
    ranges: { fk_from_column_id?: string; fk_to_column_id?: string }[],
    ncMeta = Noco.ncMeta,
  ) {
    // A lone range keeps its legacy leniency: no type, timezone or reuse checks.
    if (ranges.length < 2) return;

    const used = new Set<string>();
    let first: { uidt: string; timezone: string | undefined };

    for (const range of ranges) {
      const fromId = range.fk_from_column_id;
      const toId = range.fk_to_column_id;
      let fromUidt: string;

      for (const colId of [fromId, toId]) {
        if (!colId) continue;
        const column = await Column.get(context, { colId }, ncMeta);
        if (!column)
          NcError.get(context).badRequest(
            `Calendar date range column ${colId} not found`,
          );
        if (!CALENDAR_DATE_UITYPES.includes(column.uidt))
          NcError.get(context).badRequest(
            `Calendar date range column '${column.title}' must be a date field`,
          );
        if (used.has(colId))
          NcError.get(context).badRequest(
            `Column '${column.title}' can only be used once across calendar date ranges`,
          );
        used.add(colId);

        const current = {
          uidt: column.uidt as string,
          timezone: (column.meta as any)?.timezone || undefined,
        };
        if (colId === fromId) fromUidt = current.uidt;
        else if (current.uidt !== fromUidt)
          NcError.get(context).badRequest(
            'Calendar date range start and end columns must be the same field type',
          );

        first ??= current;
        if (current.uidt !== first.uidt)
          NcError.get(context).badRequest(
            'All calendar date ranges must use the same field type',
          );
        if (current.timezone !== first.timezone)
          NcError.get(context).badRequest(
            'All calendar date ranges must use the same timezone',
          );
      }
    }
  }

  public static async bulkInsert(
    context: NcContext,
    data: Partial<CalendarRange>[],
    ncMeta = Noco.ncMeta,
  ) {
    await this.validateRanges(context, data, ncMeta);

    const calRanges: {
      fk_from_column_id?: string;
      fk_view_id?: string;
      label?: string | null;
    }[] = [];

    for (const d of data) {
      const tempObj = extractProps(d, [
        'fk_from_column_id',
        'fk_view_id',
        'label',
      ]);
      tempObj.label = tempObj.label?.trim() || null;
      calRanges.push(tempObj);
    }

    if (!calRanges.length) return false;

    const insertObj = calRanges[0];

    const insertData = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      insertObj,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.fk_view_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    await NocoCache.set(
      context,
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.id}`,
      insertData,
    );

    await NocoCache.appendToList(
      context,
      CacheScope.CALENDAR_VIEW_RANGE,
      [insertData.fk_view_id],
      `${CacheScope.CALENDAR_VIEW_RANGE}:${insertData.id}`,
    );

    return true;
  }

  public static async read(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(
      context,
      CacheScope.CALENDAR_VIEW_RANGE,
      [fk_view_id],
    );
    let { list: ranges } = cachedList;
    const { isNoneList } = cachedList;
    // Entries cached before created_at was kept lack it and would sort by id only.
    if (!isNoneList && (!ranges.length || ranges.some((r) => !r.created_at))) {
      ranges = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.CALENDAR_VIEW_RANGE,
        {
          condition: { fk_view_id },
          orderBy: { created_at: 'asc', id: 'asc' },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.CALENDAR_VIEW_RANGE,
        [fk_view_id],
        ranges.map(({ updated_at, ...others }) => others),
      );
    }
    ranges = [...(ranges ?? [])].sort(compareRanges);

    return ranges?.length
      ? {
          ranges: ranges.map(
            ({ created_at, updated_at, ...c }) => new CalendarRange(c),
          ),
        }
      : null;
  }

  public static async delete(
    rangeId: string,
    context: NcContext,
    ncMeta = Noco.ncMeta,
  ) {
    const range = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        id: rangeId,
      },
    );

    if (!range) return false;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      rangeId,
    );

    await NocoCache.deepDel(
      context,
      `${CacheScope.CALENDAR_VIEW_RANGE}:${range.fk_view_id}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    await NocoCache.del(
      context,
      `${CacheScope.CALENDAR_VIEW_RANGE}:${rangeId}`,
    );

    return true;
  }

  public static async find(
    context: NcContext,
    fk_view_id: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CalendarRange> {
    const data = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.CALENDAR_VIEW_RANGE,
      {
        fk_view_id,
      },
    );

    return data && new CalendarRange(data);
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
          ],
        },
      },
    );
  }
}
