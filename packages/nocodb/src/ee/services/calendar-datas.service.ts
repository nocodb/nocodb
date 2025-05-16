import { Injectable, Logger } from '@nestjs/common';
import {
  type CalendarRangeType,
  UITypes,
  ViewTypes,
  workerWithTimezone,
} from 'nocodb-sdk';
import { CalendarDatasService as CalendarDatasServiceCE } from 'src/services/calendar-datas.service';
import type { NcContext } from '~/interface/config';
import { Column, Model, View } from '~/models';
import CalendarRange from '~/models/CalendarRange';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class CalendarDatasService extends CalendarDatasServiceCE {
  protected logger = new Logger(CalendarDatasService.name);

  async getCalendarRecordCount(
    context: NcContext,
    param: {
      viewId: string;
      query: any;
      from_date: string;
      to_date: string;
      next_date: string;
      prev_date: string;
    },
  ) {
    const { viewId, query, from_date, to_date, prev_date, next_date } = param;

    if (!from_date || !to_date || !next_date || !prev_date)
      NcError.badRequest('from_date and to_date are required');

    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);
    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const ranges = await CalendarRange.read(context, view.id);

    if (!ranges?.ranges.length) NcError.badRequest('No ranges found');

    let timezone;

    const colId = ranges.ranges[0].fk_from_column_id;
    let isDate = false;

    if (colId) {
      const column = await Column.get(context, { colId });
      if (!column) NcError.badRequest('Invalid column for calendar view');
      timezone = column?.meta?.timezone || undefined;
      isDate = column.uidt === UITypes.Date;
    }

    const dayjsTimezone = workerWithTimezone(true, isDate ? null : timezone);

    const filterArr = await this.buildFilterArr(context, {
      viewId,
      from_date,
      to_date,
      next_date,
      prev_date,
      isDate,
    });

    query.filterArrJson = JSON.stringify([
      ...filterArr,
      ...(query.filterArrJson ? JSON.parse(query.filterArrJson) : []),
    ]);
    const model = await Model.getByIdOrName(context, { id: view.fk_model_id });

    const data = await this.datasService.dataList(context, {
      ...param,
      view: view,
      viewName: view.id,
      baseName: model.base_id,
      tableName: model.id,
      ignorePagination: true,
    });

    if (!data) NcError.notFound('Data not found');

    const dates: Array<string> = [];

    const columns = await model.getColumns(context);

    ranges?.ranges?.forEach((range: CalendarRangeType) => {
      const fromCol = columns.find(
        (c) => c.id === range.fk_from_column_id,
      )?.title;
      const toCol = range.fk_to_column_id
        ? columns.find((c) => c.id === range.fk_to_column_id)?.title
        : null;

      data.list.forEach((date) => {
        const fromDt = dayjsTimezone.timezonize(date[fromCol]);
        const toDt = dayjsTimezone.timezonize(toCol ? date[toCol] : null);

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

  async buildFilterArr(
    context: NcContext,
    {
      viewId,
      from_date,
      to_date,
      next_date,
      prev_date,
      isDate,
    }: {
      viewId: string;
      from_date: string;
      to_date: string;
      next_date: string;
      prev_date: string;
      isDate: boolean;
    },
  ) {
    const calendarRange = await CalendarRange.read(context, viewId);
    if (!calendarRange?.ranges?.length) NcError.badRequest('No ranges found');

    const filterArr: any = [];

    if (isDate) {
      const regex = /^\d{4}-\d{2}-\d{2}/;

      from_date = from_date.match(regex)?.[0] || from_date;
      to_date = to_date.match(regex)?.[0] || to_date;
      next_date = next_date.match(regex)?.[0] || next_date;
      prev_date = prev_date.match(regex)?.[0] || prev_date;
    }

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
                value: next_date as string,
              },
              {
                fk_column_id: toColumn,
                comparison_op: 'gt',
                comparison_sub_op: 'exactDate',
                value: prev_date as string,
              },
            ],
          },
          {
            is_group: true,
            logical_op: 'or',
            children: [
              {
                fk_column_id: fromColumn,
                comparison_op: 'gte',
                comparison_sub_op: 'exactDate',
                value: from_date as string,
              },
              {
                fk_column_id: fromColumn,
                comparison_op: 'lte',
                comparison_sub_op: 'exactDate',
                value: to_date as string,
              },
            ],
          },
        ];
        filterArr.push({
          is_group: true,
          logical_op: 'or',
          children: rangeFilter,
        });
      } else if (fromColumn) {
        rangeFilter = [
          {
            fk_column_id: fromColumn,
            comparison_op: 'lt',
            comparison_sub_op: 'exactDate',
            value: next_date as string,
          },
          {
            fk_column_id: fromColumn,
            comparison_op: 'gt',
            comparison_sub_op: 'exactDate',
            value: prev_date as string,
          },
        ];
        filterArr.push({
          is_group: true,
          logical_op: 'and',
          children: rangeFilter,
        });
      }
    });

    return filterArr;
  }
}
