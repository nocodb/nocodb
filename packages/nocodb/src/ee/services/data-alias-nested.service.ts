import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import {
  type ClientType,
  NcApiVersion,
  type NcContext,
  UITypes,
} from 'nocodb-sdk';
import { DataAliasNestedService as DataAliasNestedServiceCE } from 'src/services/data-alias-nested.service';
import { QUERY_STRING_FIELD_ID_ON_RESULT } from 'src/constants';
import { listQueryEnrichment } from '../dbQueryClient/cross-db-utils/list-query-enrichment';
import { canUseOptimisedQuery } from '../utils';
import { getDataWithCountCache } from '../dbQueryClient/cross-db-utils/get-data-with-count-cache';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { XcFilter } from '~/db/sql-data-mapper/lib/BaseModel';
import type { DBQueryClient as DBQueryClientType } from '~/dbQueryClient/types';
import type { PathParams } from '~/helpers/dataHelpers';
import type { Column, LinkToAnotherRecordColumn, View } from '~/models';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { DBQueryClient } from '~/dbQueryClient';
import {
  getColumnByIdOrName,
  getViewAndModelByAliasOrId,
} from '~/helpers/dataHelpers';
import { _wherePk } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/ncError';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import { Filter, Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import conditionV2 from '~/db/conditionV2';

const debugDataAliasNested = debug('nc:db:query:DataAliasNested');

@Injectable()
export class DataAliasNestedService extends DataAliasNestedServiceCE {
  logger = new Logger(DataAliasNestedService.name);

  /**
   * Apply view filters and link-column filters on the inner qb BEFORE
   * wrapping as source_qb subquery. Formula-based conditions reference
   * the original table name which becomes inaccessible after wrapping.
   */
  private async applyInnerViewAndLinkFilters(params: {
    view?: View;
    column: Column;
    baseModel: IBaseModelSqlV2;
    context: NcContext;
    qb: any;
  }) {
    const { view, column, baseModel, context, qb } = params;
    const filters: Filter[] = [];

    if (view?.id) {
      const viewFilters = await Filter.rootFilterList(context, {
        viewId: view.id,
      });
      if (viewFilters?.length) {
        filters.push(new Filter({ children: viewFilters, is_group: true }));
      }
    }

    if (column.meta?.enableConditions) {
      const linkFilters = await Filter.rootFilterListByLink(
        { ...context, base_id: column.base_id },
        { columnId: column.id },
      );
      if (linkFilters?.length) {
        filters.push(new Filter({ children: linkFilters, is_group: true }));
      }
    }

    if (filters.length) {
      await conditionV2(baseModel, filters, qb);
    }
  }

  async whetherUseOptimizedQuery(
    context: NcContext,
    param: PathParams & { query: any; columnName: string; rowId: string },
    {
      optimizedQuery,
      unoptimizedQuery,
    }: {
      optimizedQuery: (param: {
        source: Source;
        model: Model;
        column: Column;
        dbQueryClient: DBQueryClientType;
        baseModel: IBaseModelSqlV2;
        view: View;
      }) => Promise<PagedResponseImpl<any>>;
      unoptimizedQuery: (param: {
        source: Source;
        model: Model;
        column: Column;
      }) => Promise<PagedResponseImpl<any>>;
    },
  ): Promise<PagedResponseImpl<any>> {
    const { model, view } = await getViewAndModelByAliasOrId(context, param);
    if (!model) NcError.tableNotFound(param.tableName);
    const column = await getColumnByIdOrName(context, param.columnName, model);

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    ) {
      NcError.badRequest('Column is not LTAR');
    }

