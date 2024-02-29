import { Injectable, Logger } from '@nestjs/common';
import { ErrorMessages, ViewTypes } from 'nocodb-sdk';
import { nocoExecute } from 'nc-help';
import dayjs from 'dayjs';
import type { CalendarRangeType, FilterType } from 'nocodb-sdk';
import { CalendarRange, Model, Source, View } from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { DatasService } from '~/services/datas.service';

@Injectable()
export class CalendarDatasService {
  protected logger = new Logger(CalendarDatasService.name);

  constructor(protected datasService: DatasService) {}

  async getCalendarDataList(param: { viewId: string; query: any }) {
    const { viewId, query } = param;
    const from_date = query.from_date;
    const to_date = query.to_date;

    if (!from_date || !to_date)
      NcError.badRequest('from_date and to_date are required');

    const view = await View.get(viewId);

    if (!view) NcError.notFound('View not found');

    if (view.type !== ViewTypes.CALENDAR)
      NcError.badRequest('View is not a calendar view');

    const calendarRange = await CalendarRange.read(view.id);

    if (!calendarRange?.ranges?.length) NcError.badRequest('No ranges found');

    const filterArr = await this.buildFilterArr({
      viewId,
      from_date,
      to_date,
    });

    query.filterArr = [...(query.filterArr ? query.filterArr : []), filterArr];

    const model = await Model.getByIdOrName({
      id: view.fk_model_id,
    });

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast, dependencyFields } = await getAst({
      model,
      query,
      view,
    });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    const [count, data] = await Promise.all([
      baseModel.count(listArgs, false),
      (async () => {
        let data = [];
        try {
          data = await nocoExecute(
            ast,
            await baseModel.list(listArgs, {
              ignoreViewFilterAndSort: false,
            }),
            {},
            listArgs,
          );
        } catch (e) {
          if (e instanceof NcBaseError) throw e;
          this.logger.error(e);
          NcError.internalServerError(
            'Please check server log for more details',
          );
        }
        return data;
      })(),
    ]);
    return new PagedResponseImpl(data, {
      ...query,
      count,
    });
  }

  async getPublicCalendarRecordCount(param: {
    password: string;
    query: any;
    sharedViewUuid: string;
  }) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (view.type !== ViewTypes.CALENDAR) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== password) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    return this.getCalendarRecordCount({ viewId: view.id, query });
  }

  async getPublicCalendarDataList(param: {
    password: string;
    query: any;
    sharedViewUuid: string;
  }) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (view.type !== ViewTypes.CALENDAR) {
      NcError.notFound('Not found');
    }

    if (view.password && view.password !== password) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    return this.getCalendarDataList({ viewId: view.id, query });
  }

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

    const model = await Model.getByIdOrName({
      id: view.fk_model_id,
    });

    const data = await this.datasService.getDataList({
      model,
      view,
      query,
      ignorePagination: true,
    });

    if (!data) NcError.notFound('Data not found');

    const dates: Array<string> = [];

    ranges.forEach((range: CalendarRangeType) => {
      const fromCol = model.columns.find(
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

    calendarRange.ranges.forEach((range: CalendarRange) => {
      const fromColumn = range.fk_from_column_id;
      let rangeFilter: any = [];
      if (fromColumn) {
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
