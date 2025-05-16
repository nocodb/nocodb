import { Injectable, Logger } from '@nestjs/common';
import { UITypes, ViewTypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { CalendarRangeType, FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { CalendarRange, Column, Model, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';

@Injectable()
export class CalendarDatasService {
  protected logger = new Logger(CalendarDatasService.name);

  constructor(protected datasService: DatasService) {}

  async getCalendarDataList(
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
    const { viewId, query, from_date, to_date, next_date, prev_date } = param;

    if (!from_date || !to_date || !next_date || !prev_date)
      NcError.badRequest('from_date and to_date are required');

    if (dayjs(to_date).diff(dayjs(from_date), 'days') > 42) {
      NcError.badRequest('Date range should not exceed 42 days');
    }

    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);

    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const calendarRange = await CalendarRange.read(context, view.id);

    if (!calendarRange?.ranges?.length) NcError.badRequest('No ranges found');

    const colId = calendarRange.ranges[0].fk_from_column_id;
    let isDate = false;

    if (colId) {
      const column = await Column.get(context, { colId });
      if (!column) NcError.badRequest('Invalid column for calendar view');
      isDate = column.uidt === UITypes.Date;
    }

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

    const model = await Model.getByIdOrName(context, {
      id: view.fk_model_id,
    });

    return await this.datasService.dataList(context, {
      ...param,
      ...query,
      viewName: view.id,
      baseName: model.base_id,
      tableName: model.id,
      limitOverride: 3000, // TODO: make this configurable in env
    });
  }

  async getPublicCalendarRecordCount(
    context: NcContext,
    param: {
      password: string;
      query: any;
      sharedViewUuid: string;
      from_date: string;
      to_date: string;
      next_date: string;
      prev_date: string;
    },
  ) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);
    if (view.type !== ViewTypes.CALENDAR) {
      NcError.notFound('View is not a calendar view');
    }

    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    return this.getCalendarRecordCount(context, {
      viewId: view.id,
      query,
      from_date: param.from_date,
      to_date: param.to_date,
      next_date: param.next_date,
      prev_date: param.prev_date,
    });
  }

  async getPublicCalendarDataList(
    context: NcContext,
    param: {
      password: string;
      query: any;
      sharedViewUuid: string;
      from_date: string;
      to_date: string;
      next_date: string;
      prev_date: string;
    },
  ) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.viewNotFound(sharedViewUuid);
    if (view.type !== ViewTypes.CALENDAR) {
      NcError.notFound('View is not a calendar view');
    }

    if (view.password && view.password !== password) {
      return NcError.invalidSharedViewPassword();
    }

    return this.getCalendarDataList(context, {
      viewId: view.id,
      query,
      from_date: param.from_date,
      to_date: param.to_date,
      next_date: param.next_date,
      prev_date: param.prev_date,
    });
  }

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
    const { viewId, query, from_date, to_date, next_date, prev_date } = param;

    if (!from_date || !to_date || !next_date || !prev_date)
      NcError.badRequest('from_date and to_date are required');

    if (dayjs(to_date).diff(dayjs(from_date), 'days') > 395) {
      NcError.badRequest('Date range should not exceed 395 days');
    }

    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);

    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const ranges = await CalendarRange.read(context, view.id);

    if (!ranges?.ranges.length) NcError.badRequest('No ranges found');

    const colId = ranges.ranges[0].fk_from_column_id;
    let isDate = false;

    if (colId) {
      const column = await Column.get(context, { colId });
      if (!column) NcError.badRequest('Invalid column for calendar view');
      isDate = column.uidt === UITypes.Date;
    }

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

    const model = await Model.getByIdOrName(context, {
      id: view.fk_model_id,
    });

    const data = await this.datasService.dataList(context, {
      ...param,
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

      data.list.forEach((date) => {
        const fromDt = dayjs(date[fromCol]);

        if (fromCol && fromDt.isValid()) {
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
  ): Promise<Array<FilterType>> {
    const calendarRange = await CalendarRange.read(context, viewId);
    if (!calendarRange?.ranges?.length) NcError.badRequest('No ranges found');

    const filterArr: FilterType = {
      is_group: true,
      logical_op: 'and',
      children: [],
    };

    if (isDate) {
      const regex = /^\d{4}-\d{2}-\d{2}/;
      next_date = next_date.match(regex)?.[0] || next_date;
      prev_date = prev_date.match(regex)?.[0] || prev_date;
    }

    calendarRange?.ranges.forEach((range: CalendarRange) => {
      const fromColumn = range.fk_from_column_id;
      let rangeFilter: any = [];
      if (fromColumn) {
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
      }

      if (rangeFilter.length > 0) filterArr.children.push(rangeFilter);
    });

    return [filterArr];
  }
}
