import { Injectable } from '@nestjs/common';
import { isSystemColumn, UITypes } from 'nocodb-sdk';
import * as XLSX from 'xlsx';
import papaparse from 'papaparse';
import { nocoExecute } from 'nc-help';
import { NcError } from '../helpers/catchError';
import getAst from '../helpers/getAst';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import { Base, Column, Model, Project, View } from '../models';
import NcConnectionMgrv2 from '../utils/common/NcConnectionMgrv2';
import {
  getDbRows,
  getViewAndModelByAliasOrId,
  serializeCellValue,
} from '../modules/datas/helpers';
import type { BaseModelSqlv2 } from '../db/BaseModelSqlv2';
import type { PathParams } from '../modules/datas/helpers';
import type { LinkToAnotherRecordColumn, LookupColumn } from '../models';

@Injectable()
export class DatasService {
  async dataList(param: PathParams & { query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const responseData = await this.getDataList({
      model,
      view,
      query: param.query,
    });
    return responseData;
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const countArgs: any = { ...param.query };
    try {
      countArgs.filterArr = JSON.parse(countArgs.filterArrJson);
    } catch (e) {}

    const count: number = await baseModel.count(countArgs);

    return { count };
  }

  async dataInsert(param: PathParams & { body: unknown; cookie: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.insert(param.body, null, param.cookie);
  }

  async dataUpdate(
    param: PathParams & { body: unknown; cookie: any; rowId: string },
  ) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    return await baseModel.updateByPk(
      param.rowId,
      param.body,
      null,
      param.cookie,
    );
  }

  async dataDelete(param: PathParams & { rowId: string; cookie: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);
    const base = await Base.get(model.base_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    // todo: Should have error http status code
    const message = await baseModel.hasLTARData(param.rowId, model);
    if (message.length) {
      return { message };
    }
    return await baseModel.delByPk(param.rowId, null, param.cookie);
  }

  async getDataList(param: {
    model: Model;
    view: View;
    query: any;
    baseModel?: BaseModelSqlv2;
  }) {
    const { model, view, query = {} } = param;

    const base = await Base.get(model.base_id);

    const baseModel =
      param.baseModel ||
      (await Model.getBaseModelSQL({
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(base),
      }));

    const { ast, dependencyFields } = await getAst({ model, query, view });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    let data = [];
    let count = 0;
    try {
      data = await nocoExecute(
        ast,
        await baseModel.list(listArgs),
        {},
        listArgs,
      );
      count = await baseModel.count(listArgs);
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }

    return new PagedResponseImpl(data, {
      ...query,
      count,
    });
  }

  async getFindOne(param: { model: Model; view: View; query: any }) {
    const { model, view, query = {} } = param;

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const data = await baseModel.findOne({ ...args, dependencyFields });
    return data ? await nocoExecute(ast, data, {}, {}) : {};
  }

  async getDataGroupBy(param: { model: Model; view: View; query?: any }) {
    const { model, view, query = {} } = param;

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const listArgs: any = { ...query };
    const data = await baseModel.groupBy({ ...query });
    const count = await baseModel.count(listArgs);

    return new PagedResponseImpl(data, {
      ...query,
      count,
    });
  }

  async dataRead(param: PathParams & { query: any; rowId: string }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const row = await baseModel.readByPk(param.rowId);

    if (!row) {
      NcError.notFound('Row not found');
    }

    const { ast } = await getAst({ model, query: param.query, view });

    return await nocoExecute(ast, row, {}, param.query);
  }

  async dataExist(param: PathParams & { rowId: string; query: any }) {
    const { model, view } = await getViewAndModelByAliasOrId(param);

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
    });

    const { ast } = await getAst({ model, query, view });

    const listArgs: any = { ...query };
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const count: any = await baseModel.mmListCount({
      colId: param.colId,
      parentId: param.rowId,
    });

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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const count = await baseModel.hmListCount({
      colId: param.colId,
      id: param.rowId,
    });

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

      const base = await Base.get(model.base_id);

      const baseModel = await Model.getBaseModelSQL({
        id: model.id,
        dbDriver: await NcConnectionMgrv2.get(base),
      });

      const { ast } = await getAst({ model, query: param.query });

      return await nocoExecute(
        ast,
        await baseModel.readByPk(param.rowId),
        {},
        {},
      );
    } catch (e) {
      console.log(e);
      NcError.internalServerError('Please check server log for more details');
    }
  }

  async dataInsertByViewId(param: { viewId: string; body: any; cookie: any }) {
    const model = await Model.getByIdOrName({
      id: param.viewId,
    });
    if (!model) return NcError.notFound('Table not found');

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(base),
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
    // | Request<{ projectName: string; tableName: string; viewName?: string }>
    // | Request,
  ) {
    const project = await Project.getWithInfoByTitleOrId(
      req.params.projectName,
    );

    const model = await Model.getByAliasOrId({
      project_id: project.id,
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
    const base = await Base.get(view.base_id);

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
      dbDriver: await NcConnectionMgrv2.get(base),
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
    const base = await Base.get(view.base_id);
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
      dbDriver: await NcConnectionMgrv2.get(base),
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

  async serializeCellValue({
    value,
    column,
    siteUrl,
  }: {
    column?: Column;
    value: any;
    siteUrl: string;
  }) {
    if (!column) {
      return value;
    }

    if (!value) return value;

    switch (column?.uidt) {
      case UITypes.Attachment: {
        let data = value;
        try {
          if (typeof value === 'string') {
            data = JSON.parse(value);
          }
        } catch {}

        return (data || []).map(
          (attachment) =>
            `${encodeURI(attachment.title)}(${encodeURI(
              attachment.path
                ? `${siteUrl}/${attachment.path}`
                : attachment.url,
            )})`,
        );
      }
      case UITypes.Lookup:
        {
          const colOptions = await column.getColOptions<LookupColumn>();
          const lookupColumn = await colOptions.getLookupColumn();
          return (
            await Promise.all(
              [...(Array.isArray(value) ? value : [value])].map(async (v) =>
                serializeCellValue({
                  value: v,
                  column: lookupColumn,
                  siteUrl,
                }),
              ),
            )
          ).join(', ');
        }
        break;
      case UITypes.LinkToAnotherRecord:
        {
          const colOptions =
            await column.getColOptions<LinkToAnotherRecordColumn>();
          const relatedModel = await colOptions.getRelatedTable();
          await relatedModel.getColumns();
          return [...(Array.isArray(value) ? value : [value])]
            .map((v) => {
              return v[relatedModel.displayValue?.title];
            })
            .join(', ');
        }
        break;
      default:
        if (value && typeof value === 'object') {
          return JSON.stringify(value);
        }
        return value;
    }
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
