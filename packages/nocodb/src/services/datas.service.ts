import { Injectable, Logger } from '@nestjs/common';
import { isSystemColumn } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import papaparse from 'papaparse';
import { nocoExecute } from 'nc-help';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { PathParams } from '~/modules/datas/helpers';
import { getDbRows, getViewAndModelByAliasOrId } from '~/modules/datas/helpers';
import { Base, Column, Model, Source, View } from '~/models';
import { NcBaseError, NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class DatasService {
  protected logger = new Logger(DatasService.name);

  constructor() {}

  async dataList(
    param: PathParams & { query: any; disableOptimization?: boolean },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    return await this.getDataList({
      model,
      view,
      query: param.query,
    });
  }

  async dataFindOne(param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    return await this.getFindOne({ model, view, query: param.query });
  }

  async dataGroupBy(param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    return await this.getDataGroupBy({ model, view, query: param.query });
  }

  async dataCount(param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const countArgs: any = { ...param.query };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    const count: number = await baseModel.count(countArgs);

    return { count };
  }

  async dataInsert(
    param: PathParams & {
      body: unknown;
      cookie: any;
      disableOptimization?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.nestedInsert(param.body, null, param.cookie);
  }

  async dataUpdate(
    param: PathParams & {
      body: unknown;
      cookie: any;
      rowId: string;
      disableOptimization?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
      param.disableOptimization,
    );
  }

  async dataDelete(param: PathParams & { rowId: string; cookie: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const source = await Source.get(model.source_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async getDataList(param: {
    model: Model;
    view?: View;
    query: any;
    baseModel?: BaseModelSqlv2;
    throwErrorIfInvalidParams?: boolean;
  }) {
    const { model, view, query = {} } = param;

    const source = await Source.get(model.source_id);

    const baseModel =
      param.baseModel ||
      (await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      }));

    const { ast, dependencyFields } = await getAst({
      model,
      query,
      view,
      throwErrorIfInvalidParams: param.throwErrorIfInvalidParams,
    });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    const [count, data] = await Promise.all([
      baseModel.count(listArgs),
      (async () => {
        let data = [];
        try {
          data = await nocoExecute(
            ast,
            await baseModel.list(
              listArgs,
              false,
              false,
              param.throwErrorIfInvalidParams,
            ),
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

  async getFindOne(param: { model: Model; view: View; query: any }) {
    const { model, view, query = {} } = param;

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const args: any = { ...query };
    try {
      args.filterArr = JSON.parse(args.filterArrJson);
    } catch (e) {}
    try {
      args.sortArr = JSON.parse(args.sortArrJson);
    } catch (e) {}

    const { ast, dependencyFields } = await getAst({
      model,
      query: args,
      view,
    });

    const data = await baseModel.findOne({ ...args, ...dependencyFields });
    return data ? await nocoExecute(ast, data, {}, dependencyFields) : {};
  }

  async getDataGroupBy(param: { model: Model; view: View; query?: any }) {
    const { model, view, query = {} } = param;

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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
    param: PathParams & {
      query: any;
      rowId: string;
      disableOptimization?: boolean;
      getHiddenColumn?: boolean;
    },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      getHiddenColumn: param.getHiddenColumn,
    });

    if (!row) {
      NcError.notFound('Row not found');
    }

    return row;
  }

  async dataExist(param: PathParams & { rowId: string; query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.exist(param.rowId);
  }

  // todo: Handle the error case where view doesnt belong to model
  async groupedDataList(param: PathParams & { query: any; columnId: string }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const groupedData = await this.getGroupedDataList({
      model,
      view,
      query: param.query,
      columnId: param.columnId,
    });
    return groupedData;
  }

  async getGroupedDataList(param: {
    model;
    view: View;
    query: any;
    columnId: string;
  }) {
    const { model, view, query = {} } = param;

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { ast, dependencyFields } = await getAst({ model, query, view });

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

  async dataListByViewId(param: { viewId: string; query: any }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    return await this.getDataList({ model, view, query: param.query });
  }

  async mmList(param: {
    viewId: string;
    colId: string;
    query: any;
    rowId: string;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async mmExcludedList(param: {
    viewId: string;
    colId: string;
    query: any;
    rowId: string;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async hmExcludedList(param: {
    viewId: string;
    colId: string;
    query: any;
    rowId: string;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async btExcludedList(param: {
    viewId: string;
    colId: string;
    query: any;
    rowId: string;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) return NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async hmList(param: {
    viewId: string;
    colId: string;
    query: any;
    rowId: string;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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

  async dataReadByViewId(param: { viewId: string; rowId: string; query: any }) {
    try {
      const model = await Model.getByIdOrName({
        id: param.viewId,
      });
      if (!model) NcError.notFound('Table not found');

      const source = await Source.get(model.source_id);

      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(source),
      });

      const { ast, dependencyFields } = await getAst({
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

  async dataInsertByViewId(param: { viewId: string; body: any; cookie: any }) {
    const model = await Model.getByIdOrName({
      id: param.viewId,
    });
    if (!model) return NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataUpdateByViewId(param: {
    viewId: string;
    rowId: string;
    body: any;
    cookie: any;
  }) {
    const model = await Model.getByIdOrName({
      id: param.viewId,
    });
    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  async dataDeleteByViewId(param: {
    viewId: string;
    rowId: string;
    cookie: any;
  }) {
    const model = await Model.getByIdOrName({
      id: param.viewId,
    });
    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async relationDataDelete(param: {
    viewId: string;
    colId: string;
    childId: string;
    rowId: string;
    cookie: any;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    await baseModel.removeChild({
      colId: param.colId,
      childId: param.childId,
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  async relationDataAdd(param: {
    viewId: string;
    colId: string;
    childId: string;
    rowId: string;
    cookie: any;
  }) {
    const view = await View.get(param.viewId);

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id || param.viewId,
    });

    if (!model) NcError.notFound('Table not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
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
    req,
    // :
    // | Request<{ baseName: string; tableName: string; viewName?: string }>
    // | Request,
  ) {
    const base = await Base.getWithInfoByTitleOrId(req.params.baseName);

    const model = await Model.getByAliasOrId({
      base_id: base.id,
      aliasOrId: req.params.tableName,
    });
    const view =
      req.params.viewName &&
      (await View.getByTitleOrId({
        titleOrId: req.params.viewName,
        fk_model_id: model.id,
      }));
    if (!model) NcError.notFound('Table not found');
    return { model, view };
  }

  async extractXlsxData(param: { view: View; query: any; siteUrl: string }) {
    const { view, query, siteUrl } = param;
    const source = await Source.get(view.source_id);

    await view.getModelWithInfo();
    await view.getColumns();

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

    const baseModel = await Model.getBaseModelSQL({
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { offset, dbRows, elapsed } = await getDbRows({
      baseModel,
      view,
      query,
      siteUrl,
    });

    const fields = query.fields as string[];

    const data = XLSX.utils.json_to_sheet(dbRows, { header: fields });

    return { offset, dbRows, elapsed, data };
  }

  async extractCsvData(view: View, req) {
    const source = await Source.get(view.source_id);
    const fields = req.query.fields;

    await view.getModelWithInfo();
    await view.getColumns();

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

    const baseModel = await Model.getBaseModelSQL({
      id: view.model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const { offset, dbRows, elapsed } = await getDbRows({
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

  async getColumnByIdOrName(columnNameOrId: string, model: Model) {
    const column = (await model.getColumns()).find(
      (c) =>
        c.title === columnNameOrId ||
        c.id === columnNameOrId ||
        c.column_name === columnNameOrId,
    );

    if (!column)
      NcError.notFound(`Column with id/name '${columnNameOrId}' is not found`);

    return column;
  }
}
