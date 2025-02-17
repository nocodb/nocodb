import { Injectable } from '@nestjs/common';
import { isLinksOrLTAR, RelationTypes, ViewTypes } from 'nocodb-sdk';
import { validatePayload } from 'src/helpers';
import type { NcApiVersion } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import { nocoExecute } from '~/utils';
import { Column, Model, Source, View } from '~/models';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class DataTableService {
  constructor(protected datasService: DatasService) {}

  async dataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      query: any;
      viewId?: string;
      ignorePagination?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { modelId, viewId, baseId, ...rest } = param;
    const { model, view } = await this.getModelAndView(context, {
      modelId,
      viewId,
      baseId,
    });
    return await this.datasService.dataList(context, {
      ...rest,
      model,
      view,
      apiVersion: param.apiVersion,
    });
  }

  async dataRead(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      rowId: string;
      viewId?: string;
      query: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const row = await baseModel.readByPk(param.rowId, false, param.query, {
      throwErrorIfInvalidParams: true,
      apiVersion: param.apiVersion,
    });

    if (!row) {
      NcError.recordNotFound(param.rowId);
    }

    return row;
  }

  async dataAggregate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    if (view.type !== ViewTypes.GRID) {
      NcError.badRequest('Aggregation is only supported on grid views');
    }

    const listArgs: any = { ...param.query };

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    const data = await baseModel.aggregate(listArgs, view);

    return data;
  }

  async dataInsert(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      body: any;
      cookie: any;
      undo?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
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
        typecast: (param.cookie?.query?.typecast ?? '') === 'true',
        undo: param.undo,
        apiVersion: param.apiVersion,
      },
    );

    return Array.isArray(param.body) ? result : result[0];
  }

  async dataMove(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      rowId: string;
      cookie: any;
      beforeRowId?: string;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    await baseModel.moveRecord({
      cookie: param.cookie,
      rowId: param.rowId,
      beforeRowId: param.beforeRowId,
    });

    return true;
  }

  async dataUpdate(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      // rowId: string;
      body: any;
      cookie: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    await this.checkForDuplicateRow(context, { rows: param.body, model });

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
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
        apiVersion: param.apiVersion,
      },
    );

    return this.extractIdObj(context, { body: param.body, model });
  }

  async dataDelete(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      // rowId: string;
      cookie: any;
      body: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    await this.checkForDuplicateRow(context, { rows: param.body, model });

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
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

    return this.extractIdObj(context, { body: param.body, model });
  }

  async dataCount(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      query: any;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
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

  protected async getModelAndView(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
    },
  ) {
    const model = await Model.get(context, param.modelId);

    if (!model) {
      NcError.tableNotFound(param.modelId);
    }

    if (param.baseId && model.base_id !== param.baseId) {
      throw new Error('Table not belong to base');
    }

    let view: View;

    if (param.viewId) {
      view = await View.get(context, param.viewId);
      if (!view || (view.fk_model_id && view.fk_model_id !== param.modelId)) {
        NcError.viewNotFound(param.viewId);
      }
    }

    return { model, view };
  }

  private async extractIdObj(
    context: NcContext,
    {
      model,
      body,
    }: {
      body: Record<string, any> | Record<string, any>[];
      model: Model;
    },
  ) {
    const pkColumns = await model
      .getColumns(context)
      .then((cols) => cols.filter((col) => col.pk));

    const result = (Array.isArray(body) ? body : [body]).map((row) => {
      return pkColumns.reduce((acc, col) => {
        acc[col.title] = row[col.title] ?? row[col.column_name];
        return acc;
      }, {});
    });

    return Array.isArray(body) ? result : result[0];
  }

  private async checkForDuplicateRow(
    context: NcContext,
    {
      rows,
      model,
    }: {
      rows: any[] | any;
      model: Model;
    },
  ) {
    if (!rows || !Array.isArray(rows) || rows.length === 1) {
      return;
    }

    await model.getColumns(context);

    const keys = new Set();

    for (const row of rows) {
      let pk;
      // if only one primary key then extract the value
      if (model.primaryKeys.length === 1)
        pk = row[model.primaryKey.title] ?? row[model.primaryKey.column_name];
      // if composite primary key then join the values with ___
      else
        pk = model.primaryKeys
          .map((pk) =>
            (row[pk.title] ?? row[pk.column_name])
              ?.toString?.()
              ?.replaceAll('_', '\\_'),
          )
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

  async nestedDataList(
    context: NcContext,
    param: {
      viewId: string;
      modelId: string;
      query: any;
      rowId: string | string[] | number | number[];
      columnId: string;
      apiVersion?: NcApiVersion;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);
    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    if (!(await baseModel.exist(param.rowId))) {
      NcError.recordNotFound(`${param.rowId}`);
    }

    const column = await this.getColumn(context, param);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    const relatedModel = await colOptions.getRelatedTable(context);

    const { ast, dependencyFields } = await getAst(context, {
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
          apiVersion: param.apiVersion,
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
          apiVersion: param.apiVersion,
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
          apiVersion: param.apiVersion,
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

  private async getColumn(
    context: NcContext,
    param: { modelId: string; columnId: string },
  ) {
    const column = await Column.get(context, { colId: param.columnId });

    if (!column) NcError.fieldNotFound(param.columnId);

    if (column.fk_model_id !== param.modelId)
      NcError.badRequest('Column not belong to model');

    if (!isLinksOrLTAR(column)) NcError.badRequest('Column is not LTAR');
    return column;
  }

  async nestedLink(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      refRowIds:
        | string
        | string[]
        | number
        | number[]
        | Record<string, any>
        | Record<string, any>[];
      rowId: string;
    },
  ) {
    this.validateIds(param.refRowIds);

    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const column = await this.getColumn(context, param);

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

  async nestedUnlink(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      refRowIds: string | string[] | number | number[] | Record<string, any>;
      rowId: string;
    },
  ) {
    this.validateIds(param.refRowIds);

    const { model, view } = await this.getModelAndView(context, param);
    if (!model) NcError.tableNotFound(param.modelId);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const column = await this.getColumn(context, param);

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

  // todo: naming & optimizing
  async nestedListCopyPasteOrDeleteAll(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      columnId: string;
      query: any;
      data: {
        operation: 'copy' | 'paste' | 'deleteAll';
        rowId: string;
        columnId: string;
        fk_related_model_id: string;
      }[];
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/nestedListCopyPasteOrDeleteAllReq',
      param.data,
    );

    const operationMap = param.data.reduce(
      (map, p) => {
        map[p.operation] = p;
        return map;
      },
      {} as Record<
        'copy' | 'paste' | 'deleteAll',
        {
          operation: 'copy' | 'paste' | 'deleteAll';
          rowId: string;
          columnId: string;
          fk_related_model_id: string;
        }
      >,
    );

    if (
      !operationMap.deleteAll &&
      operationMap.copy.fk_related_model_id !==
        operationMap.paste.fk_related_model_id
    ) {
      throw new Error(
        'The operation is not supported on different fk_related_model_id',
      );
    }

    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    if (
      operationMap.deleteAll &&
      !(await baseModel.exist(operationMap.deleteAll.rowId))
    ) {
      NcError.recordNotFound(operationMap.deleteAll.rowId);
    } else if (operationMap.copy && operationMap.paste) {
      const [existsCopyRow, existsPasteRow] = await Promise.all([
        baseModel.exist(operationMap.copy.rowId),
        baseModel.exist(operationMap.paste.rowId),
      ]);

      if (!existsCopyRow && !existsPasteRow) {
        NcError.recordNotFound(
          `'${operationMap.copy.rowId}' and '${operationMap.paste.rowId}'`,
        );
      } else if (!existsCopyRow) {
        NcError.recordNotFound(operationMap.copy.rowId);
      } else if (!existsPasteRow) {
        NcError.recordNotFound(operationMap.paste.rowId);
      }
    }

    const column = await this.getColumn(context, param);
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );
    const relatedModel = await colOptions.getRelatedTable(context);
    await relatedModel.getColumns(context);

    if (colOptions.type !== RelationTypes.MANY_TO_MANY) return;

    const { dependencyFields } = await getAst(context, {
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

    if (operationMap.deleteAll) {
      let deleteCellNestedList = await baseModel.mmList(
        {
          colId: column.id,
          parentId: operationMap.deleteAll.rowId,
        },
        listArgs as any,
        true,
      );

      if (deleteCellNestedList && Array.isArray(deleteCellNestedList)) {
        await baseModel.removeLinks({
          colId: column.id,
          childIds: deleteCellNestedList,
          rowId: operationMap.deleteAll.rowId,
          cookie: param.cookie,
        });

        // extract only pk row data
        deleteCellNestedList = deleteCellNestedList.map((nestedList) => {
          return relatedModel.primaryKeys.reduce((acc, col) => {
            acc[col.title || col.column_name] =
              nestedList[col.title || col.column_name];
            return acc;
          }, {});
        });
      } else {
        deleteCellNestedList = [];
      }

      return { link: [], unlink: deleteCellNestedList };
    } else if (operationMap.copy && operationMap.paste) {
      const [copiedCellNestedList, pasteCellNestedList] = await Promise.all([
        baseModel.mmList(
          {
            colId: operationMap.copy.columnId,
            parentId: operationMap.copy.rowId,
          },
          listArgs as any,
          true,
        ),
        baseModel.mmList(
          {
            colId: column.id,
            parentId: operationMap.paste.rowId,
          },
          listArgs as any,
          true,
        ),
      ]);

      const filteredRowsToLink = this.filterAndMapRows(
        copiedCellNestedList,
        pasteCellNestedList,
        relatedModel.primaryKeys,
      );

      const filteredRowsToUnlink = this.filterAndMapRows(
        pasteCellNestedList,
        copiedCellNestedList,
        relatedModel.primaryKeys,
      );

      await Promise.all([
        filteredRowsToLink.length &&
          baseModel.addLinks({
            colId: column.id,
            childIds: filteredRowsToLink,
            rowId: operationMap.paste.rowId,
            cookie: param.cookie,
          }),
        filteredRowsToUnlink.length &&
          baseModel.removeLinks({
            colId: column.id,
            childIds: filteredRowsToUnlink,
            rowId: operationMap.paste.rowId,
            cookie: param.cookie,
          }),
      ]);

      return { link: filteredRowsToLink, unlink: filteredRowsToUnlink };
    }
  }

  private validateIds(rowIds: any[] | any) {
    if (Array.isArray(rowIds)) {
      const map = new Map<string, boolean>();
      const set = new Set<string>();
      for (const rowId of rowIds) {
        if (rowId === undefined || rowId === null)
          NcError.recordNotFound(rowId);
        if (map.has(rowId)) {
          set.add(rowId);
        } else {
          map.set(rowId, true);
        }
      }

      if (set.size > 0) NcError.duplicateRecord([...set]);
    } else if (rowIds === undefined || rowIds === null) {
      NcError.recordNotFound(rowIds);
    }
  }

  private filterAndMapRows(
    sourceList: Record<string, any>[],
    targetList: Record<string, any>[],
    primaryKeys: Column<any>[],
  ): Record<string, any>[] {
    return sourceList
      .filter(
        (sourceRow: Record<string, any>) =>
          !targetList.some((targetRow: Record<string, any>) =>
            primaryKeys.every(
              (key) =>
                sourceRow[key.title || key.column_name] ===
                targetRow[key.title || key.column_name],
            ),
          ),
      )
      .map((item: Record<string, any>) =>
        primaryKeys.reduce((acc, key) => {
          acc[key.title || key.column_name] =
            item[key.title || key.column_name];
          return acc;
        }, {} as Record<string, any>),
      );
  }

  async bulkDataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    let bulkFilterList = param.body;

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    const dataListResults = await bulkFilterList.reduce(
      async (accPromise, dF: any) => {
        const acc = await accPromise;
        const result = await this.datasService.dataList(context, {
          query: {
            ...dF,
          },
          model,
          view,
        });
        acc[dF.alias] = result;
        return acc;
      },
      Promise.resolve({}),
    );

    return dataListResults;
  }

  async bulkGroupBy(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    const source = await Source.get(context, model.source_id);

    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    let bulkFilterList = param.body;

    const listArgs: any = { ...param.query };
    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJSON);
    } catch (e) {}

    if (!bulkFilterList?.length) {
      NcError.badRequest('Invalid bulkFilterList');
    }

    const [data, count] = await Promise.all([
      baseModel.bulkGroupBy(listArgs, bulkFilterList, view),
      baseModel.bulkGroupByCount(listArgs, bulkFilterList, view),
    ]);

    bulkFilterList.forEach((dF: any) => {
      // sqlite3 returns data as string. Hence needs to be converted to json object
      let parsedData = data[dF.alias];

      if (typeof parsedData === 'string') {
        parsedData = JSON.parse(parsedData);
      }

      let parsedCount = count[dF.alias];

      if (typeof parsedCount === 'string') {
        parsedCount = JSON.parse(parsedCount);
      }

      data[dF.alias] = new PagedResponseImpl(parsedData, {
        ...dF,
        count: parsedCount?.count,
      });
    });

    return data;
  }
}
