import { Injectable, Logger } from '@nestjs/common';
import { isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import papaparse from 'papaparse';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { PathParams } from '~/helpers/dataHelpers';
import type { NcContext } from '~/interface/config';
import type { Filter } from '~/models';
import type LinkToAnotherRecordColumn from '../models/LinkToAnotherRecordColumn';
import { nocoExecute } from '~/utils';
import { getDbRows, getViewAndModelByAliasOrId } from '~/helpers/dataHelpers';
import { Base, Column, Model, Source, View } from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// Add this helper function at the top of the file after imports
function addCaseInsensitiveFlag(filters: Filter[]) {
  return filters.map(filter => {
    // Only add case insensitive flag for string operations
    if (['eq', 'like', 'nlike', 'startswith', 'endswith'].includes(filter.comparison_op)) {
      return {
        ...filter,
        is_case_insensitive: true,
        // Use fk_column_id directly since that's what the Filter type expects
        fk_column_id: filter.fk_column_id
      };
    }
    return filter;
  });
}

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

    // Normalize fields before calling getDataList
    if (param.query.fields) {
      const requestedFields = param.query.fields.split(',').map(f => f.trim());
      const resolvedColumns = [];
      for (const f of requestedFields) {
        // Attempt to resolve the column based on various naming options
        const column = await this.getColumnByIdOrName(context, f, model);
        resolvedColumns.push(column.title); // Use the column title since that's what NocoDB expects
      }
      param.query.fields = resolvedColumns.join(',');
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
    });
  }

  async dataFindOne(context: NcContext, param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);

    // Normalize fields in dataFindOne as well
    if (param.query.fields) {
      const requestedFields = param.query.fields.split(',').map(f => f.trim());
      const resolvedColumns = [];
      for (const f of requestedFields) {
        const column = await this.getColumnByIdOrName(context, f, model);
        resolvedColumns.push(column.title);
      }
      param.query.fields = resolvedColumns.join(',');
    }

    // Handle case-insensitive flag from query params
    if (param.query.case_insensitive === 'true') {
      if (param.query.filterArrJson) {
        const filters = JSON.parse(param.query.filterArrJson || '[]');
        param.query.filterArrJson = JSON.stringify(addCaseInsensitiveFlag(filters));
      }

      // Handle where condition for case-insensitive search
      if (param.query.where) {
        try {
          const whereStr = param.query.where;
          const matches = whereStr.match(/\((.*?),(.*?),(.*?)\)/);
          if (matches) {
            const [_, field, op, value] = matches;
            const filter = {
              fk_column_id: field.trim(),
              comparison_op: op.trim(),
              value: value.trim(),
              is_case_insensitive: true,
            };
            param.query.filterArrJson = JSON.stringify([filter]);
            delete param.query.where;
          }
        } catch (e) {
          this.logger.error('Error processing where condition:', e);
        }
      }
    }

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

    return await baseModel.nestedInsert(param.body, null, param.cookie);
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
      // todo: Should have error http status code
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
    },
  ) {
    const { model, query = {}, ignoreViewFilterAndSort = false } = param;

    this.logger.debug('Original query:', query);

    // Handle case-insensitive filters from query parameters
    if (query.filterArrJson) {
      try {
        let filters = JSON.parse(query.filterArrJson);
        if (query.case_insensitive === 'true') {
          filters = addCaseInsensitiveFlag(filters);
          query.filterArrJson = JSON.stringify(filters);
          this.logger.debug('Modified filters with case-insensitive flag:', filters);
        }
      } catch (e) {
        this.logger.error('Error processing filters:', e);
      }
    }

    // Process case-insensitive `where` conditions
    if (query.where && query.case_insensitive === 'true') {
      try {
        const whereStr = query.where;
        const matches = whereStr.match(/\((.*?),(.*?),(.*?)\)/);
        if (matches) {
          const [_, field, op, value] = matches;

          const filters = [{
            fk_column_id: field,
            comparison_op: op,
            value: value,
            is_case_insensitive: true,
          }];

          // Normalize and resolve the column here
          const source = await Source.get(context, model.source_id);
          const resolvedFilters = [];
          for (const f of filters) {
            const column = await this.getColumnByIdOrName(context, f.fk_column_id, model);
            resolvedFilters.push({
              ...f,
              fk_column_id: column.id // or column.title/column_name depending on your DB driver’s expectation
            });
          }

          query.filterArrJson = JSON.stringify(resolvedFilters);
          // Remove the 'where' since we have converted it to filterArrJson
          delete query.where;
        }
      } catch (e) {
        this.logger.error('Error processing where condition:', e);
      }
    }


    const source = await Source.get(context, model.source_id);
    const baseModel =
      param.baseModel ||
      (await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      }));

    const { ast, dependencyFields } = await getAst(context, {
      model,
      query,
      view: param.view,
      throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
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
            await baseModel.list(listArgs, {
              ignoreViewFilterAndSort,
              throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
              ignorePagination: param.ignorePagination,
              limitOverride: param.limitOverride,
            }),
            {},
            listArgs,
          );
        } catch (e) {
          if (e instanceof NcBaseError) throw e;
          this.logger.error(e);
          NcError.internalServerError('Please check server log for more details');
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
    param: { viewId: string; query: any },
  ) {
    const view = await View.get(context, param.viewId);

    const model = await Model.getByIdOrName(context, {
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.tableNotFound(view?.fk_model_id || param.viewId);

    return await this.getDataList(context, { model, view, query: param.query });
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
      req.params.baseName,
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

  async extractXlsxData(
    context: NcContext,
    param: { view: View; query: any; siteUrl: string },
  ) {
    const { view, query, siteUrl } = param;
    const source = await Source.get(context, view.source_id);

    await view.getModelWithInfo(context);
    await view.getColumns(context);

    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      )
      .filter((column) => !isSystemColumn(column) || view.show_system_fields);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const { offset, dbRows, elapsed } = await getDbRows(context, {
      baseModel,
      view,
      query,
      siteUrl,
    });

    const fields = query.fields as string[];

    const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });

    return { offset, dbRows, elapsed, data };
  }

  async extractCsvData(context: NcContext, view: View, req) {
    const source = await Source.get(context, view.source_id);
    const fields = req.query.fields;

    await view.getModelWithInfo(context);
    await view.getColumns(context);

    view.model.columns = view.columns
      .filter((c) => c.show)
      .map(
        (c) =>
          new Column({
            ...c,
            ...view.model.columnsById[c.fk_column_id],
          } as any),
      )
      .filter((column) => !isSystemColumn(column) || view.show_system_fields);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const { offset, dbRows, elapsed } = await getDbRows(context, {
      baseModel,
      view,
      query: req.query,
      siteUrl: (req as any).ncSiteUrl,
    });

    const data = papaparse.unparse(
      {
        fields: view.model.columns
          .sort((c1, c2) =>
            Array.isArray(fields)
              ? fields.indexOf(c1.title as any) -
                fields.indexOf(c2.title as any)
              : 0,
          )
          .filter(
            (c) =>
              !fields ||
              !Array.isArray(fields) ||
              fields.includes(c.title as any),
          )
          .map((c) => c.title),
        data: dbRows,
      },
      {
        escapeFormulae: true,
      },
    );

    return { offset, dbRows, elapsed, data };
  }


  async getColumnByIdOrName(context: NcContext, columnNameOrId: string, model: Model) {
    const normalizedQueryField = normalizeFieldName(columnNameOrId);

    function normalizeFieldName(fieldName: string): string {
      return fieldName.replace(/\s+/g, '_').toLowerCase();
    }

    const columns = await model.getColumns(context);
    const matchedColumn = columns.find(c => {
      const normalizedColumnTitle = normalizeFieldName(c.title || '');
      const normalizedColumnName = c.column_name?.toLowerCase();
      const normalizedColumnId = c.id?.toLowerCase();
      return (
        normalizedColumnTitle === normalizedQueryField ||
        normalizedColumnName === normalizedQueryField ||
        normalizedColumnId === normalizedQueryField
      );
    });

    if (!matchedColumn) {
      this.logger.error(`Field '${columnNameOrId}' not found in model '${model.title}'`);
      throw NcError.fieldNotFound(columnNameOrId);
    }

    return matchedColumn;
  }

}