import { Injectable, Logger } from '@nestjs/common';
import { type CalendarRangeType, ViewTypes } from 'nocodb-sdk';
import { CalendarDatasService as CalendarDatasServiceCE } from 'src/services/calendar-datas.service';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
import { Model, View } from '~/models';
import CalendarRange from '~/models/CalendarRange';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class CalendarDatasService extends CalendarDatasServiceCE {
  protected logger = new Logger(CalendarDatasService.name);

  async getCalendarRecordCount(param: { viewId: string; query: any }) {
    const { viewId, query } = param;

    const from_date = query.from_date;
    const to_date = query.to_date;

    if (!from_date || !to_date)
      NcError.badRequest('from_date and to_date are required');

    const view = await View.get(viewId);

    if (!view) NcError.notFound('View not found');
    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const { ranges } = await CalendarRange.read(view.id);

    if (!ranges.length) NcError.badRequest('No ranges found');

    const filterArr = await this.buildFilterArr({
      viewId,
      from_date,
      to_date,
    });

    query.filterArr = [...(query.filterArr ? query.filterArr : []), filterArr];

    const model = await Model.getByIdOrName({ id: view.fk_model_id });

    const data = await this.datasService.dataList({
      ...param,
      baseName: model.base_id,
      tableName: model.id,
      ignorePagination: true,
    });

    if (!data) NcError.notFound('Data not found');

    const dates: Array<string> = [];

    const columns = await model.getColumns();

    ranges.forEach((range: CalendarRangeType) => {
      const fromCol = columns.find(
        (c) => c.id === range.fk_from_column_id,
      )?.title;
      const toCol = range.fk_to_column_id
        ? columns.find((c) => c.id === range.fk_to_column_id)?.title
        : null;

      data.list.forEach((date) => {
        const fromDt = dayjs(date[fromCol]);
        const toDt = dayjs(toCol ? date[toCol] : null);

        if (fromCol && toCol && fromDt.isValid() && toDt.isValid()) {
          let current = fromDt;

          while (current.isSameOrBefore(toDt)) {
            dates.push(current.format('YYYY-MM-DD HH:mm:ssZ'));
            current = current.add(1, 'day');
          }
        } else if (fromCol && fromDt.isValid()) {
          dates.push(fromDt.format('YYYY-MM-DD HH:mm:ssZ'));
        }
      });
    });

    return {
      count: dates.length,
      dates: Array.from(new Set(dates)),
    };
  }

  async buildFilterArr({
    viewId,
    from_date,
    to_date,
  }: {
    viewId: string;
    from_date: string;
    to_date: string;
  }) {
    const calendarRange = await CalendarRange.read(viewId);
    if (!calendarRange?.ranges?.length) NcError.badRequest('No ranges found');

    const filterArr: FilterType = {
      is_group: true,
      logical_op: 'and',
      children: [],
    };

    const prevDate = dayjs(from_date)
      .add(1, 'day')
      .startOf('day')
      .format('YYYY-MM-DD HH:mm:ssZ');

    calendarRange.ranges.forEach((range: CalendarRange) => {
      const fromColumn = range.fk_from_column_id;
      const toColumn = range.fk_to_column_id;
      let rangeFilter: any = [];
      if (fromColumn && toColumn) {
        rangeFilter = [
          {
            is_group: true,
            logical_op: 'and',
            children: [
              {
                fk_column_id: fromColumn,
                comparison_op: 'lt',
                comparison_sub_op: 'exactDate',
                value: to_date as string,
              },
              {
                fk_column_id: toColumn,
                comparison_op: 'gt',
                comparison_sub_op: 'exactDate',
                value: from_date as string,
              },
            ],
          },
          {
            fk_column_id: fromColumn,
            comparison_op: 'eq',
            comparison_sub_op: 'exactDate',
            value: prevDate as string,
          },
        ];
      } else if (fromColumn) {
        rangeFilter = [
          {
            fk_column_id: fromColumn,
            comparison_op: 'lt',
            comparison_sub_op: 'exactDate',
            value: to_date as string,
          },
          {
            fk_column_id: fromColumn,
            comparison_op: 'gt',
            comparison_sub_op: 'exactDate',
            value: from_date as string,
          },
        ];
      }

      if (rangeFilter.length > 0) filterArr.children.push(rangeFilter);
    });

    return filterArr;
  }
}
