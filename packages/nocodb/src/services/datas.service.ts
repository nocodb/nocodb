import { Injectable, Logger } from '@nestjs/common';
import { isLinksOrLTAR, NcSDKErrorV2 } from 'nocodb-sdk';
import { NcApiVersion } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { PathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';
import type { Filter } from '~/models';
import type LinkToAnotherRecordColumn from '../models/LinkToAnotherRecordColumn';
import { NcBaseError, NcError } from '~/helpers/catchError';
import { getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, Column, Model, Source, View } from '~/models';
import { nocoExecute } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from '~/constants';

@Injectable()
export class DatasService {
  protected logger = new Logger(DatasService.name);

  constructor() {}

  async dataList(
    context: NcContext,
    param: (PathParams | { view?: View; model: Model }) & {
      query: any;
      disableOptimization?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      throwErrorIfInvalidParams?: boolean;
      getHiddenColumns?: boolean;
      includeSortAndFilterColumns?: boolean;
      includeRowColorColumns?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    let { model, view } = param as { view?: View; model?: Model };

    if (!model) {
      const modelAndView = await getViewAndModelByAliasOrId(
        context,
        param as PathParams,
      );
      model = modelAndView.model;
      view = modelAndView.view;
    }

    // check for linkColumnId query param and handle it
    if (param.query.linkColumnId) {
      const linkColumn = await Column.get<LinkToAnotherRecordColumn>(context, {
        colId: param.query.linkColumnId,
      });

      if (
        !linkColumn ||
        !isLinksOrLTAR(linkColumn) ||
        linkColumn.colOptions.fk_related_model_id !== model.id
      ) {
        NcError.fieldNotFound(param.query?.linkColumnId, {
          customMessage: `Link column with id ${param.query.linkColumnId} not found`,
        });
      }

      if (linkColumn.colOptions.fk_target_view_id) {
        view = await View.get(context, linkColumn.colOptions.fk_target_view_id);
      }
    }

    return await this.getDataList(context, {
      model,
      view,
      query: param.query,
      throwErrorIfInvalidParams: true,
      ignorePagination: param.ignorePagination,
      limitOverride: param.limitOverride,
      getHiddenColumns: param.getHiddenColumns,
      apiVersion: param.apiVersion,
      includeSortAndFilterColumns: param.includeSortAndFilterColumns,
      includeRowColorColumns: param.includeRowColorColumns,
    });
  }

  async dataFindOne(context: NcContext, param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    return await this.getFindOne(context, { model, view, query: param.query });
  }

  async dataGroupBy(context: NcContext, param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    return await this.getDataGroupBy(context, {
      model,
      view,
      query: param.query,
    });
  }

  async dataGroupByCount(
    context: NcContext,
    param: PathParams & { query: any },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    return await this.getDataGroupByCount(context, {
      model,
      view,
      query: param.query,
    });
  }

  async dataCount(context: NcContext, param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const countArgs: any = { ...param.query, throwErrorIfInvalidParams: true };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    const count: number = await baseModel.count(countArgs);

    return { count };
  }

  async dataInsert(
    context: NcContext,
    param: PathParams & {
      body: unknown;
      cookie: any;
      disableOptimization?: boolean;
      query: any;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.nestedInsert(
      param.body,
      param.cookie,
      null,
      param?.query,
    );
  }

  async dataUpdate(
    context: NcContext,
    param: PathParams & {
      body: unknown;
      cookie: any;
      rowId: string;
      disableOptimization?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
      param.disableOptimization,
    );
  }

  async dataDelete(
    context: NcContext,
    param: PathParams & { rowId: string; cookie: any },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    // if xcdb base skip checking for LTAR
    if (!source.isMeta()) {
      const message = await baseModel.hasLTARData(param.rowId, model);
      if (message.length) {
        NcError.badRequest(message);
      }
    }

    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async getDataList(
    context: NcContext,
    param: {
      model: Model;
      view?: View;
      query: any;
      baseModel?: BaseModelSqlv2;
      throwErrorIfInvalidParams?: boolean;
      ignoreViewFilterAndSort?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      includeRowColorColumns?: boolean;
    },
  ) {
    const {
      model,
      view: view,
      query = {},
      ignoreViewFilterAndSort = false,
      includeSortAndFilterColumns = false,
      apiVersion,
    } = param;

    const source = await Source.get(context, model.source_id);

    const baseModel =
      param.baseModel ||
      (await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      }));

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query,
      view: view,
      throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
      getHiddenColumn: param.getHiddenColumns,
      apiVersion,
      includeSortAndFilterColumns: includeSortAndFilterColumns,
      includeRowColorColumns: param.includeRowColorColumns,
      skipSubstitutingColumnIds:
        query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
    });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    listArgs.customConditions = param.customConditions;

    const [count, data] = await Promise.all([
      baseModel.count(listArgs, false, param.throwErrorIfInvalidParams),
      (async () => {
        let data = [];
        try {
          data = await nocoExecute(
            ast,
            await baseModel.list(
              { ...listArgs, apiVersion: param.apiVersion },
              {
                ignoreViewFilterAndSort,
                throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
                ignorePagination: param.ignorePagination,
                limitOverride: param.limitOverride,
                skipSubstitutingColumnIds:
                  context.api_version === NcApiVersion.V3 &&
                  query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
              },
            ),
            {},
            listArgs,
          );
        } catch (e) {
          if (e instanceof NcBaseError || e instanceof NcSDKErrorV2) throw e;
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
      ...(param.limitOverride ? { limitOverride: param.limitOverride } : {}),
      count,
    });
  }

  async getFindOne(
    context: NcContext,
    param: { model: Model; view: View; query: any },
  ) {
    const { model, view, query = {} } = param;

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const args: any = { ...query };
    try {
      args.filterArr = JSON.parse(args.filterArrJson);
    } catch (e) {}
    try {
      args.sortArr = JSON.parse(args.sortArrJson);
    } catch (e) {}

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query: args,
      view,
    });

    const data = await baseModel.findOne({ ...args, ...dependencyFields });
    return data ? await nocoExecute(ast, data, {}, dependencyFields) : {};
  }

  async getDataGroupBy(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    const { model, view, query = {} } = param;

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const listArgs: any = { ...query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    const data = await baseModel.groupBy(listArgs);
    const count = await baseModel.groupByCount(listArgs);

    return new PagedResponseImpl(data, {
      ...query,
      count,
    });
  }

  async getDataGroupByCount(
    context: NcContext,
    param: { model: Model; view: View; query?: any },
  ) {
    const { model, view, query = {} } = param;

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const listArgs: any = { ...query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    return await baseModel.groupByCount(listArgs);
  }

  async dataRead(
    context: NcContext,
    param: PathParams & {
      query: any;
      rowId: string;
      disableOptimization?: boolean;
      getHiddenColumn?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      getHiddenColumn: param.getHiddenColumn,
    });

    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    return row;
  }

  async dataExist(
    context: NcContext,
    param: PathParams & { rowId: string; query: any },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.exist(param.rowId);
  }

  // todo: Handle the error case where view doesnt belong to model
  async groupedDataList(
    context: NcContext,
    param: PathParams & { query: any; columnId: string },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    const groupedData = await this.getGroupedDataList(context, {
      model,
      view,
      query: param.query,
      columnId: param.columnId,
    });
    return groupedData;
  }

  async getGroupedDataList(
    context: NcContext,
    param: {
      model;
      view: View;
      query: any;
      columnId: string;
    },
  ) {
    const { model, view, query = {} } = param;

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query,
      view,
      includeRowColorColumns: query.include_row_color === 'true',
    });

    const listArgs: any = { ...dependencyFields };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
    try {
      listArgs.options = JSON.parse(listArgs.optionsArrJson);
    } catch (e) {}

    let data = [];

    const groupedData = await baseModel.groupedList({
      ...listArgs,
      groupColumnId: param.columnId,
    });
    data = await nocoExecute({ key: 1, value: ast }, groupedData, {}, listArgs);
    const countArr = await baseModel.groupedListCount({
      ...listArgs,
      groupColumnId: param.columnId,
    });
    data = data.map((item) => {
      // todo: use map to avoid loop
      const count =
        countArr.find((countItem: any) => countItem.key === item.key)?.count ??
        0;

      item.value = new PagedResponseImpl(item.value, {
        ...query,
        count: count,
      });
      return item;
    });

    return data;
  }

  async dataListByViewId(
    context: NcContext,
    param: { viewId: string; query: any; apiVersion?: NcApiVersion },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    return await this.getDataList(context, {
      model,
      view,
      query: param.query,
      apiVersion: param.apiVersion,
    });
  }

  async mmList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const key = `${model.title}List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.mmList(
              {
                colId: param.colId,
                parentId: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count: any = await baseModel.mmListCount(
      {
        colId: param.colId,
        parentId: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async mmExcludedList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const key = 'List';
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.getMmChildrenExcludedList(
              {
                colId: param.colId,
                pid: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.getMmChildrenExcludedListCount(
      {
        colId: param.colId,
        pid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async hmExcludedList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const key = 'List';
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.getHmChildrenExcludedList(
              {
                colId: param.colId,
                pid: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.getHmChildrenExcludedListCount(
      {
        colId: param.colId,
        pid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async btExcludedList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) return NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const key = 'List';
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.getBtChildrenExcludedList(
              {
                colId: param.colId,
                cid: param.rowId,
              },
              args,
            );
          },
        },
        {},

        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.getBtChildrenExcludedListCount(
      {
        colId: param.colId,
        cid: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  async hmList(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      query: any;
      rowId: string;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const key = `${model.title}List`;
    const requestObj: any = {
      [key]: 1,
    };

    const data = (
      await nocoExecute(
        requestObj,
        {
          [key]: async (args) => {
            return await baseModel.hmList(
              {
                colId: param.colId,
                id: param.rowId,
              },
              args,
            );
          },
        },
        {},
        { nested: { [key]: param.query } },
      )
    )?.[key];

    const count = await baseModel.hmListCount(
      {
        colId: param.colId,
        id: param.rowId,
      },
      param.query,
    );

    return new PagedResponseImpl(data, {
      totalRows: count,
    } as any);
  }

  async dataReadByViewId(
    context: NcContext,
    param: { viewId: string; rowId: string; query: any },
  ) {
    try {
      const model = await Model.getByIdOrName(context, {
        id: param.viewId,
      });
      if (!model) NcError.tableNotFound(param.viewId);

      const source = await Source.get(context, model.source_id);

      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const { ast, dependencyFields } = await getAst(context, {
        model,
        query: param.query,
      });

      return await nocoExecute(
        ast,
        await baseModel.readByPk(param.rowId, false),
        {},
        dependencyFields,
      );
    } catch (e) {
      this.logger.error(e);
      NcError.internalServerError('Please check server log for more details');
    }
  }

  async dataInsertByViewId(
    context: NcContext,
    param: { viewId: string; body: any; cookie: any },
  ) {
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    if (!model) return NcError.tableNotFound(param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataUpdateByViewId(
    context: NcContext,
    param: {
      viewId: string;
      rowId: string;
      body: any;
      cookie: any;
    },
  ) {
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    if (!model) NcError.tableNotFound(param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  async dataDeleteByViewId(
    context: NcContext,
    param: {
      viewId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    const model = await Model.getByIdOrName(context, {
      id: param.viewId,
    });
    if (!model) NcError.tableNotFound(param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async relationDataDelete(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      childId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    await baseModel.removeChild({
      colId: param.colId,
      childId: param.childId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  async relationDataAdd(
    context: NcContext,
    param: {
      viewId: string;
      colId: string;
      childId: string;
      rowId: string;
      cookie: any;
    },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    await baseModel.addChild({
      colId: param.colId,
      childId: param.childId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  async getViewAndModelFromRequestByAliasOrId(
    context: NcContext,
    req,
    // :
    // | Request<{ baseName: string; tableName: string; viewName?: string }>
    // | Request,
  ) {
    const base = await Base.getWithInfoByTitleOrId(
      context,
      req.params.baseId ?? req.params.baseName,
    );

    const model = await Model.getByAliasOrId(context, {
      base_id: base.id,
      aliasOrId: req.params.tableName,
    });
    const view =
      req.params.viewName &&
      (await View.getByTitleOrId(context, {
        titleOrId: req.params.viewName,
        fk_model_id: model.id,
      }));
    if (!model) NcError.tableNotFound(req.params.tableName);
    return { model, view };
  }

  async getColumnByIdOrName(
    context: NcContext,
    columnNameOrId: string,
    model: Model,
  ) {
    const column = (await model.getColumns(context)).find(
      (c) =>
        c.title === columnNameOrId ||
        c.id === columnNameOrId ||
        c.column_name === columnNameOrId,
    );

    if (!column) NcError.fieldNotFound(columnNameOrId);

    return column;
  }
}