    const source = await Source.get(context, model.source_id);
    if (
      await canUseOptimisedQuery(context, {
        source,
        disableOptimization: false,
      })
    ) {
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        viewId: view?.id,
        dbDriver: await NcConnectionMgrv2.get(source),
        source,
      });

      const dbQueryClient = DBQueryClient.get(source.type as any as ClientType);
      return optimizedQuery({
        source,
        model,
        column,
        dbQueryClient,
        baseModel,
        view,
      });
    } else {
      return unoptimizedQuery({
        source,
        model,
        column,
      });
    }
  }

  override async mmList(
    context: NcContext,
    param: PathParams & { query: any; columnName: string; rowId: string },
  ): Promise<PagedResponseImpl<any>> {
    const throwErrorIfInvalidParams = true;
    return this.whetherUseOptimizedQuery(context, param, {
      optimizedQuery: async ({ baseModel, source, dbQueryClient, column }) => {
        const colId = column.id;
        const listArgs: XcFilter = baseModel._getListArgs(param.query, {
          apiVersion: context.api_version,
          nested: true,
        });
        let dbQueryTime;
        const parentId = param.rowId;
        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);

        const relColOptions = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;

        const baseModelContext = baseModel.context;
        const { refContext, mmContext } =
          relColOptions.getRelContext(baseModelContext);

        // const tn = baseModel.model.tn;
        // const cn = (await relColOptions.getChildColumn()).title;
        const mmTable = await relColOptions.getMMModel(baseModelContext);
        const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
          model: mmTable,
          dbDriver: baseModel.dbDriver,
        });
        const vtn = mmBaseModel.getTnPath(mmTable);
        const vcn = (await relColOptions.getMMChildColumn(mmContext))
          .column_name;
        const vrcn = (await relColOptions.getMMParentColumn(mmContext))
          .column_name;
        const rcn = (await relColOptions.getParentColumn(refContext))
          .column_name;
        const cn = (await relColOptions.getChildColumn(baseModelContext))
          .column_name;
        const refTable = await (
          await relColOptions.getParentColumn(refContext)
        ).getModel(refContext);
        await refTable.getViews(refContext);
        await refTable.getColumns(refContext);

        const table = await (
          await relColOptions.getChildColumn(baseModelContext)
        ).getModel(baseModelContext);
        await table.getColumns(baseModelContext);
        const refBaseModel = await Model.getBaseModelSQL(refContext, {
          dbDriver: baseModel.dbDriver,
          model: refTable,
        });

        const refTn = refBaseModel.getTnPath(refTable);
        const tn = baseModel.getTnPath(table);

        const rtn = refTn;
        // const rtnId = childTable.id;

        const qb = baseModel
          .dbDriver(rtn)
          .select(`${rtn}.*`)
          .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
          .whereIn(
            `${vtn}.${vcn}`,
            baseModel
              .dbDriver(tn)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(table.primaryKeys, parentId)),
          );

        const hasLimitedAccess = !(await hasTableVisibilityAccess(
          refBaseModel.context,
          refTable.id,
          context.user,
        ));

        const useView =
          (relColumn.colOptions?.fk_target_view_id &&
            refTable.views?.find(
              (v) => v.id === relColumn.colOptions?.fk_target_view_id,
            )) ??
          refTable.views?.[0];

        await this.applyInnerViewAndLinkFilters({
          view: useView,
          column: relColumn,
          baseModel: refBaseModel,
          context: refContext,
          qb,
        });

        const enriched = await listQueryEnrichment(
          dbQueryClient,
          this.logger,
        ).enrich(refContext, {
          sourceQb: baseModel.dbDriver.from(qb.as('source_qb')),
          model: refTable,
          baseModel: refBaseModel,
          view: useView,
          params: param.query,
          source,
          apiVersion: context.api_version,
          extractOnlyPrimaries: hasLimitedAccess,
          skipCache: true,
          validateFormula: false,
          skipSortBasedOnOrderCol: true,
          listArgs,
          throwErrorIfInvalidParams,
          ignoreViewFilterAndSort: true,
        });

        const finalQb = enriched.finalQb;
        const dataQuery = finalQb.toQuery();

        debugDataAliasNested('mmList: ' + dataQuery);
        const [count, res] = await getDataWithCountCache(context, {
          query: dataQuery,
          countQuery: enriched.countQb.toQuery(),
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          knex: refBaseModel.knex,
          countCacheKey: '',
          skipCache: true,
          excludeCount: false,
          recordQueryTime: (time: string) => {
            dbQueryTime = time;
          },
          apiVersion: refBaseModel.context.api_version,
          baseModel: refBaseModel,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        });

        return new PagedResponseImpl(
          res.map(({ __nc_count, ...rest }) => rest),
          {
            // count: +res[0]?.__nc_count || 0,
            count,
            limit: +listArgs.limit,
            offset: +listArgs.offset,
          },
          {
            stats: {
              dbQueryTime: dbQueryTime,
            },
          },
        );
      },
      unoptimizedQuery: () => {
        return super.mmList(context, param);
      },
    });
  }

  override async mmExcludedList(
    context: NcContext,
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const throwErrorIfInvalidParams = true;
    return this.whetherUseOptimizedQuery(context, param, {
      optimizedQuery: async ({ baseModel, source, dbQueryClient, column }) => {
        const colId = column.id;
        const parentId = param.rowId;

        const listArgs: XcFilter = baseModel._getListArgs(param.query, {
          apiVersion: context.api_version,
          nested: true,
        });
        let dbQueryTime;

        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);
        const relColOptions = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;

        const mmTable = await relColOptions.getMMModel(baseModel.context);

        const baseModelContext = baseModel.context;
        const { refContext, mmContext } = relColOptions.getRelContext(
          baseModel.context,
        );

        const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
          id: mmTable.id,
          dbDriver: baseModel.dbDriver,
        });

        const vtn = assocBaseModel.getTnPath(mmTable);
        const vcn = (await relColOptions.getMMChildColumn(mmContext))
          .column_name;
        const vrcn = (await relColOptions.getMMParentColumn(mmContext))
          .column_name;
        const rcn = (await relColOptions.getParentColumn(refContext))
          .column_name;
        const cn = (await relColOptions.getChildColumn(baseModelContext))
          .column_name;

        const refTable = await (
          await relColOptions.getParentColumn(refContext)
        ).getModel(refContext);
        const table = await (
          await relColOptions.getChildColumn(baseModelContext)
        ).getModel(baseModel.context);
        await table.getColumns(baseModelContext);

        const refBaseModel = await Model.getBaseModelSQL(refContext, {
          dbDriver: baseModel.dbDriver,
          id: refTable.id,
        });
        const refTn = refBaseModel.getTnPath(refTable);
        const tn = baseModel.getTnPath(table);

        const useView = await relColOptions.getChildView(refContext, refTable);

        const rtn = refTn;
        const qb = refBaseModel
          .dbDriver(rtn)
          .select(`${rtn}.*`)
          .where((qb) =>
            qb
              .whereNotIn(
                rcn,
                baseModel
                  .dbDriver(rtn)
                  .select(`${rtn}.${rcn}`)
                  .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
                  .whereIn(
                    `${vtn}.${vcn}`,
                    baseModel
                      .dbDriver(tn)
                      .select(cn)
                      .where(_wherePk(table.primaryKeys, parentId)),
                  ),
              )
              .orWhereNull(rcn),
          );

        await this.applyInnerViewAndLinkFilters({
          view: useView,
          column: relColumn,
          baseModel: refBaseModel,
          context: refContext,
          qb,
        });

        const hasLimitedAccess = !(await hasTableVisibilityAccess(
          refBaseModel.context,
          refTable.id,
          context.user,
        ));

        const enriched = await listQueryEnrichment(
          dbQueryClient,
          this.logger,
        ).enrich(refBaseModel.context, {
          // we need to wrap it with alias
          // otherwise ambiguous field can happen due to join
          sourceQb: refBaseModel.dbDriver.from(qb.as('source_qb')),
          model: refTable,
          baseModel: refBaseModel,
          view: useView,
          params: param.query,
          source,
          apiVersion: context.api_version,
          extractOnlyPrimaries: hasLimitedAccess,
          skipCache: true,
          validateFormula: false,
          skipSortBasedOnOrderCol: true,
          listArgs,
          throwErrorIfInvalidParams,
          ignoreViewFilterAndSort: true,
        });

        const finalQb = enriched.finalQb;
        const dataQuery = finalQb.toQuery();

        debugDataAliasNested('mmExcludedList: ' + dataQuery);
        const [count, res] = await getDataWithCountCache(refContext, {
          query: dataQuery,
          countQuery: enriched.countQb.toQuery(),
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          knex: refBaseModel.knex,
          countCacheKey: '',
          skipCache: true,
          excludeCount: false,
          recordQueryTime: (time: string) => {
            dbQueryTime = time;
          },
          apiVersion: refBaseModel.context.api_version,
          baseModel: refBaseModel,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        });

        return new PagedResponseImpl(
          res.map(({ __nc_count, ...rest }) => rest),
          {
            // count: +res[0]?.__nc_count || 0,
            count,
            limit: +listArgs.limit,
            offset: +listArgs.offset,
          },
          {
            stats: {
              dbQueryTime: dbQueryTime,
            },
          },
        );
      },

      unoptimizedQuery: () => {
        return super.mmExcludedList(context, param);
      },
    });
  }

  override async hmList(
    context: NcContext,
    param: PathParams & { query: any; columnName: string; rowId: string },
  ): Promise<PagedResponseImpl<any>> {
    const throwErrorIfInvalidParams = true;
    return this.whetherUseOptimizedQuery(context, param, {
      optimizedQuery: async ({ baseModel, source, dbQueryClient, column }) => {
        const colId = column.id;
        const listArgs: XcFilter = baseModel._getListArgs(param.query, {
          apiVersion: context.api_version,
          nested: true,
        });
        let dbQueryTime;
        const rowId = param.rowId;
        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);

        const relationColOpts = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;

        const baseModelContext = baseModel.context;
        const { refContext } = relationColOpts.getRelContext(baseModelContext);

        const childCol = await relationColOpts.getChildColumn(
          baseModel.context,
        );

        const childTable = await childCol.getModel(refContext);

        const parentCol = await relationColOpts.getParentColumn(
          baseModel.context,
        );
        const parentTable = await parentCol.getModel(baseModel.context);
        const childBaseModel = await Model.getBaseModelSQL(refContext, {
          model: childTable,
          dbDriver: baseModel.dbDriver,
        });
        await parentTable.getColumns(baseModel.context);

        const childTn = childBaseModel.getTnPath(childTable);
        const parentTn = baseModel.getTnPath(parentTable);

        const qb = baseModel.dbDriver(childTn).select(`${childTn}.*`);

        await childTable.getViews(childBaseModel.context);

        qb.whereIn(
          childCol.column_name,
          baseModel
            .dbDriver(parentTn)
            .select(parentCol.column_name)
            // .where(parentTable.primaryKey.cn, p)
            .where(_wherePk(parentTable.primaryKeys, rowId)),
        );

        const hasLimitedAccess = !(await hasTableVisibilityAccess(
          childBaseModel.context,
          childTable.id,
          context.user,
        ));

        const useView =
          (relColumn.colOptions?.fk_target_view_id &&
            childTable.views?.find(
              (v) => v.id === relColumn.colOptions?.fk_target_view_id,
            )) ??
          childTable.views?.[0];

        await this.applyInnerViewAndLinkFilters({
          view: useView,
          column: relColumn,
          baseModel: childBaseModel,
          context: refContext,
          qb,
        });

        const enriched = await listQueryEnrichment(
          dbQueryClient,
          this.logger,
        ).enrich(refContext, {
          sourceQb: baseModel.dbDriver.from(qb.as('source_qb')),
          model: childTable,
          baseModel: childBaseModel,
          view: useView,
          params: param.query,
          source,
          apiVersion: context.api_version,
          extractOnlyPrimaries: hasLimitedAccess,
          skipSortBasedOnOrderCol: true,
          skipCache: true,
          validateFormula: false,
          listArgs,
          throwErrorIfInvalidParams,
          ignoreViewFilterAndSort: true,
        });

        const finalQb = enriched.finalQb;
        const dataQuery = finalQb.toQuery();

        debugDataAliasNested('hmList: ' + dataQuery);
        const [count, res] = await getDataWithCountCache(context, {
          query: dataQuery,
          countQuery: enriched.countQb.toQuery(),
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          knex: childBaseModel.knex,
          countCacheKey: '',
          skipCache: true,
          excludeCount: false,
          recordQueryTime: (time: string) => {
            dbQueryTime = time;
          },
          apiVersion: childBaseModel.context.api_version,
          baseModel: childBaseModel,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        });

        return new PagedResponseImpl(
          res.map(({ __nc_count, ...rest }) => rest),
          {
            // count: +res[0]?.__nc_count || 0,
            count,
            limit: +listArgs.limit,
            offset: +listArgs.offset,
          },
          {
            stats: {
              dbQueryTime: dbQueryTime,
            },
          },
        );
      },
      unoptimizedQuery: () => {
        return super.hmList(context, param);
      },
    });
  }

  override async hmExcludedList(
    context: NcContext,
    param: PathParams & {
      query: any;
      columnName: string;
      rowId: string;
    },
  ) {
    const throwErrorIfInvalidParams = true;
    return this.whetherUseOptimizedQuery(context, param, {
      optimizedQuery: async ({ baseModel, source, dbQueryClient, column }) => {
        const colId = column.id;
        const rowId = param.rowId;

        const listArgs: XcFilter = baseModel._getListArgs(param.query, {
          apiVersion: context.api_version,
          nested: true,
        });
        let dbQueryTime;

        const relColumn = (
          await baseModel.model.getColumns(baseModel.context)
        ).find((c) => c.id === colId);
        const relColOptions = (await relColumn.getColOptions(
          baseModel.context,
        )) as LinkToAnotherRecordColumn;

        const baseModelContext = baseModel.context;
        const { refContext } = relColOptions.getRelContext(baseModel.context);

        const cn = (await relColOptions.getChildColumn(refContext)).column_name;
        const rcn = (await relColOptions.getParentColumn(baseModelContext))
          .column_name;
        const refTable = await (
          await relColOptions.getChildColumn(refContext)
        ).getModel(refContext);
        const table = await (
          await relColOptions.getParentColumn(baseModelContext)
        ).getModel(baseModelContext);
        const refBaseModel = await Model.getBaseModelSQL(refContext, {
          dbDriver: baseModel.dbDriver,
          model: refTable,
        });
        await table.getColumns(baseModelContext);

        const useView = await relColOptions.getChildView(
          refBaseModel.context,
          refTable,
        );

        const childTn = refBaseModel.getTnPath(refTable);
        const parentTn = baseModel.getTnPath(table);

        const tn = childTn;
        const rtn = parentTn;

        const qb = refBaseModel
          .dbDriver(tn)
          .select(`${tn}.*`)
          .where((qb) => {
            qb.whereNotIn(
              cn,
              baseModel
                .dbDriver(rtn)
                .select(rcn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(table.primaryKeys, rowId)),
            ).orWhereNull(cn);
          });

        await this.applyInnerViewAndLinkFilters({
          view: useView,
          column: relColumn,
          baseModel: refBaseModel,
          context: refContext,
          qb,
        });

        const hasLimitedAccess = !(await hasTableVisibilityAccess(
          refBaseModel.context,
          refTable.id,
          context.user,
        ));

        const enriched = await listQueryEnrichment(
          dbQueryClient,
          this.logger,
        ).enrich(refBaseModel.context, {
          // we need to wrap it with alias
          // otherwise ambiguous field can happen due to join
          sourceQb: refBaseModel.dbDriver.from(qb.as('source_qb')),
          model: refTable,
          baseModel: refBaseModel,
          view: useView,
          params: param.query,
          source,
          apiVersion: context.api_version,
          extractOnlyPrimaries: hasLimitedAccess,
          skipCache: true,
          validateFormula: false,
          skipSortBasedOnOrderCol: true,
          listArgs,
          throwErrorIfInvalidParams,
          ignoreViewFilterAndSort: true,
        });

        const finalQb = enriched.finalQb;
        const dataQuery = finalQb.toQuery();

        debugDataAliasNested('hmExcludedList: ' + dataQuery);

        const [count, res] = await getDataWithCountCache(refContext, {
          query: dataQuery,
          countQuery: enriched.countQb.toQuery(),
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          knex: refBaseModel.knex,
          countCacheKey: '',
          skipCache: true,
          excludeCount: false,
          recordQueryTime: (time: string) => {
            dbQueryTime = time;
          },
          apiVersion: refBaseModel.context.api_version,
          baseModel: refBaseModel,
          skipSubstitutingColumnIds:
            context.api_version === NcApiVersion.V3 &&
            param.query?.[QUERY_STRING_FIELD_ID_ON_RESULT] === 'true',
        });

        return new PagedResponseImpl(
          res.map(({ __nc_count, ...rest }) => rest),
          {
            // count: +res[0]?.__nc_count || 0,
            count,
            limit: +listArgs.limit,
            offset: +listArgs.offset,
          },
          {
            stats: {
              dbQueryTime: dbQueryTime,
            },
          },
        );
      },

      unoptimizedQuery: () => {
        return super.hmExcludedList(context, param);
      },
    });
  }
}
