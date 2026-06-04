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
import { DBQueryClient } from '~/dbQueryClient';
import { NcContext } from '~/interface/config';
import { validateV1V2DataPayloadLimit } from '~/helpers/dataHelpers';
import { Column, Filter, Model, Source, View } from '~/models';
import { nocoExecute, processConcurrently } from '~/utils';
import { DatasService } from '~/services/datas.service';
import { TraceCommand } from '~/decorators/trace-command.decorator';
import { OperationName } from '~/command-registry/op-names';
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
      getHiddenColumns?: boolean;
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
      getHiddenColumns: param?.getHiddenColumns,
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

    return await DBQueryClient.get(source.type).aggregate(context, {
      model,
      view,
      source,
      args: listArgs,
    });
  }

  @TraceCommand((_ctx, p) =>
    Array.isArray(p?.body)
      ? OperationName.recordBulkInsert
      : OperationName.recordInsert,
  )
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
      req?: NcRequest;
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

  @TraceCommand(OperationName.recordMove)
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

  @TraceCommand((_ctx, p) =>
    Array.isArray(p?.body) && (p.body as any[]).length > 1
      ? OperationName.recordBulkUpdate
      : OperationName.recordUpdate,
  )
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

  @TraceCommand((_ctx, p) =>
    Array.isArray(p?.body) && (p.body as any[]).length > 1
      ? OperationName.recordBulkDelete
      : OperationName.recordDelete,
  )
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
      internalFlags?: {
        allowSystemColumn?: boolean;
      };
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
        allowSystemColumn: param.internalFlags?.allowSystemColumn,
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
      fk_display_value_column_id: (colOptions as any)
        .fk_display_value_column_id,
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
    let data: Record<string, any>[] | Record<string, any>;
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

    return new PagedResponseImpl(data as Record<string, any>[], {
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

  @TraceCommand(OperationName.recordLinkAdd)
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

  @TraceCommand(OperationName.recordLinkRemove)
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
    const { swapEntry, feResponse } =
      await this.computeListCopyPasteOrDeleteAllDiff(context, param);

    if (swapEntry) {
      await this._traceApplyLinkSwap(context, {
        modelId: param.modelId,
        viewId: param.viewId,
        columnId: swapEntry.columnId,
        rowId: swapEntry.rowId,
        link: swapEntry.link,
        unlink: swapEntry.unlink,
        cookie: param.cookie,
      });
    }
    return feResponse;
  }

  /** Resolves the link/unlink diff for a single LTAR copy/paste/deleteAll
   *  request without applying it. Used directly by the bulk path so a
   *  multi-column paste records as a single `recordLinkSwapBulk` op
   *  instead of one `recordLinkSwap` per column. */
  private async computeListCopyPasteOrDeleteAllDiff(
    context: NcContext,
    param: {
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
  ): Promise<{
    swapEntry: {
      columnId: string;
      rowId: string;
      link: Array<string | number>;
      unlink: Array<string | number>;
    } | null;
    feResponse: { link: any[]; unlink: any[] } | undefined;
  }> {
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

    if (!colOptions.fk_mm_model_id) {
      return { swapEntry: null, feResponse: undefined };
    }

    const { dependencyFields } = await getAst(refContext, {
      model: relatedModel,
      query: param.query,
      extractOnlyPrimaries: !(param.query?.f || param.query?.fields),
      fk_display_value_column_id: (colOptions as any)
        .fk_display_value_column_id,
    });

    const listArgs: any = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    if (operationMap.deleteAll) {
      const deleteCellNestedList = await baseModel.mmList(
        {
          colId: column.id,
          parentId: operationMap.deleteAll.rowId,
        },
        listArgs as any,
        true,
      );

      if (
        !Array.isArray(deleteCellNestedList) ||
        !deleteCellNestedList.length
      ) {
        return { swapEntry: null, feResponse: { link: [], unlink: [] } };
      }

      const childPks = deleteCellNestedList
        .map(
          (nestedList) =>
            dataWrapper(nestedList).extractPksValue(relatedModel) as
              | string
              | number
              | null,
        )
        .filter((v): v is string | number => v != null);

      const unlinkRowsForReturn = deleteCellNestedList.map((nestedList) =>
        relatedModel.primaryKeys.reduce((acc, col) => {
          acc[col.title || col.column_name] =
            nestedList[col.title || col.column_name];
          return acc;
        }, {} as Record<string, any>),
      );

      return {
        swapEntry: childPks.length
          ? {
              columnId: column.id,
              rowId: operationMap.deleteAll.rowId,
              link: [],
              unlink: childPks,
            }
          : null,
        feResponse: { link: [], unlink: unlinkRowsForReturn },
      };
    }

    if (operationMap.copy && operationMap.paste) {
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

      const link = this.filterAndMapRows(
        copiedCellNestedList,
        pasteCellNestedList,
        relatedModel,
      ) as Array<string | number>;
      const unlink = this.filterAndMapRows(
        pasteCellNestedList,
        copiedCellNestedList,
        relatedModel,
      ) as Array<string | number>;

      return {
        swapEntry:
          link.length || unlink.length
            ? {
                columnId: column.id,
                rowId: operationMap.paste.rowId,
                link,
                unlink,
              }
            : null,
        feResponse: { link, unlink },
      };
    }

    return { swapEntry: null, feResponse: { link: [], unlink: [] } };
  }

  /** Decorated internal substrate for `recordLinkSwap`. Receives a
   *  resolved `(rowId, columnId)` link diff (link[] = pks to add,
   *  unlink[] = pks to remove) and applies it via `removeLinks` then
   *  `addLinks`. Self-inverse — undo dispatches the same op with the
   *  link/unlink lists swapped. Higher-level user-facing methods
   *  (`nestedListCopyPasteOrDeleteAll` etc.) compute the diff first
   *  then funnel through here so the recorded op carries the resolved
   *  pks (replay can't drift). */
  @TraceCommand(OperationName.recordLinkSwap)
  async _traceApplyLinkSwap(
    context: NcContext,
    param: {
      modelId: string;
      baseId?: string;
      viewId?: string;
      columnId: string;
      rowId: string | number;
      link: Array<string | number>;
      unlink: Array<string | number>;
      cookie: any;
    },
  ): Promise<{ link: Array<string | number>; unlink: Array<string | number> }> {
    if (!param.link.length && !param.unlink.length) {
      return { link: [], unlink: [] };
    }
    const { model, view } = await this.getModelAndView(context, param);
    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
    });
    if (param.unlink.length) {
      await baseModel.removeLinks({
        colId: param.columnId,
        childIds: param.unlink,
        rowId: String(param.rowId),
        cookie: param.cookie,
      });
    }
    if (param.link.length) {
      await baseModel.addLinks({
        colId: param.columnId,
        childIds: param.link,
        rowId: String(param.rowId),
        cookie: param.cookie,
      });
    }
    return { link: param.link, unlink: param.unlink };
  }

  /** Decorated bulk variant for `recordLinkSwapBulk` — applies multiple
   *  per-(rowId, columnId) diffs in a single recorded op. */
  @TraceCommand(OperationName.recordLinkSwapBulk)
  async _traceApplyLinkSwapBulk(
    context: NcContext,
    param: {
      modelId: string;
      baseId?: string;
      viewId?: string;
      entries: Array<{
        columnId: string;
        rowId: string | number;
        link: Array<string | number>;
        unlink: Array<string | number>;
      }>;
      cookie: any;
    },
  ): Promise<
    Array<{ link: Array<string | number>; unlink: Array<string | number> }>
  > {
    const out: Array<{
      link: Array<string | number>;
      unlink: Array<string | number>;
    }> = [];
    // Inner per-entry calls auto-skip recording via ALS re-entrancy —
    // only this outer bulk op records.
    for (const entry of param.entries) {
      const r = await this._traceApplyLinkSwap(context, {
        modelId: param.modelId,
        baseId: param.baseId,
        viewId: param.viewId,
        columnId: entry.columnId,
        rowId: entry.rowId,
        link: entry.link,
        unlink: entry.unlink,
        cookie: param.cookie,
      });
      out.push(r);
    }
    return out;
  }

  /** Decorated bulk-link-by-display-value substrate. Same shape as
   *  `_traceApplyLinkSwapBulk` (entries[] of resolved pk diffs) — kept
   *  as a separate op so audit/UI can distinguish the two flows. */
  @TraceCommand(OperationName.recordLinkByDisplay)
  async _traceApplyLinkByDisplay(
    context: NcContext,
    param: {
      modelId: string;
      baseId?: string;
      viewId?: string;
      entries: Array<{
        columnId: string;
        rowId: string | number;
        link: Array<string | number>;
        unlink: Array<string | number>;
      }>;
      cookie: any;
    },
  ): Promise<
    Array<{ link: Array<string | number>; unlink: Array<string | number> }>
  > {
    return await this._traceApplyLinkSwapBulk(context, param);
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
    const swapEntries: Array<{
      columnId: string;
      rowId: string | number;
      link: Array<string | number>;
      unlink: Array<string | number>;
    }> = [];

    for (const entry of param.data) {
      if (!entry.columnId || !Array.isArray(entry.data)) {
        NcError.get(context).badRequest(
          'Each bulk entry must have columnId and data array',
        );
      }

      const { swapEntry, feResponse } =
        await this.computeListCopyPasteOrDeleteAllDiff(context, {
          ...param,
          columnId: entry.columnId,
          data: entry.data,
        });

      if (swapEntry) swapEntries.push(swapEntry);
      results.push(feResponse ?? { link: [], unlink: [] });
    }

    if (swapEntries.length) {
      await this._traceApplyLinkSwapBulk(context, {
        modelId: param.modelId,
        viewId: param.viewId,
        entries: swapEntries,
        cookie: param.cookie,
      });
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

    // Accumulate per-entry resolved diffs across all column groups, then
    // funnel through `_traceApplyLinkByDisplay` ONCE so the whole bulk
    // op records as a single `recordLinkByDisplay` log entry. Inverse
    // is mechanical link↔unlink swap per entry.
    const linkSwapEntries: Array<{
      columnId: string;
      rowId: string | number;
      link: Array<string | number>;
      unlink: Array<string | number>;
    }> = [];

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
        fk_display_value_column_id: (groupCtx.colOptions as any)
          .fk_display_value_column_id,
      });

      const listArgs: any = dependencyFields;
      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {}

      await this.collectLinkDiffsForGroup(
        context,
        baseModel,
        groupCtx,
        entries,
        valueToPk,
        listArgs,
        results,
        linkSwapEntries,
      );
    }

    if (linkSwapEntries.length) {
      await this._traceApplyLinkByDisplay(context, {
        modelId: param.modelId,
        viewId: param.viewId,
        entries: linkSwapEntries,
        cookie: param.cookie,
      });
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

    // Prefer the LTAR's custom display value column when set — that's what
    // the user sees in the cell chip / dropdown and would be copying. Fall
    // back to the related table's PV when no override is configured or the
    // override points to a stale / missing column.
    const customDisplayColId = (colOptions as any).fk_display_value_column_id;
    const customDisplayCol =
      customDisplayColId &&
      relatedModel.columns?.find((c) => c.id === customDisplayColId);
    const displayValueColumn = customDisplayCol ?? relatedModel.displayValue;
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

  /** For each entry in the column group: verifies the parent row exists,
   *  resolves display values to PKs via the pre-built map, computes the
   *  link/unlink diff against existing links, and writes the result into
   *  `results[index]`. Diffs are pushed onto `linkSwapEntries` so the
   *  caller can dispatch the whole bulk op as a single
   *  `recordLinkByDisplay` log entry — this function does NOT call
   *  `addLinks`/`removeLinks`. */
  private async collectLinkDiffsForGroup(
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
    results: { link: any[]; unlink: any[] }[],
    linkSwapEntries: Array<{
      columnId: string;
      rowId: string | number;
      link: Array<string | number>;
      unlink: Array<string | number>;
    }>,
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

      results[index] = { link: toLink, unlink: toUnlink };

      if (toLink.length || toUnlink.length) {
        linkSwapEntries.push({
          columnId: column.id,
          rowId: entry.rowId,
          link: toLink,
          unlink: toUnlink,
        });
      }
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

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view?.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });

    const results = await processConcurrently(
      bulkFilterList,
      async (dF: any) => {
        const data = await this.datasService.dataList(context, {
          query: { ...dF },
          model,
          view,
          baseModel,
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

    return await DBQueryClient.get(source.type).bulkAggregate(context, {
      model,
      view,
      source,
      args: listArgs,
      bulkFilterList,
    });
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
