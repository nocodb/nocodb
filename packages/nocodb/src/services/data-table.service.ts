import { Injectable, Logger } from '@nestjs/common';
import {
  isBtLikeV2Junction,
  isLinksOrLTAR,
  isMMOrMMLike,
  ncIsNumber,
  RelationTypes,
  ViewTypes,
} from 'nocodb-sdk';
import { validatePayload } from 'src/helpers';
import { NcApiVersion } from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import { validateV1V2DataPayloadLimit } from '~/helpers/dataHelpers';
import { Column, Filter, Model, Source, View } from '~/models';
import { nocoExecute, processConcurrently } from '~/utils';
import { DatasService } from '~/services/datas.service';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { dataWrapper } from '~/helpers/dbHelpers';
import { Profiler } from '~/helpers/profiler';

@Injectable()
export class DataTableService {
  constructor(protected datasService: DatasService) {}
  logger = new Logger(DataTableService.name);

  async dataList(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      query: any;
      viewId?: string;
      ignorePagination?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      user?: any;
    },
  ) {
    const { modelId, viewId, baseId, user, ...rest } = param;
    const { model, view } = await this.getModelAndView(context, {
      modelId,
      viewId,
      baseId,
      user,
    });
    return await this.datasService.dataList(context, {
      ...rest,
      model,
      view,
      apiVersion: param.apiVersion,
      includeSortAndFilterColumns: param?.includeSortAndFilterColumns,
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
      user?: any;
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
      NcError.get(context).recordNotFound(param.rowId);
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
      user?: any;
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

    if (view && view.type !== ViewTypes.GRID) {
      NcError.get(context).badRequest(
        'Aggregation is only supported on grid views',
      );
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
      internalFlags?: {
        allowSystemColumn?: boolean;
        skipHooks?: boolean;
      };
      user?: any;
    },
  ) {
    validateV1V2DataPayloadLimit(context, param);

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
        allowSystemColumn: param.internalFlags?.allowSystemColumn,
        skip_hooks: param.internalFlags?.skipHooks,
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
      user?: any;
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
      internalFlags?: {
        allowSystemColumn?: boolean;
        skipHooks?: boolean;
      };
      user?: any;
    },
  ) {
    validateV1V2DataPayloadLimit(context, param);

    const profiler = Profiler.start(`data-table/dataUpdate`);
    const { model, view } = await this.getModelAndView(context, param);
    profiler.log('getModelAndView done');
    await this.checkForDuplicateRow(context, { rows: param.body, model });
    profiler.log('checkForDuplicateRow done');

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
        typecast: (param.cookie?.query?.typecast ?? '') === 'true',
        isSingleRecordUpdation: !Array.isArray(param.body),
        apiVersion: param.apiVersion,
        allowSystemColumn: param.internalFlags?.allowSystemColumn,
        skip_hooks: param.internalFlags?.skipHooks,
      },
    );
    profiler.log('extractIdObj');
    const result = this.extractIdObj(context, { body: param.body, model });
    profiler.end();
    return result;
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
      user?: any;
    },
  ) {
    validateV1V2DataPayloadLimit(context, param);

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
      user?: any;
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

  async getModelAndView(
    context: NcContext,
    param: {
      baseId?: string;
      viewId?: string;
      modelId: string;
      user?: any;
    },
  ) {
    const model = await Model.get(context, param.modelId);
    if (!model) {
      NcError.get(context).tableNotFound(param.modelId);
    }

    if (param.baseId && model.base_id !== param.baseId) {
      NcError.get(context).tableNotFound(param.modelId);
    }

    // Table visibility permission is checked in extract-ids middleware
    // No need to check here to avoid circular dependency

    let view: View;

    if (param.viewId) {
      view = await View.get(context, param.viewId);
      if (!view || (view.fk_model_id && view.fk_model_id !== param.modelId)) {
        NcError.get(context).viewNotFound(param.viewId);
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
        acc[col.title] = row[col.title] ?? row[col.column_name] ?? row[col.id];
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
      // TODO: refactor to extractPkValues of baseModelSqlV2

      // if only one primary key then extract the value
      if (model.primaryKeys.length === 1)
        pk =
          row[model.primaryKey.title] ??
          row[model.primaryKey.column_name] ??
          row[model.primaryKey.id];
      // if composite primary key then join the values with ___
      else
        pk = model.primaryKeys
          .map((pk) =>
            (row[pk.title] ?? row[pk.column_name] ?? row[pk.id])
              ?.toString?.()
              ?.replaceAll('_', '\\_'),
          )
          .join('___');
      // if duplicate then throw error
      if (keys.has(pk)) {
        NcError.get(context).unprocessableEntity(
          'Duplicate record with id ' + pk,
        );
      }

      if (pk === undefined || pk === null) {
        NcError.get(context).unprocessableEntity('Primary key is required');
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
      user?: any;
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
      NcError.get(context).recordNotFound(`${param.rowId}`);
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
    if (
      ncIsNumber(Number(param.query.limit)) &&
      Number(param.query.limit) > 0
    ) {
      listArgs.nestedLimit = param.query.limit;
    }
    let data: any[];
    let count: number;

    // V2 single-target relations (MO/OO) — junction table with LIMIT 1
    if (isBtLikeV2Junction(column)) {
      data = await baseModel.mmRead(
        {
          colId: column.id,
          parentId: param.rowId,
        },
        listArgs as any,
      );
      data = await nocoExecute(ast, data, {}, listArgs);
      return data;
    }

    // V2 multi-target (OM/MM) and V1 MM — array via junction table
    if (isMMOrMMLike(column)) {
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
    } else if (
      colOptions.type !== RelationTypes.BELONGS_TO &&
      !column.meta?.bt
    ) {
      data = await baseModel.ooRead(
        {
          colId: column.id,
          id: param.rowId,
          apiVersion: param.apiVersion,
        },
        param.query as any,
      );
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

  async getColumn(
    context: NcContext,
    param: { modelId: string; columnId: string },
  ) {
    const column = await Column.get(context, { colId: param.columnId });

    if (!column) NcError.get(context).fieldNotFound(param.columnId);

    if (column.fk_model_id !== param.modelId)
      NcError.get(context).badRequest('Column not belong to model');

    if (!isLinksOrLTAR(column))
      NcError.get(context).badRequest('Column is not LTAR');
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
      user?: any;
    },
  ) {
    this.validateIds(context, param.refRowIds);

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
      user?: any;
    },
  ) {
    this.validateIds(context, param.refRowIds);

    const { model, view } = await this.getModelAndView(context, param);
    if (!model) NcError.get(context).tableNotFound(param.modelId);

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
      user?: any;
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
      NcError.get(context).badRequest(
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
      NcError.get(context).recordNotFound(operationMap.deleteAll.rowId);
    } else if (operationMap.copy && operationMap.paste) {
      const [existsCopyRow, existsPasteRow] = await Promise.all([
        baseModel.exist(operationMap.copy.rowId),
        baseModel.exist(operationMap.paste.rowId),
      ]);

      if (!existsCopyRow && !existsPasteRow) {
        NcError.get(context).recordNotFound(
          `'${operationMap.copy.rowId}' and '${operationMap.paste.rowId}'`,
        );
      } else if (!existsCopyRow) {
        NcError.get(context).recordNotFound(operationMap.copy.rowId);
      } else if (!existsPasteRow) {
        NcError.get(context).recordNotFound(operationMap.paste.rowId);
      }
    }

    const column = await this.getColumn(context, param);
    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    const { refContext } = await colOptions.getParentChildContext(context);

    const relatedModel = await colOptions.getRelatedTable(refContext);
    await relatedModel.getColumns(refContext);

    if (!colOptions.fk_mm_model_id) return;

    const { dependencyFields } = await getAst(refContext, {
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
          childIds: deleteCellNestedList.map((nestedList) =>
            dataWrapper(nestedList).extractPksValue(relatedModel),
          ),
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
        relatedModel,
      );

      const filteredRowsToUnlink = this.filterAndMapRows(
        pasteCellNestedList,
        copiedCellNestedList,
        relatedModel,
      );

      if (filteredRowsToUnlink.length) {
        await baseModel.removeLinks({
          colId: column.id,
          childIds: filteredRowsToUnlink,
          rowId: operationMap.paste.rowId,
          cookie: param.cookie,
        });
      }
      if (filteredRowsToLink.length) {
        await baseModel.addLinks({
          colId: column.id,
          childIds: filteredRowsToLink,
          rowId: operationMap.paste.rowId,
          cookie: param.cookie,
        });
      }

      return { link: filteredRowsToLink, unlink: filteredRowsToUnlink };
    }
  }

  async nestedListBulkCopyPasteOrDeleteAll(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      query: any;
      data: {
        columnId: string;
        data: {
          operation: 'copy' | 'paste' | 'deleteAll';
          rowId: string;
          columnId: string;
          fk_related_model_id: string;
        }[];
      }[];
      user?: any;
    },
  ) {
    if (!Array.isArray(param.data) || !param.data.length) {
      NcError.get(context).badRequest('Invalid bulk operation payload');
    }

    const results: { link: any[]; unlink: any[] }[] = [];

    for (const entry of param.data) {
      if (!entry.columnId || !Array.isArray(entry.data)) {
        NcError.get(context).badRequest(
          'Each bulk entry must have columnId and data array',
        );
      }

      const result = await this.nestedListCopyPasteOrDeleteAll(context, {
        ...param,
        columnId: entry.columnId,
        data: entry.data,
      });

      results.push(result ?? { link: [], unlink: [] });
    }

    return results;
  }

  async nestedBulkLinkByDisplayValue(
    context: NcContext,
    param: {
      cookie: any;
      viewId: string;
      modelId: string;
      query: any;
      data: {
        columnId: string;
        rowId: string;
        displayValues: string[];
      }[];
      user?: any;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/nestedBulkLinkByDisplayValueReq',
      param.data,
    );

    // Resolve main table once — all entries target the same parent table
    const { model, view } = await this.getModelAndView(context, param);
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });

    const groups = this.groupEntriesByColumn(param.data);

    const results: { link: any[]; unlink: any[] }[] = new Array(
      param.data.length,
    );

    for (const [columnId, entries] of groups) {
      const groupCtx = await this.resolveColumnGroupContext(
        context,
        param,
        columnId,
      );

      // No junction model — nothing to link for this column group
      if (!groupCtx) {
        for (const { index } of entries) {
          results[index] = { link: [], unlink: [] };
        }
        continue;
      }

      const valueToPk = await this.resolveDisplayValuesToPks(groupCtx, entries);

      const { dependencyFields } = await getAst(groupCtx.refContext, {
        model: groupCtx.relatedModel,
        query: param.query,
        extractOnlyPrimaries: true,
      });

      const listArgs: any = dependencyFields;
      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {}

      await this.diffAndApplyLinks(
        context,
        baseModel,
        groupCtx,
        entries,
        valueToPk,
        listArgs,
        param.cookie,
        results,
      );
    }

    return results;
  }

  /**
   * Groups bulk link entries by columnId, preserving each entry's original
   * index so results can be written back in the correct order.
   */
  private groupEntriesByColumn(
    data: { columnId: string; rowId: string; displayValues: string[] }[],
  ) {
    const groups = new Map<
      string,
      { index: number; entry: (typeof data)[number] }[]
    >();
    data.forEach((entry, index) => {
      const list = groups.get(entry.columnId);
      if (list) {
        list.push({ index, entry });
      } else {
        groups.set(entry.columnId, [{ index, entry }]);
      }
    });
    return groups;
  }

  /**
   * Resolves all shared context for a column group: validates the column is an
   * LTAR type, fetches colOptions, related model, related source, and the
   * display-value column. Returns `null` when there is no junction model
   * (nothing to link).
   */
  private async resolveColumnGroupContext(
    context: NcContext,
    param: { viewId: string; modelId: string; query: any; user?: any },
    columnId: string,
  ) {
    const column = await this.getColumn(context, {
      ...param,
      columnId,
    });

    if (!isLinksOrLTAR(column)) {
      NcError.get(context).invalidRequestBody(
        `Column '${column.title ?? columnId}' is not a link column`,
      );
    }

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    const { refContext } = await colOptions.getParentChildContext(context);
    const relatedModel = await colOptions.getRelatedTable(refContext);
    await relatedModel.getColumns(refContext);

    const displayValueColumn = relatedModel.displayValue;
    if (!displayValueColumn) {
      NcError.get(context).badRequest(
        'Related table has no display value column',
      );
    }

    const isSingleLink = [
      RelationTypes.BELONGS_TO,
      RelationTypes.ONE_TO_ONE,
      RelationTypes.MANY_TO_ONE,
    ].includes(colOptions.type as RelationTypes);

    if (!colOptions.fk_mm_model_id) {
      return null;
    }

    const relatedSource = await Source.get(refContext, relatedModel.source_id);
    const relatedBaseModel = await Model.getBaseModelSQL(refContext, {
      id: relatedModel.id,
      dbDriver: await NcConnectionMgrv2.get(relatedSource),
    });

    return {
      column,
      colOptions,
      refContext,
      relatedModel,
      relatedBaseModel,
      displayValueColumn,
      isSingleLink,
    };
  }

  /**
   * Batch-resolves display values to primary keys for the related table.
   *
   * Uses a two-step strategy shared across all entries in a column group:
   *  1. Case-sensitive exact match (`eq` operator) — one query for all values.
   *  2. Case-insensitive fallback (`like` operator) for any values the first
   *     step didn't match, with post-filter lowercase equality to avoid
   *     partial/wildcard matches.
   *
   * Returns a Map from submitted display value → matched primary key.
   */
  private async resolveDisplayValuesToPks(
    groupCtx: NonNullable<
      Awaited<ReturnType<DataTableService['resolveColumnGroupContext']>>
    >,
    entries: { index: number; entry: { displayValues: string[] } }[],
  ) {
    const { relatedModel, relatedBaseModel, displayValueColumn } = groupCtx;
    const dvTitle = displayValueColumn.title;

    const pkFieldSet = new Set(
      relatedModel.primaryKeys.map((pk) => pk.title || pk.column_name),
    );
    pkFieldSet.add(dvTitle);

    const listOpts = { fieldsSet: pkFieldSet };
    const listFlags = {
      ignoreViewFilterAndSort: true,
      ignorePagination: true,
    };

    // Collect every unique display value across all entries in this group
    const allUniqueValues = new Set<string>();
    for (const { entry } of entries) {
      for (const v of entry.displayValues) {
        allUniqueValues.add(v);
      }
    }

    const valueToPk = new Map<string, string | number>();

    // Step 1: Case-sensitive exact match (eq operator)
    if (allUniqueValues.size > 0) {
      const eqFilterArr = [...allUniqueValues].map(
        (v) =>
          new Filter({
            fk_column_id: displayValueColumn.id,
            comparison_op: 'eq',
            value: v,
            logical_op: 'or',
          }),
      );

      const exactRows = await relatedBaseModel.list(
        { ...listOpts, filterArr: eqFilterArr, apiVersion: NcApiVersion.V3 },
        listFlags,
      );

      for (const row of exactRows) {
        const dv = row[dvTitle];
        if (dv == null) continue;
        const dvStr = String(dv);
        if (allUniqueValues.has(dvStr) && !valueToPk.has(dvStr)) {
          valueToPk.set(
            dvStr,
            dataWrapper(row).extractPksValue(relatedModel, true),
          );
        }
      }
    }

    // Step 2: Case-insensitive fallback for values the eq step didn't match
    const unmatchedValues = [...allUniqueValues].filter(
      (v) => !valueToPk.has(v),
    );
    if (unmatchedValues.length > 0) {
      const likeFilterArr = unmatchedValues.map(
        (v) =>
          new Filter({
            fk_column_id: displayValueColumn.id,
            comparison_op: 'like',
            value: v,
            logical_op: 'or',
          }),
      );

      const candidateRows = await relatedBaseModel.list(
        { ...listOpts, filterArr: likeFilterArr, apiVersion: NcApiVersion.V3 },
        listFlags,
      );

      const lowerToOriginal = new Map<string, string>();
      for (const v of unmatchedValues) {
        const lower = v.toLowerCase();
        if (!lowerToOriginal.has(lower)) {
          lowerToOriginal.set(lower, v);
        }
      }

      for (const row of candidateRows) {
        const dv = row[dvTitle];
        if (dv == null) continue;
        const dvLower = String(dv).toLowerCase();
        const originalValue = lowerToOriginal.get(dvLower);
        if (originalValue && !valueToPk.has(originalValue)) {
          valueToPk.set(
            originalValue,
            dataWrapper(row).extractPksValue(relatedModel, true),
          );
        }
      }
    }

    return valueToPk;
  }

  /**
   * For each entry in a column group: verifies the parent row exists,
   * translates display values to PKs via the pre-built map, fetches existing
   * links, computes the diff (toLink / toUnlink), and applies add/remove
   * operations. Writes results back into the shared results array by index.
   */
  private async diffAndApplyLinks(
    context: NcContext,
    baseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>,
    groupCtx: NonNullable<
      Awaited<ReturnType<DataTableService['resolveColumnGroupContext']>>
    >,
    entries: {
      index: number;
      entry: { rowId: string; displayValues: string[] };
    }[],
    valueToPk: Map<string, string | number>,
    listArgs: any,
    cookie: any,
    results: { link: any[]; unlink: any[] }[],
  ) {
    const { column, relatedModel, isSingleLink } = groupCtx;

    for (const { index, entry } of entries) {
      if (!(await baseModel.exist(entry.rowId))) {
        NcError.get(context).recordNotFound(entry.rowId);
      }

      const seenPks = new Set<string>();
      const matchedPks: (string | number)[] = [];
      for (const value of new Set(entry.displayValues)) {
        const pk = valueToPk.get(value);
        if (pk === undefined || pk === null) continue;
        const pkStr = String(pk);
        if (seenPks.has(pkStr)) continue;
        seenPks.add(pkStr);
        matchedPks.push(pk);
      }

      if (!matchedPks.length) {
        results[index] = { link: [], unlink: [] };
        continue;
      }

      // For BT/OO: only take the first match
      const pksToLink = isSingleLink ? [matchedPks[0]] : matchedPks;

      const existingLinkedList = await baseModel.mmList(
        {
          colId: column.id,
          parentId: entry.rowId,
        },
        listArgs as any,
        true,
      );

      const existingPks = (existingLinkedList || []).map((row) =>
        dataWrapper(row).extractPksValue(relatedModel, true),
      );

      const existingPkSet = new Set(existingPks.map(String));
      const newPkSet = new Set(pksToLink.map(String));

      const toLink = pksToLink.filter((pk) => !existingPkSet.has(String(pk)));
      const toUnlink = existingPks.filter((pk) => !newPkSet.has(String(pk)));

      if (toUnlink.length) {
        await baseModel.removeLinks({
          colId: column.id,
          childIds: toUnlink,
          rowId: entry.rowId,
          cookie,
        });
      }

      if (toLink.length) {
        await baseModel.addLinks({
          colId: column.id,
          childIds: toLink,
          rowId: entry.rowId,
          cookie,
        });
      }

      results[index] = { link: toLink, unlink: toUnlink };
    }
  }

  validateIds(context: NcContext, rowIds: any[] | any) {
    if (Array.isArray(rowIds)) {
      const map = new Map<string, boolean>();
      const set = new Set<string>();
      for (const rowId of rowIds) {
        if (rowId === undefined || rowId === null)
          NcError.get(context).recordNotFound(rowId);
        if (map.has(rowId)) {
          set.add(rowId);
        } else {
          map.set(rowId, true);
        }
      }

      if (set.size > 0) NcError.get(context).duplicateRecord([...set]);
    } else if (rowIds === undefined || rowIds === null) {
      NcError.get(context).recordNotFound(rowIds);
    }
  }

  private filterAndMapRows(
    sourceList: Record<string, any>[],
    targetList: Record<string, any>[],
    relatedModel: Model,
  ): (string | number)[] {
    return sourceList
      .filter(
        (sourceRow: Record<string, any>) =>
          !targetList.some((targetRow: Record<string, any>) =>
            relatedModel.primaryKeys.every(
              (key) =>
                sourceRow[key.title || key.column_name] ===
                targetRow[key.title || key.column_name],
            ),
          ),
      )
      .map((item: Record<string, any>) =>
        dataWrapper(item).extractPksValue(relatedModel, true),
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
      user?: any;
    },
  ) {
    const { model, view } = await this.getModelAndView(context, param);

    let bulkFilterList = param.body;

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    if (!bulkFilterList?.length) {
      NcError.get(context).badRequest('Invalid bulkFilterList');
    }

    const results = await processConcurrently(
      bulkFilterList,
      async (dF: any) => {
        const data = await this.datasService.dataList(context, {
          query: { ...dF },
          model,
          view,
          includeRowColorColumns: dF.include_row_color === 'true',
          includeButtonFilterColumns:
            dF.include_button_filter_columns === 'true',
        });
        return { alias: dF.alias, data };
      },
      5,
    );

    return results.reduce((acc, { alias, data }) => {
      acc[alias] = data;
      return acc;
    }, {});
  }

  async bulkGroupBy(
    context: NcContext,
    param: {
      baseId?: string;
      modelId: string;
      viewId?: string;
      query: any;
      body: any;
      user?: any;
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
      NcError.get(context).badRequest('Invalid bulkFilterList');
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

  async bulkAggregate(
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

    if (view && view.type !== ViewTypes.GRID) {
      NcError.badRequest('Aggregation is only supported on grid views');
    }

    const listArgs: any = { ...param.query };

    let bulkFilterList = param.body;

    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}

    try {
      listArgs.aggregation = JSON.parse(listArgs.aggregation);
    } catch (e) {}

    try {
      bulkFilterList = JSON.parse(bulkFilterList);
    } catch (e) {}

    return await baseModel.bulkAggregate(listArgs, bulkFilterList, view);
  }

  async getLinkedDataList(
    context: NcContext,
    params: {
      req: NcRequest;
      linkColumnId: string;
    },
  ): Promise<any> {
    const { req, linkColumnId } = params;

    const relationColumn = await Column.get(context, { colId: linkColumnId });

    if (!relationColumn || !isLinksOrLTAR(relationColumn)) {
      NcError.get(context).fieldNotFound(linkColumnId);
    }

    const { refContext } = (
      relationColumn.colOptions as LinkToAnotherRecordColumn
    ).getRelContext(context);

    return this.dataList(refContext, {
      query: {
        ...req.query,
        columnId: undefined,
        linkColumnId,
        linkBaseId: context.base_id,
      },
      modelId: (relationColumn.colOptions as LinkToAnotherRecordColumn)
        .fk_related_model_id,
      viewId: (relationColumn.colOptions as LinkToAnotherRecordColumn)
        .fk_target_view_id,
      includeSortAndFilterColumns:
        req.query.includeSortAndFilterColumns === 'true',
      user: req.user,
    });
  }
}
