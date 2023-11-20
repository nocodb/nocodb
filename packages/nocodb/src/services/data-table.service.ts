import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, RelationTypes } from 'nocodb-sdk';
import { nocoExecute } from 'nc-help';
import type { LinkToAnotherRecordColumn } from '~/models';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Column, Model, Source, View } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class DataTableService {
  constructor(private datasService: DatasService) {}

  async dataList(param: {
    baseId?: string;
    modelId: string;
    query: any;
    viewId?: string;
  }) {
    const { model, view } = await this.getModelAndView(param);

    return await this.datasService.getDataList({
      model,
      view,
      query: param.query,
      throwErrorIfInvalidParams: true,
    });
  }

  async dataRead(param: {
    baseId?: string;
    modelId: string;
    rowId: string;
    viewId?: string;
    query: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      throwErrorIfInvalidParams: true,
    });

    if (!row) {
      NcError.notFound('Row not found');
    }

    return row;
  }

  async dataInsert(param: {
    baseId?: string;
    viewId?: string;
    modelId: string;
    body: any;
    cookie: any;
  }) {
    const { model, view } = await this.getModelAndView(param);
    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    // if array then do bulk insert
    const result = await baseModel.bulkInsert(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        insertOneByOneAsFallback: true,
        isSingleRecordInsertion: !Array.isArray(param.body),
      },
    );

    return Array.isArray(param.body) ? result : result[0];
  }

  async dataUpdate(param: {
    baseId?: string;
    modelId: string;
    viewId?: string;
    // rowId: string;
    body: any;
    cookie: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    await this.checkForDuplicateRow({ rows: param.body, model });

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    await baseModel.bulkUpdate(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        throwExceptionIfNotExist: true,
        isSingleRecordUpdation: !Array.isArray(param.body),
      },
    );

    return this.extractIdObj({ body: param.body, model });
  }

  async dataDelete(param: {
    baseId?: string;
    modelId: string;
    viewId?: string;
    // rowId: string;
    cookie: any;
    body: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

    await this.checkForDuplicateRow({ rows: param.body, model });

    const source = await Source.get(model.source_id);
    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    await baseModel.bulkDelete(
      Array.isArray(param.body) ? param.body : [param.body],
      {
        cookie: param.cookie,
        throwExceptionIfNotExist: true,
        isSingleRecordDeletion: !Array.isArray(param.body),
      },
    );

    return this.extractIdObj({ body: param.body, model });
  }

  async dataCount(param: {
    baseId?: string;
    viewId?: string;
    modelId: string;
    query: any;
  }) {
    const { model, view } = await this.getModelAndView(param);

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

    const count: number = await baseModel.count(countArgs, false, true);

    return { count };
  }

  private async getModelAndView(param: {
    baseId?: string;
    viewId?: string;
    modelId: string;
  }) {
    const model = await Model.get(param.modelId);

    if (!model) {
      NcError.notFound(`Table with id '${param.modelId}' not found`);
    }

    if (param.baseId && model.base_id !== param.baseId) {
      throw new Error('Table not belong to base');
    }

    let view: View;

    if (param.viewId) {
      view = await View.get(param.viewId);
      if (!view || (view.fk_model_id && view.fk_model_id !== param.modelId)) {
        NcError.unprocessableEntity(`View with id '${param.viewId}' not found`);
      }
    }

    return { model, view };
  }

  private async extractIdObj({
    model,
    body,
  }: {
    body: Record<string, any> | Record<string, any>[];
    model: Model;
  }) {
    const pkColumns = await model
      .getColumns()
      .then((cols) => cols.filter((col) => col.pk));

    const result = (Array.isArray(body) ? body : [body]).map((row) => {
      return pkColumns.reduce((acc, col) => {
        acc[col.title] = row[col.title] ?? row[col.column_name];
        return acc;
      }, {});
    });

    return Array.isArray(body) ? result : result[0];
  }

  private async checkForDuplicateRow({
    rows,
    model,
  }: {
    rows: any[] | any;
    model: Model;
  }) {
    if (!rows || !Array.isArray(rows) || rows.length === 1) {
      return;
    }

    await model.getColumns();

    const keys = new Set();

    for (const row of rows) {
      let pk;
      // if only one primary key then extract the value
      if (model.primaryKeys.length === 1)
        pk = row[model.primaryKey.title] ?? row[model.primaryKey.column_name];
      // if composite primary key then join the values with ___
      else
        pk = model.primaryKeys
          .map((pk) => row[pk.title] ?? row[pk.column_name])
          .join('___');
      // if duplicate then throw error
      if (keys.has(pk)) {
        NcError.unprocessableEntity('Duplicate record with id ' + pk);
      }

      if (pk === undefined || pk === null) {
        NcError.unprocessableEntity('Primary key is required');
      }
      keys.add(pk);
    }
  }

  async nestedDataList(param: {
    viewId: string;
    modelId: string;
    query: any;
    rowId: string | string[] | number | number[];
    columnId: string;
  }) {
    const { model, view } = await this.getModelAndView(param);
    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    if (!(await baseModel.exist(param.rowId))) {
      NcError.notFound(`Record with id '${param.rowId}' not found`);
    }

    const column = await this.getColumn(param);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const relatedModel = await colOptions.getRelatedTable();

    const { ast, dependencyFields } = await getAst({
      model: relatedModel,
      query: param.query,
      extractOnlyPrimaries: !(param.query?.f || param.query?.fields),
    });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    let data: any[];
    let count: number;
    if (colOptions.type === RelationTypes.MANY_TO_MANY) {
      data = await baseModel.mmList(
        {
          colId: column.id,
          parentId: param.rowId,
        },
        listArgs as any,
      );
      count = (await baseModel.mmListCount(
        {
          colId: column.id,
          parentId: param.rowId,
        },
        param.query,
      )) as number;
    } else if (colOptions.type === RelationTypes.HAS_MANY) {
      data = await baseModel.hmList(
        {
          colId: column.id,
          id: param.rowId,
        },
        listArgs as any,
      );
      count = (await baseModel.hmListCount(
        {
          colId: column.id,
          id: param.rowId,
        },
        param.query,
      )) as number;
    } else {
      data = await baseModel.btRead(
        {
          colId: column.id,
          id: param.rowId,
        },
        param.query as any,
      );
    }

    data = await nocoExecute(ast, data, {}, listArgs);

    if (colOptions.type === RelationTypes.BELONGS_TO) return data;

    return new PagedResponseImpl(data, {
      count,
      ...param.query,
    });
  }

  private async getColumn(param: { modelId: string; columnId: string }) {
    const column = await Column.get({ colId: param.columnId });

    if (!column)
      NcError.notFound(`Column with id '${param.columnId}' not found`);

    if (column.fk_model_id !== param.modelId)
      NcError.badRequest('Column not belong to model');

    if (!isLinksOrLTAR(column)) NcError.badRequest('Column is not LTAR');
    return column;
  }

  async nestedLink(param: {
    cookie: any;
    viewId: string;
    modelId: string;
    columnId: string;
    query: any;
    refRowIds: string | string[] | number | number[] | Record<string, any>;
    rowId: string;
  }) {
    this.validateIds(param.refRowIds);

    const { model, view } = await this.getModelAndView(param);

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const column = await this.getColumn(param);

    await baseModel.addLinks({
      colId: column.id,
      childIds: Array.isArray(param.refRowIds)
        ? param.refRowIds
        : [param.refRowIds],
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  async nestedUnlink(param: {
    cookie: any;
    viewId: string;
    modelId: string;
    columnId: string;
    query: any;
    refRowIds: string | string[] | number | number[] | Record<string, any>;
    rowId: string;
  }) {
    this.validateIds(param.refRowIds);

    const { model, view } = await this.getModelAndView(param);
    if (!model)
      NcError.notFound('Table with id ' + param.modelId + ' not found');

    const source = await Source.get(model.source_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const column = await this.getColumn(param);

    await baseModel.removeLinks({
      colId: column.id,
      childIds: Array.isArray(param.refRowIds)
        ? param.refRowIds
        : [param.refRowIds],
      rowId: param.rowId,
      cookie: param.cookie,
    });

    return true;
  }

  private validateIds(rowIds: any[] | any) {
    if (Array.isArray(rowIds)) {
      const map = new Map<string, boolean>();
      const set = new Set<string>();
      for (const rowId of rowIds) {
        if (rowId === undefined || rowId === null)
          NcError.unprocessableEntity('Invalid row id ' + rowId);
        if (map.has(rowId)) {
          set.add(rowId);
        } else {
          map.set(rowId, true);
        }
      }

      if (set.size > 0)
        NcError.unprocessableEntity(
          'Child record with id [' + [...set].join(', ') + '] are duplicated',
        );
    } else if (rowIds === undefined || rowIds === null) {
      NcError.unprocessableEntity('Invalid row id ' + rowIds);
    }
  }
}
