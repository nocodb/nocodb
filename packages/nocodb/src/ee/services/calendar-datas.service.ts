import { Injectable, Logger } from '@nestjs/common';
import { type CalendarRangeType, ViewTypes } from 'nocodb-sdk';
import { CalendarDatasService as CalendarDatasServiceCE } from 'src/services/calendar-datas.service';
import dayjs from 'dayjs';
import { Model, View } from '~/models';
import CalendarRange from '~/models/CalendarRange';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class CalendarDatasService extends CalendarDatasServiceCE {
  protected logger = new Logger(CalendarDatasService.name);

  async getCalendarRecordCount(param: {
    viewId: string;
    query: any;
    from_date: string;
    to_date: string;
  }) {
    const { viewId, query, from_date, to_date } = param;

    if (!from_date || !to_date)
      NcError.badRequest('from_date and to_date are required');

    const view = await View.get(viewId);

    if (!view) NcError.viewNotFound(viewId);
    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const ranges = await CalendarRange.read(view.id);

    if (!ranges?.ranges.length) NcError.badRequest('No ranges found');

    const filterArr = await this.buildFilterArr({
      viewId,
      from_date,
      to_date,
    });

    query.filterArrJson = JSON.stringify([
      ...filterArr,
      ...(query.filterArrJson ? JSON.parse(query.filterArrJson) : []),
    ]);
    const model = await Model.getByIdOrName({ id: view.fk_model_id });

    const data = await this.datasService.dataList({
      ...param,
      view: view,
      viewName: view.id,
      baseName: model.base_id,
      tableName: model.id,
      ignorePagination: true,
    });

    if (!data) NcError.notFound('Data not found');

    const dates: Array<string> = [];

    const columns = await model.getColumns();

    ranges?.ranges?.forEach((range: CalendarRangeType) => {
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

    const filterArr: any = [];

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
            logical_op: 'or',
            comparison_op: 'eq',
            comparison_sub_op: 'exactDate',
            value: prevDate as string,
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
            value: to_date as string,
          },
          {
            fk_column_id: fromColumn,
            comparison_op: 'gt',
            comparison_sub_op: 'exactDate',
            value: from_date as string,
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
