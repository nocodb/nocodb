import { Logger } from '@nestjs/common';
import autoBind from 'auto-bind';
import BigNumber from 'bignumber.js';
import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc.js';
import equal from 'fast-deep-equal';
import groupBy from 'lodash/groupBy';
import {
  AuditOperationSubTypes,
  AuditV1OperationTypes,
  convertDurationToSeconds,
  enumColors,
  extractFilterFromXwhere,
  isAIPromptCol,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  isVirtualCol,
  LongTextAiMetaProp,
  NcApiVersion,
  NcErrorType,
  ncIsArray,
  ncIsNull,
  ncIsObject,
  ncIsUndefined,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import { addOrRemoveLinks } from './BaseModelSqlv2/add-remove-links';
import { baseModelInsert } from './BaseModelSqlv2/insert';
import { NestedLinkPreparator } from './BaseModelSqlv2/nested-link-preparator';
import { relationDataFetcher } from './BaseModelSqlv2/relation-data-fetcher';
import { selectObject } from './BaseModelSqlv2/select-object';
import type { Knex } from 'knex';
import type {
  BulkAuditV1OperationTypes,
  DataBulkDeletePayload,
  DataBulkUpdateAllPayload,
  DataBulkUpdatePayload,
  DataDeletePayload,
  DataInsertPayload,
  DataLinkPayload,
  DataUnlinkPayload,
  DataUpdatePayload,
  FilterType,
  NcRequest,
  UpdatePayload,
} from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  XcFilter,
  XcFilterWithAlias,
} from '~/db/sql-data-mapper/lib/BaseModel';
import type { NcContext } from '~/interface/config';
import type {
  FormulaColumn,
  LinkToAnotherRecordColumn,
  SelectOption,
  User,
} from '~/models';
import type LookupColumn from '~/models/LookupColumn';
import type { ResolverObj } from '~/utils';
import applyAggregation from '~/db/aggregation';
import { groupBy as baseModelGroupBy } from '~/db/BaseModelSqlv2/group-by';
import conditionV2 from '~/db/conditionV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { RelationManager } from '~/db/relation-manager';
import sortV2 from '~/db/sortV2';
import { customValidators } from '~/db/util/customValidators';
import { NcError, OptionsNotExistsError } from '~/helpers/catchError';
import {
  _wherePk,
  applyPaginate,
  extractSortsObject,
  formatDataForAudit,
  getCompositePkValue,
  getListArgs,
  haveFormulaColumn,
  isDataAuditEnabled as isDataAuditEnabledFn,
  isPrimitiveType,
  nanoidv2,
  populatePk,
  transformObject,
  validateFuncOnColumn,
} from '~/helpers/dbHelpers';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import { extractProps } from '~/helpers/extractProps';
import getAst from '~/helpers/getAst';
import { sanitize, unsanitize } from '~/helpers/sqlSanitize';
import {
  Audit,
  BaseUser,
  Column,
  FileReference,
  Filter,
  GridViewColumn,
  Model,
  PresignedUrl,
  Sort,
  Source,
  View,
} from '~/models';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import {
  batchUpdate,
  extractColsMetaForAudit,
  extractExcludedColumnNames,
  generateAuditV1Payload,
  nocoExecute,
  populateUpdatePayloadDiff,
  remapWithAlias,
  removeBlankPropsAndMask,
} from '~/utils';
import { MetaTable } from '~/utils/globals';
import { chunkArray } from '~/utils/tsUtils';

dayjs.extend(utc);

dayjs.extend(timezone);

const logger = new Logger('BaseModelSqlv2');

const JSON_COLUMN_TYPES = [UITypes.Button];

const ORDER_STEP_INCREMENT = 1;

const MAX_RECURSION_DEPTH = 2;

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 implements IBaseModelSqlV2 {
  protected _dbDriver: XKnex;
  protected _viewId: string;
  public get viewId() {
    return this._viewId;
  }
  protected _proto: any;
  protected _columns = {};
  protected source: Source;
  public model: Model;
  public context: NcContext;
  public schema?: string;

  public static config: any = defaultLimitConfig;

  public get dbDriver() {
    return this._dbDriver;
  }

  constructor({
    dbDriver,
    model,
    viewId,
    context,
    schema,
  }: {
    [key: string]: any;
    model: Model;
    schema?: string;
  }) {
    this._dbDriver = dbDriver;
    this.model = model;
    this._viewId = viewId;
    this.context = context;
    this.schema = schema;
    autoBind(this);
  }

  public async readByPk(
    id?: any,
    validateFormula = false,
    query: any = {},
    {
      ignoreView = false,
      getHiddenColumn = false,
      throwErrorIfInvalidParams = false,
      extractOnlyPrimaries = false,
      apiVersion,
      extractOrderColumn = false,
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
      apiVersion?: NcApiVersion;
      extractOrderColumn?: boolean;
    } = {},
  ): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    const { ast, dependencyFields, parsedQuery } = await getAst(this.context, {
      query,
      model: this.model,
      view: ignoreView
        ? null
        : this.viewId && (await View.get(this.context, this.viewId)),
      getHiddenColumn,
      throwErrorIfInvalidParams,
      extractOnlyPrimaries,
      extractOrderColumn,
      apiVersion,
    });

    await this.selectObject({
      ...(dependencyFields ?? {}),
      qb,
      validateFormula,
    });

    qb.where(_wherePk(this.model.primaryKeys, id));
    let data;

    try {
      data = await this.execAndParse(qb, null, {
        first: true,
        apiVersion,
      });
    } catch (e) {
      if (
        validateFormula ||
        !haveFormulaColumn(await this.model.getColumns(this.context))
      )
        throw e;
      logger.log(e);
      return this.readByPk(id, true, query, {
        apiVersion,
      });
    }

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }

    return data
      ? await nocoExecute(ast, data as ResolverObj, {}, parsedQuery)
      : null;
  }

  public async readByPkFromModel(
    model = this.model,
    viewId?: string,
    extractDisplayValueData?: boolean,
    ...rest: Parameters<BaseModelSqlv2['readByPk']>
  ): Promise<any> {
    let data;
    if (this.model.id === model.id) {
      data = await this.readByPk(...rest);
    } else {
      const baseModel = await Model.getBaseModelSQL(this.context, {
        model,
        viewId: viewId,
        dbDriver: this.dbDriver,
      });

      data = await baseModel.readByPk(...rest);
    }

    // load columns if not loaded already
    await model.getCachedColumns(this.context);

    if (extractDisplayValueData) {
      return data ? data[model.displayValue.title] ?? null : '';
    }

    return data;
  }

  public async readOnlyPrimariesByPkFromModel(
    props: { model: Model; id: any; extractDisplayValueData?: boolean }[],
  ): Promise<any[]> {
    return await Promise.all(
      props.map(({ model, id, extractDisplayValueData = true }) =>
        this.readByPkFromModel(
          model,
          undefined,
          extractDisplayValueData,
          id,
          false,
          {},
          {
            ignoreView: true,
            getHiddenColumn: true,
            extractOnlyPrimaries: true,
          },
        ),
      ),
    );
  }

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    await this.model.getColumns(this.context);
    const pks = this.model.primaryKeys;

    if (!pks.length) return false;

    qb.select(pks[0].column_name);

    if ((id + '').split('___').length != pks?.length) {
      return false;
    }
    qb.where(_wherePk(pks, id)).first();
    return !!(await this.execAndParse(qb, null, { raw: true, first: true }));
  }

  // todo: add support for sortArrJson
  public async findOne(
    args: {
      where?: string;
      filterArr?: Filter[];
      sort?: string | string[];
    } = {},
    validateFormula = false,
  ): Promise<any> {
    const columns = await this.model.getColumns(this.context);
    const { where, ...rest } = this._getListArgs(args as any);
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ ...args, qb, validateFormula, columns });

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const sorts = extractSortsObject(this.context, rest?.sort, aliasColObjMap);
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
    );

    await conditionV2(
      this,
      [
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );

    const orderColumn = columns.find((c) => isOrderCol(c));

    if (Array.isArray(sorts) && sorts?.length) {
      await sortV2(this, sorts, qb);
    } else if (orderColumn) {
      qb.orderBy(orderColumn.column_name);
    } else if (this.model.primaryKey) {
      // sort by primary key if not autogenerated string
      // if autogenerated string sort by created_at column if present
      qb.orderBy(this.model.primaryKey.column_name);
    }

    let data;

    try {
      data = await this.execAndParse(qb, null, { first: true });
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(columns)) throw e;
      logger.log(e);
      return this.findOne(args, true);
    }

    if (data) {
      data.__proto__ = await this.getProto();
    }
    return data;
  }

  public async list(
    args: {
      where?: string;
      limit?;
      offset?;
      filterArr?: Filter[];
      sortArr?: Sort[];
      sort?: string | string[];
      fieldsSet?: Set<string>;
      limitOverride?: number;
      pks?: string;
      customConditions?: Filter[];
      apiVersion?: NcApiVersion;
    } = {},
    options: {
      ignoreViewFilterAndSort?: boolean;
      ignorePagination?: boolean;
      validateFormula?: boolean;
      throwErrorIfInvalidParams?: boolean;
      limitOverride?: number;
    } = {},
  ): Promise<any> {
    const {
      ignoreViewFilterAndSort = false,
      ignorePagination = false,
      validateFormula = false,
      throwErrorIfInvalidParams = false,
      limitOverride,
    } = options;

    const columns = await this.model.getColumns(this.context);

    const { where, fields, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);

    await this.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
      viewId: this.viewId,
      validateFormula,
      columns,
    });
    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    let sorts = extractSortsObject(
      this.context,
      rest?.sort,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );
    // todo: replace with view id
    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts)
        sorts = args.sortArr?.length
          ? args.sortArr
          : await Sort.list(this.context, { viewId: this.viewId });

      await sortV2(this, sorts, qb, undefined, throwErrorIfInvalidParams);
    } else {
      await conditionV2(
        this,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );

      if (!sorts) sorts = args.sortArr;

      await sortV2(this, sorts, qb, undefined, throwErrorIfInvalidParams);
    }

    const orderColumn = columns.find((c) => isOrderCol(c));
    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present

    if (orderColumn) {
      qb.orderBy(orderColumn.column_name);
    } else if (this.model.primaryKey && this.model.primaryKey.ai) {
      qb.orderBy(this.model.primaryKey.column_name);
    } else {
      const createdCol = this.model.columns.find(
        (c) => c.uidt === UITypes.CreatedTime && c.system,
      );
      if (createdCol) qb.orderBy(createdCol.column_name);
    }

    if (rest.pks) {
      const pks = rest.pks.split(',');
      qb.where((qb) => {
        pks.forEach((pk) => {
          qb.orWhere(_wherePk(this.model.primaryKeys, pk));
        });
        return qb;
      });
    }

    // if limitOverride is provided, use it as limit for the query (for internal usage eg. calendar, export)
    if (!ignorePagination) {
      if (!limitOverride) {
        applyPaginate(qb, rest);
      } else {
        applyPaginate(qb, { ...rest, limit: limitOverride });
      }
    }
    const proto = await this.getProto();

    let data;
    try {
      data = await this.execAndParse(qb, undefined, {
        apiVersion: args.apiVersion,
      });
    } catch (e) {
      if (validateFormula || !haveFormulaColumn(columns)) throw e;
      logger.log(e);
      return this.list(args, {
        ignoreViewFilterAndSort,
        ignorePagination,
        validateFormula: true,
      });
    }

    return data?.map((d) => {
      d.__proto__ = proto;
      return d;
    });
  }

  public async count(
    args: {
      where?: string;
      limit?;
      filterArr?: Filter[];
      customConditions?: Filter[];
    } = {},
    ignoreViewFilterAndSort = false,
    throwErrorIfInvalidParams = false,
  ): Promise<any> {
    const columns = await this.model.getColumns(this.context);
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );

    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );
    } else {
      await conditionV2(
        this,
        [
          ...(args.customConditions
            ? [
                new Filter({
                  children: args.customConditions,
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.filterArr || []),
        ],
        qb,
        undefined,
        throwErrorIfInvalidParams,
      );
    }

    qb.count(sanitize(this.model.primaryKey?.column_name) || '*', {
      as: 'count',
    }).first();

    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  async groupByAndAggregate(
    aggregateColumnName: string,
    aggregateFn: string,
    args: {
      where?: string;
      limit?;
      offset?;
      sortBy?: {
        column_name: string;
        direction: 'asc' | 'desc';
      };
      groupByColumnName?: string;
      widgetFilterArr?: Filter[];
    },
  ) {
    const columns = await this.model.getColumns(this.context);

    const { where, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);
    const aggregateStatement = `${aggregateColumnName} as ${aggregateFn}__${aggregateColumnName}`;

    if (typeof qb[aggregateFn] === 'function') {
      qb[aggregateFn](aggregateStatement);
    } else {
      throw new Error(`Unsupported aggregate function: ${aggregateFn}`);
    }

    qb.select(args.groupByColumnName);

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );

    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      where,
      aliasColObjMap,
    );
    await conditionV2(
      this,
      [
        new Filter({
          children: args.widgetFilterArr || [],
          is_group: true,
          logical_op: 'and',
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );
    if (args?.groupByColumnName) {
      qb.groupBy(args?.groupByColumnName);
    }
    if (args?.sortBy?.column_name) {
      qb.orderBy(args.sortBy.column_name, args.sortBy.direction);
    }
    applyPaginate(qb, rest);
    return await this.execAndParse(qb);
  }

  async bulkGroupByCount(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      sort: string;
      column_name: string;
      filterArr?: Filter[];
    }[],
    _view: View,
  ) {
    return await baseModelGroupBy(this, logger).bulkCount(
      args,
      bulkFilterList,
      _view,
    );
  }

  async bulkGroupBy(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: {
      alias: string;
      where?: string;
      column_name: string;
      limit?;
      offset?;
      sort?: string;
      filterArr?: Filter[];
      sortArr?: Sort[];
    }[],
    _view: View,
  ) {
    return await baseModelGroupBy(this, logger).bulkList(
      args,
      bulkFilterList,
      _view,
    );
  }

  async bulkAggregate(
    args: {
      filterArr?: Filter[];
    },
    bulkFilterList: Array<{
      alias: string;
      where?: string;
      filterArrJson?: string | Filter[];
    }>,
    view: View,
  ) {
    try {
      if (!bulkFilterList?.length) {
        return {};
      }

      const { where, aggregation } = this._getListArgs(args as any);

      const columns = await this.model.getColumns(this.context);

      let viewColumns = (
        await GridViewColumn.list(this.context, this.viewId)
      ).filter((c) => {
        const col = this.model.columnsById[c.fk_column_id];
        return c.show && (view.show_system_fields || !isSystemColumn(col));
      });

      // By default, the aggregation is done based on the columns configured in the view
      // If the aggregation parameter is provided, only the columns mentioned in the aggregation parameter are considered
      // Also the aggregation type from the parameter is given preference over the aggregation type configured in the view
      if (aggregation?.length) {
        viewColumns = viewColumns
          .map((c) => {
            const agg = aggregation.find((a) => a.field === c.fk_column_id);
            return new GridViewColumn({
              ...c,
              show: !!agg,
              aggregation: agg ? agg.type : c.aggregation,
            });
          })
          .filter((c) => c.show);
      }

      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );

      const qb = this.dbDriver(this.tnPath);

      const aggregateExpressions = {};

      // Construct aggregate expressions for each view column
      for (const viewColumn of viewColumns) {
        const col = this.model.columnsById[viewColumn.fk_column_id];
        if (
          !col ||
          !viewColumn.aggregation ||
          (isLinksOrLTAR(col) && col.system)
        )
          continue;

        const aliasFieldName = col.id;
        const aggSql = await applyAggregation({
          baseModelSqlv2: this,
          aggregation: viewColumn.aggregation,
          column: col,
        });

        if (aggSql) {
          aggregateExpressions[aliasFieldName] = aggSql;
        }
      }

      if (!Object.keys(aggregateExpressions).length) {
        return {};
      }

      const viewFilterList = await Filter.rootFilterList(this.context, {
        viewId: this.viewId,
      });

      const selectors = [] as Array<Knex.Raw>;
      // Generate a knex raw query for each filter in the bulkFilterList
      for (const f of bulkFilterList) {
        const tQb = this.dbDriver(this.tnPath);
        const { filters: aggFilter } = extractFilterFromXwhere(
          this.context,
          f.where,
          aliasColObjMap,
        );
        let aggFilterJson = f.filterArrJson;
        try {
          aggFilterJson = JSON.parse(aggFilterJson as any);
        } catch (_e) {}

        await conditionV2(
          this,
          [
            ...(this.viewId
              ? [
                  new Filter({
                    children: viewFilterList || [],
                    is_group: true,
                  }),
                ]
              : []),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(
                this.context,
                where,
                aliasColObjMap,
              ).filters,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: aggFilter,
              is_group: true,
              logical_op: 'and',
            }),
            ...(aggFilterJson
              ? [
                  new Filter({
                    children: aggFilterJson as Filter[],
                    is_group: true,
                  }),
                ]
              : []),
          ],
          tQb,
        );

        let jsonBuildObject;

        switch (this.dbDriver.client.config.client) {
          case 'pg': {
            jsonBuildObject = this.dbDriver.raw(
              `JSON_BUILD_OBJECT(${Object.keys(aggregateExpressions)
                .map((key) => {
                  return `'${key}', ${aggregateExpressions[key]}`;
                })
                .join(', ')})`,
            );

            break;
          }
          case 'mysql2': {
            jsonBuildObject = this.dbDriver.raw(`JSON_OBJECT(
              ${Object.keys(aggregateExpressions)
                .map((key) => `'${key}', ${aggregateExpressions[key]}`)
                .join(', ')})`);
            break;
          }

          case 'sqlite3': {
            jsonBuildObject = this.dbDriver.raw(`json_object(
                ${Object.keys(aggregateExpressions)
                  .map((key) => `'${key}', ${aggregateExpressions[key]}`)
                  .join(', ')})`);
            break;
          }
          default:
            NcError.notImplemented(
              'This database is not supported for bulk aggregation',
            );
        }

        tQb.select(jsonBuildObject);

        if (this.dbDriver.client.config.client === 'mysql2') {
          selectors.push(
            this.dbDriver.raw('JSON_UNQUOTE(??) as ??', [
              jsonBuildObject,
              `${f.alias}`,
            ]),
          );
        } else {
          selectors.push(this.dbDriver.raw('(??) as ??', [tQb, `${f.alias}`]));
        }
      }

      qb.select(...selectors);

      qb.limit(1);

      return await this.execAndParse(qb, null, {
        first: true,
        bulkAggregate: true,
      });
    } catch (err) {
      logger.log(err);
      return [];
    }
  }

  async aggregate(args: { filterArr?: Filter[]; where?: string }, view: View) {
    try {
      const { where, aggregation } = this._getListArgs(args as any);

      const columns = await this.model.getColumns(this.context);

      let viewColumns = (
        await GridViewColumn.list(this.context, this.viewId)
      ).filter((c) => {
        const col = this.model.columnsById[c.fk_column_id];
        return c.show && (view.show_system_fields || !isSystemColumn(col));
      });

      // By default, the aggregation is done based on the columns configured in the view
      // If the aggregation parameter is provided, only the columns mentioned in the aggregation parameter are considered
      // Also the aggregation type from the parameter is given preference over the aggregation type configured in the view
      if (aggregation?.length) {
        viewColumns = viewColumns
          .map((c) => {
            const agg = aggregation.find((a) => a.field === c.fk_column_id);
            return new GridViewColumn({
              ...c,
              show: !!agg,
              aggregation: agg ? agg.type : c.aggregation,
            });
          })
          .filter((c) => c.show);
      }

      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );

      const qb = this.dbDriver(this.tnPath);

      // Apply filers from view configuration, filterArr and where parameter
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );
      await conditionV2(
        this,
        [
          ...(this.viewId
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList(this.context, {
                      viewId: this.viewId,
                    })) || [],
                  is_group: true,
                }),
              ]
            : []),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );

      const selectors: Array<Knex.Raw> = [];

      // Generating a knex raw aggregation query for each column in the view
      await Promise.all(
        viewColumns.map(async (viewColumn) => {
          const col = columns.find((c) => c.id === viewColumn.fk_column_id);
          if (!col) return null;

          if (!viewColumn.aggregation) return;

          // Skip system LTAR columns
          if (isLinksOrLTAR(col) && col.system) return;

          const aggSql = await applyAggregation({
            baseModelSqlv2: this,
            aggregation: viewColumn.aggregation,
            column: col,
            alias: col.id,
          });

          if (aggSql) selectors.push(this.dbDriver.raw(aggSql));
        }),
      );

      // If no queries are generated, return empty object
      if (!selectors.length) {
        return {};
      }

      qb.select(...selectors);

      // Some aggregation on Date, DateTime related columns may generate result other than Date, DateTime
      // So skip the date conversion
      const data = await this.execAndParse(qb, null, {
        first: true,
        skipDateConversion: true,
        skipAttachmentConversion: true,
        skipUserConversion: true,
      });

      return data;
    } catch (e) {
      logger.log(e);
      return {};
    }
  }

  async groupBy(args: {
    where?: string;
    column_name: string;
    subGroupColumnName?: string;
    limit?;
    offset?;
    sort?: string | string[];
    filterArr?: Filter[];
    sortArr?: Sort[];
  }) {
    return await baseModelGroupBy(this, logger).list(args);
  }

  async groupByCount(args: {
    where?: string;
    column_name: string;
    limit?;
    offset?;
    filterArr?: Filter[];
  }) {
    return await baseModelGroupBy(this, logger).count(args);
  }

  // #region relation list count part 1
  async multipleHmList(
    param: {
      colId: string;
      ids: any[];
      apiVersion?: NcApiVersion;
      nested?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).multipleHmList(
      param,
      args,
    );
  }

  public async mmList(
    param: {
      colId: string;
      parentId: any;
      apiVersion?: NcApiVersion;
      nested?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    selectAllRecords = false,
  ) {
    return relationDataFetcher({ baseModel: this, logger }).mmList(
      param,
      args,
      selectAllRecords,
    );
  }

  async multipleHmListCount({ colId, ids }) {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).multipleHmListCount({
      colId,
      ids,
    });
  }

  async hmList(
    param: {
      colId: string;
      id: any;
      apiVersion?: NcApiVersion;
      nested?: boolean;
    },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).hmList(param, args);
  }

  async hmListCount({ colId, id }, args) {
    return relationDataFetcher({ baseModel: this, logger }).hmListCount(
      { colId, id },
      args,
    );
  }

  public async multipleMmList(
    param: {
      colId: string;
      parentIds: any[];
      apiVersion?: NcApiVersion;
      nested?: boolean;
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    return relationDataFetcher({ baseModel: this, logger }).multipleMmList(
      param,
      args,
    );
  }

  public async multipleMmListCount({ colId, parentIds }) {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).multipleMmListCount({
      colId,
      parentIds,
    });
  }

  public async mmListCount({ colId, parentId }, args) {
    return relationDataFetcher({ baseModel: this, logger }).mmListCount(
      { colId, parentId },
      args,
    );
  }

  // #endregion relation list count part 1

  // #region relation list count part 2
  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getMmChildrenExcludedListCount({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getMmChildrenExcludedList({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getHmChildrenExcludedList({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getHmChildrenExcludedListCount({ colId, pid }, args);
  }

  // todo: naming & optimizing
  public async getExcludedOneToOneChildrenList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getExcludedOneToOneChildrenList({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getBtChildrenExcludedListCount({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async countExcludedOneToOneChildren(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).countExcludedOneToOneChildren({ colId, cid }, args);
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    return relationDataFetcher({
      baseModel: this,
      logger,
    }).getBtChildrenExcludedList({ colId, cid }, args);
  }

  // #endregion relation list count part 2

  async applySortAndFilter({
    table,
    view,
    where,
    qb,
    sort,
    onlySort = false,
    skipViewFilter = false,
  }: {
    table: Model;
    view?: View;
    where: string;
    qb;
    sort: string;
    onlySort?: boolean;
    skipViewFilter?: boolean;
  }) {
    const childAliasColMap = await table.getAliasColObjMap(this.context);

    if (!onlySort) {
      const { filters: filter } = extractFilterFromXwhere(
        this.context,
        where,
        childAliasColMap,
      );
      await conditionV2(
        this,
        [
          ...(view && !skipViewFilter
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList(this.context, {
                      viewId: view.id,
                    })) || [],
                  is_group: true,
                }),
              ]
            : []),
          ...(filter || []),
        ],
        qb,
      );
    }

    // First priority View Sort
    if (view) {
      const sortObj = await view.getSorts(this.context);
      await sortV2(this, sortObj, qb);
    }

    let orderColumnBy = '';
    await table.getColumns(this.context);
    const orderCol = table.columns?.find((col) => col.uidt === UITypes.Order);
    const childTn = await this.getTnPath(table);
    if (orderCol) {
      orderColumnBy = `${childTn}.${orderCol.column_name}`;
    }
    // Second priority Order column sort
    if (orderColumnBy) {
      qb.orderBy(orderColumnBy);
    }

    // Third priority query string sort
    if (!sort) return;
    const sortObj = extractSortsObject(this.context, sort, childAliasColMap);
    if (sortObj) await sortV2(this, sortObj, qb);
  }

  async getSelectQueryBuilderForFormula(
    column: Column<any>,
    tableAlias?: string,
    validateFormula = false,
    aliasToColumnBuilder = {},
  ) {
    const formula = await column.getColOptions<FormulaColumn>(this.context);
    if (formula.error) throw new Error(`Formula error: ${formula.error}`);
    const qb = await formulaQueryBuilderv2({
      baseModel: this,
      tree: formula.formula,
      model: this.model,
      column,
      aliasToColumn: aliasToColumnBuilder,
      tableAlias,
      validateFormula,
    });
    return qb;
  }

  async getProto({
    apiVersion = NcApiVersion.V2,
  }: {
    apiVersion?: NcApiVersion;
  } = {}) {
    if (this._proto) {
      return this._proto as ResolverObj;
    }

    const proto: ResolverObj = {
      __columnAliases: {},
    };
    const columns = await this.model.getColumns(this.context);
    await Promise.all(
      columns.map(async (column) => {
        switch (column.uidt) {
          case UITypes.Lookup:
            {
              // @ts-ignore
              const colOptions: LookupColumn = await column.getColOptions(
                this.context,
              );
              const relCol = await Column.get(this.context, {
                colId: colOptions.fk_relation_column_id,
              });
              const relColTitle =
                relCol.uidt === UITypes.Links
                  ? `_nc_lk_${relCol.title}`
                  : relCol.title;
              proto.__columnAliases[column.title] = {
                path: [
                  relColTitle,
                  (
                    await Column.get(this.context, {
                      colId: colOptions.fk_lookup_column_id,
                    })
                  )?.title,
                ],
              };
            }
            break;
          case UITypes.Links:
          case UITypes.LinkToAnotherRecord:
            {
              this._columns[column.title] = column;
              const colOptions = (await column.getColOptions(
                this.context,
              )) as LinkToAnotherRecordColumn;

              if (colOptions?.type === 'hm') {
                const listLoader = new DataLoader(
                  async (ids: string[]) => {
                    if (ids.length > 1) {
                      const data = await this.multipleHmList(
                        {
                          colId: column.id,
                          ids,
                          apiVersion,
                        },
                        (listLoader as any).args,
                      );
                      return ids.map((id: string) =>
                        data[id] ? data[id] : [],
                      );
                    } else {
                      return [
                        await this.hmList(
                          {
                            colId: column.id,
                            id: ids[0],
                            apiVersion,
                            nested: true,
                          },
                          (listLoader as any).args,
                        ),
                      ];
                    }
                  },
                  {
                    cache: false,
                  },
                );
                const self: BaseModelSqlv2 = this;

                proto[
                  column.uidt === UITypes.Links
                    ? `_nc_lk_${column.title}`
                    : column.title
                ] = async function (args): Promise<any> {
                  (listLoader as any).args = args;
                  return listLoader.load(
                    getCompositePkValue(self.model.primaryKeys, this),
                  );
                };
              } else if (colOptions.type === 'mm') {
                const listLoader = new DataLoader(
                  async (ids: string[]) => {
                    if (ids?.length > 1) {
                      const data = await this.multipleMmList(
                        {
                          parentIds: ids,
                          colId: column.id,
                          apiVersion,
                          nested: true,
                        },
                        (listLoader as any).args,
                      );

                      return data;
                    } else {
                      return [
                        await this.mmList(
                          {
                            parentId: ids[0],
                            colId: column.id,
                            apiVersion,
                            nested: true,
                          },
                          (listLoader as any).args,
                        ),
                      ];
                    }
                  },
                  {
                    cache: false,
                  },
                );

                const self: BaseModelSqlv2 = this;
                proto[
                  column.uidt === UITypes.Links
                    ? `_nc_lk_${column.title}`
                    : column.title
                ] = async function (args): Promise<any> {
                  (listLoader as any).args = args;
                  return await listLoader.load(
                    getCompositePkValue(self.model.primaryKeys, this),
                  );
                };
              } else if (colOptions.type === 'bt') {
                // @ts-ignore
                const colOptions = (await column.getColOptions(
                  this.context,
                )) as LinkToAnotherRecordColumn;
                const pCol = await Column.get(this.context, {
                  colId: colOptions.fk_parent_column_id,
                });
                const cCol = await Column.get(this.context, {
                  colId: colOptions.fk_child_column_id,
                });

                // use dataloader to get batches of parent data together rather than getting them individually
                // it takes individual keys and callback is invoked with an array of values and we can get the
                // result for all those together and return the value in the same order as in the array
                // this way all parents data extracted together
                const readLoader = new DataLoader(
                  async (_ids: string[]) => {
                    // handle binary(16) foreign keys
                    const ids = _ids.map((id) => {
                      if (pCol.ct !== 'binary(16)') return id;

                      // Cast the id to string.
                      const idAsString = id + '';
                      // Check if the id is a UUID and the column is binary(16)
                      const isUUIDBinary16 =
                        idAsString.length === 36 || idAsString.length === 32;
                      // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
                      const idAsUUID = isUUIDBinary16
                        ? idAsString.length === 32
                          ? idAsString.replace(
                              /(.{8})(.{4})(.{4})(.{4})(.{12})/,
                              '$1-$2-$3-$4-$5',
                            )
                          : idAsString
                        : null;

                      return idAsUUID
                        ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
                        : id;
                    });

                    const data = await (
                      await Model.getBaseModelSQL(this.context, {
                        id: pCol.fk_model_id,
                        dbDriver: this.dbDriver,
                      })
                    ).list(
                      {
                        fieldsSet: (readLoader as any).args?.fieldsSet,
                        filterArr: [
                          new Filter({
                            id: null,
                            fk_column_id: pCol.id,
                            fk_model_id: pCol.fk_model_id,
                            value: ids as any[],
                            comparison_op: 'in',
                          }),
                        ],
                      },
                      {
                        ignoreViewFilterAndSort: true,
                        ignorePagination: true,
                      },
                    );

                    const groupedList = groupBy(data, pCol.title);
                    return _ids.map(
                      async (id: string) => groupedList?.[id]?.[0],
                    );
                  },
                  {
                    cache: false,
                  },
                );

                // defining BelongsTo read resolver method
                proto[column.title] = async function (args?: any) {
                  if (
                    this?.[cCol?.title] === null ||
                    this?.[cCol?.title] === undefined
                  )
                    return null;

                  (readLoader as any).args = args;

                  return await readLoader.load(this?.[cCol?.title]);
                };
              } else if (colOptions.type === 'oo') {
                const isBt = column.meta?.bt;

                if (isBt) {
                  // @ts-ignore
                  const colOptions = (await column.getColOptions(
                    this.context,
                  )) as LinkToAnotherRecordColumn;
                  const pCol = await Column.get(this.context, {
                    colId: colOptions.fk_parent_column_id,
                  });
                  const cCol = await Column.get(this.context, {
                    colId: colOptions.fk_child_column_id,
                  });

                  // use dataloader to get batches of parent data together rather than getting them individually
                  // it takes individual keys and callback is invoked with an array of values and we can get the
                  // result for all those together and return the value in the same order as in the array
                  // this way all parents data extracted together
                  const readLoader = new DataLoader(
                    async (_ids: string[]) => {
                      // handle binary(16) foreign keys
                      const ids = _ids.map((id) => {
                        if (pCol.ct !== 'binary(16)') return id;

                        // Cast the id to string.
                        const idAsString = id + '';
                        // Check if the id is a UUID and the column is binary(16)
                        const isUUIDBinary16 =
                          idAsString.length === 36 || idAsString.length === 32;
                        // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
                        const idAsUUID = isUUIDBinary16
                          ? idAsString.length === 32
                            ? idAsString.replace(
                                /(.{8})(.{4})(.{4})(.{4})(.{12})/,
                                '$1-$2-$3-$4-$5',
                              )
                            : idAsString
                          : null;

                        return idAsUUID
                          ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
                          : id;
                      });

                      const data = await (
                        await Model.getBaseModelSQL(this.context, {
                          id: pCol.fk_model_id,
                          dbDriver: this.dbDriver,
                        })
                      ).list(
                        {
                          fieldsSet: (readLoader as any).args?.fieldsSet,
                          filterArr: [
                            new Filter({
                              id: null,
                              fk_column_id: pCol.id,
                              fk_model_id: pCol.fk_model_id,
                              value: ids as any[],
                              comparison_op: 'in',
                            }),
                          ],
                        },
                        {
                          ignoreViewFilterAndSort: true,
                          ignorePagination: true,
                        },
                      );

                      const groupedList = groupBy(data, pCol.title);
                      return _ids.map(
                        async (id: string) => groupedList?.[id]?.[0],
                      );
                    },
                    {
                      cache: false,
                    },
                  );

                  // defining BelongsTo read resolver method
                  proto[column.title] = async function (args?: any) {
                    if (
                      this?.[cCol?.title] === null ||
                      this?.[cCol?.title] === undefined
                    )
                      return null;

                    (readLoader as any).args = args;

                    return await readLoader.load(this?.[cCol?.title]);
                  };
                } else {
                  const listLoader = new DataLoader(
                    async (ids: string[]) => {
                      if (ids.length > 1) {
                        const data = await this.multipleHmList(
                          {
                            colId: column.id,
                            ids,
                          },
                          (listLoader as any).args,
                        );
                        return ids.map((id: string) =>
                          data[id] ? data[id]?.[0] : null,
                        );
                      } else {
                        return [
                          (
                            await this.hmList(
                              {
                                colId: column.id,
                                id: ids[0],
                              },
                              (listLoader as any).args,
                            )
                          )?.[0] ?? null,
                        ];
                      }
                    },
                    {
                      cache: false,
                    },
                  );
                  const self: BaseModelSqlv2 = this;

                  proto[
                    column.uidt === UITypes.Links
                      ? `_nc_lk_${column.title}`
                      : column.title
                  ] = async function (args): Promise<any> {
                    (listLoader as any).args = args;
                    return listLoader.load(
                      getCompositePkValue(self.model.primaryKeys, this),
                    );
                  };
                }
              }
            }
            break;
        }
      }),
    );
    this._proto = proto;
    return proto;
  }

  _getListArgs(
    args: XcFilterWithAlias,
    {
      apiVersion = NcApiVersion.V2,
      nested = false,
    }: {
      apiVersion?: NcApiVersion;
      nested?: boolean;
    } = {},
  ): XcFilter {
    return getListArgs(args, this.model, {
      ignoreAssigningWildcardSelect: true,
      apiVersion,
      nested,
    });
  }

  public async shuffle({ qb }: { qb: Knex.QueryBuilder }): Promise<void> {
    if (this.isMySQL) {
      qb.orderByRaw('RAND()');
    } else if (this.isPg || this.isSqlite) {
      qb.orderByRaw('RANDOM()');
    } else if (this.isMssql) {
      qb.orderByRaw('NEWID()');
    }
  }

  // todo:
  //  pass view id as argument
  //  add option to get only pk and pv
  public async selectObject(params: {
    fieldsSet?: Set<string>;
    qb: Knex.QueryBuilder & Knex.QueryInterface;
    columns?: Column[];
    fields?: string[] | string;
    extractPkAndPv?: boolean;
    viewId?: string;
    alias?: string;
    validateFormula?: boolean;
  }): Promise<void> {
    return await selectObject(this, logger)(params);
  }

  async insert(data, request: NcRequest, trx?, _disableOptimization = false) {
    return await baseModelInsert(this).single(
      data,
      request,
      trx,
      _disableOptimization,
    );
  }

  async delByPk(id, _trx?, cookie?) {
    let trx: Knex.Transaction = _trx;
    try {
      const source = await this.getSource();
      // retrieve data for handling params in hook
      const data = await this.readRecord({
        idOrRecord: id,
        validateFormula: false,
        ignoreView: true,
        getHiddenColumn: true,
        source,
      });
      await this.beforeDelete(id, trx, cookie);

      const execQueries: ((trx: Knex.Transaction) => Promise<any>)[] = [];

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );
              const mmParentColumn = await Column.get(this.context, {
                colId: colOptions.fk_mm_child_column_id,
              });

              execQueries.push((trx) =>
                trx(this.getTnPath(mmTable.table_name))
                  .del()
                  .where(mmParentColumn.column_name, id),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx) =>
                trx(this.getTnPath(relatedTable.table_name))
                  .update({
                    [childColumn.column_name]: null,
                  })
                  .where(childColumn.column_name, id),
              );
            }
            break;
          case 'bt':
            {
              // nothing to do
            }
            break;
        }
      }
      const where = await this._wherePk(id);
      if (!trx) {
        trx = await this.dbDriver.transaction();
      }

      await Promise.all(execQueries.map((q) => q(trx)));

      const response = await trx(this.tnPath).del().where(where);

      if (!_trx) await trx.commit();

      await this.clearFileReferences({
        oldData: [data],
        columns: this.model.columns,
      });

      await this.afterDelete(data, trx, cookie);
      return response;
    } catch (e) {
      if (!_trx) await trx.rollback();
      await this.errorDelete(e, id, trx, cookie);
      throw e;
    }
  }

  async hasLTARData(rowId, model: Model): Promise<any> {
    const res = [];
    const LTARColumns = (await model.getColumns(this.context)).filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord,
    );
    let i = 0;
    for (const column of LTARColumns) {
      const colOptions = (await column.getColOptions(
        this.context,
      )) as LinkToAnotherRecordColumn;
      const childColumn = await colOptions.getChildColumn(this.context);
      const parentColumn = await colOptions.getParentColumn(this.context);
      const childModel = await childColumn.getModel(this.context);
      await childModel.getColumns(this.context);
      const parentModel = await parentColumn.getModel(this.context);
      await parentModel.getColumns(this.context);
      let cnt = 0;
      if (colOptions.type === RelationTypes.HAS_MANY) {
        cnt = +(
          await this.execAndParse(
            this.dbDriver(this.getTnPath(childModel.table_name))
              .count(childColumn.column_name, { as: 'cnt' })
              .where(childColumn.column_name, rowId),
            null,
            { raw: true, first: true },
          )
        ).cnt;
      } else if (colOptions.type === RelationTypes.MANY_TO_MANY) {
        const mmModel = await colOptions.getMMModel(this.context);
        const mmChildColumn = await colOptions.getMMChildColumn(this.context);
        cnt = +(
          await this.execAndParse(
            this.dbDriver(this.getTnPath(mmModel.table_name))
              .where(
                `${this.getTnPath(mmModel.table_name)}.${
                  mmChildColumn.column_name
                }`,
                rowId,
              )
              .count(mmChildColumn.column_name, { as: 'cnt' }),
            null,
            { first: true },
          )
        ).cnt;
      }
      if (cnt) {
        res.push(
          `${i++ + 1}. ${model.title}.${
            column.title
          } is a LinkToAnotherRecord of ${childModel.title}`,
        );
      }
    }
    return res;
  }

  async moveRecord({
    rowId,
    beforeRowId,
  }: {
    rowId: string;
    beforeRowId: string;
    cookie?: { user?: any };
  }) {
    const columns = await this.model.getColumns(this.context);

    const row = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    if (!row) {
      NcError.recordNotFound(rowId);
    }

    const newRecordOrder = (
      await this.getUniqueOrdersBeforeItem(beforeRowId, 1)
    )[0];

    return await this.dbDriver(this.tnPath)
      .update({
        [columns.find((c) => c.uidt === UITypes.Order).column_name]:
          newRecordOrder.toString(),
      })
      .where(await this._wherePk(rowId));
  }

  async updateByPk(id, data, trx?, cookie?, _disableOptimization = false) {
    try {
      const columns = await this.model.getColumns(this.context);

      const updateObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(data, columns);

      await this.beforeUpdate(data, trx, cookie);

      const btForeignKeyColumn = columns.find(
        (c) =>
          c.uidt === UITypes.ForeignKey && data[c.column_name] !== undefined,
      );

      const btColumn = btForeignKeyColumn
        ? columns.find(
            (c) =>
              c.uidt === UITypes.LinkToAnotherRecord &&
              c.colOptions?.fk_child_column_id === btForeignKeyColumn.id,
          )
        : null;

      const prevData = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (!prevData) {
        NcError.recordNotFound(id);
      }

      await this.prepareNocoData(updateObj, false, cookie, prevData);

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id, true));

      await this.execAndParse(query, null, { raw: true });

      const newId = this.extractPksValues(
        {
          ...prevData,
          ...updateObj,
        },
        true,
      );

      const newData = await this.readByPk(
        newId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      if (btColumn && Object.keys(data || {}).length === 1) {
        await this.addChild({
          colId: btColumn.id,
          rowId: newId,
          childId: updateObj[btForeignKeyColumn.title],
          cookie,
          onlyUpdateAuditLogs: true,
          prevData,
        });
      } else {
        await this.afterUpdate(prevData, newData, trx, cookie, updateObj);
      }
      return newData;
    } catch (e) {
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async _wherePk(id, skipGetColumns = false, skipPkValidation = false) {
    if (!skipGetColumns) await this.model.getColumns(this.context);
    return _wherePk(this.model.primaryKeys, id, skipPkValidation);
  }

  comparePks(pk1, pk2) {
    // If either pk1 or pk2 is a string or number, convert both to strings and compare
    if (isPrimitiveType(pk1) || isPrimitiveType(pk2)) {
      return `${pk1}` === `${pk2}`;
    }

    // If both are objects (composite keys), compare them using deep equality check
    return equal(pk1, pk2);
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    const schema = (this.dbDriver as any).searchPath?.();
    if (this.isPg && this.schema) {
      return `${this.schema}.${tn}${alias ? ` as ${alias}` : ``}`;
    } else if (this.isMssql && schema) {
      return this.dbDriver.raw(`??.??${alias ? ' as ??' : ''}`, [
        schema,
        tn,
        ...(alias ? [alias] : []),
      ]);
    } else if (this.isSnowflake) {
      return `${[
        this.dbDriver.client.config.connection.database,
        this.dbDriver.client.config.connection.schema,
        tn,
      ].join('.')}${alias ? ` as ${alias}` : ``}`;
    } else {
      return `${tn}${alias ? ` as ${alias}` : ``}`;
    }
  }

  public get tnPath() {
    return this.getTnPath(this.model);
  }

  public get clientMeta() {
    return {
      isSqlite: this.isSqlite,
      isMssql: this.isMssql,
      isPg: this.isPg,
      isMySQL: this.isMySQL,
      // isSnowflake: this.isSnowflake,
    };
  }

  get isSqlite() {
    return this.clientType === 'sqlite3';
  }

  get isMssql() {
    return this.clientType === 'mssql';
  }

  get isPg() {
    return this.clientType === 'pg';
  }

  get isMySQL() {
    return this.clientType === 'mysql2' || this.clientType === 'mysql';
  }

  get isSnowflake() {
    return this.clientType === 'snowflake';
  }

  get isDatabricks() {
    return this.clientType === 'databricks';
  }

  get clientType() {
    return this.dbDriver.clientType();
  }

  public async readRecord(params: {
    idOrRecord: string | Record<string, any>;
    fieldsSet?: Set<string>;
    ignoreView?: boolean;
    getHiddenColumn?: boolean;
    validateFormula?: boolean;
    source: Source;
    disableOptimization?: boolean;
    view?: View;
  }): Promise<any> {
    return this.readByPk(
      params.idOrRecord,
      false,
      {},
      {
        ignoreView: params.ignoreView,
        getHiddenColumn: params.getHiddenColumn,
      },
    );
  }

  async nestedInsert(data, request: NcRequest, _trx = null, param?) {
    // const driver = trx ? trx : await this.dbDriver.transaction();
    try {
      const source = await this.getSource();
      await populatePk(this.context, this.model, data);

      const columns = await this.model.getColumns(this.context);

      const insertObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );
      let rowId = null;

      const nestedCols = columns.filter((c) => isLinksOrLTAR(c));
      const { postInsertOps, preInsertOps, postInsertAuditOps } =
        await this.prepareNestedLinkQb({
          nestedCols,
          data,
          insertObj,
          req: request,
        });

      await this.validate(insertObj, columns);

      await this.beforeInsert(insertObj, this.dbDriver, request);

      await this.prepareNocoData(insertObj, true, request, null, {
        ncOrder: null,
        before: param?.before,
        undo: param?.undo,
      });

      await this.runOps(preInsertOps.map((f) => f()));

      let response;
      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if ((this.isPg || this.isMssql) && this.model.primaryKey) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.id}`,
        );
        response = await this.execAndParse(query, null, { raw: true });
      }

      const ai = this.model.columns.find((c) => c.ai);

      let ag: Column;
      if (!ai) ag = this.model.columns.find((c) => c.meta?.ag);

      // handle if autogenerated primary key is used
      if (ag) {
        rowId = insertObj[ag.column_name];
        if (!response) await this.execAndParse(query);
        response = await this.readRecord({
          idOrRecord: insertObj[ag.column_name],
          ignoreView: true,
          getHiddenColumn: true,
          validateFormula: false,
          source,
        });
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        if (response?.length) {
          rowId = response[0];
        } else {
          rowId = await this.execAndParse(query, null, {
            raw: true,
          });
          rowId = rowId.id ?? rowId[0]?.insertId ?? rowId;
        }

        if (ai) {
          if (this.isSqlite) {
            // sqlite doesnt return id after insert
            rowId = (
              await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(ai.column_name)
                  .max(ai.column_name, { as: '__nc_ai_id' }),
                null,
                {
                  raw: true,
                  first: true,
                },
              )
            )?.__nc_ai_id;
          } else if (this.isSnowflake || this.isDatabricks) {
            rowId = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: '__nc_ai_id',
                }),
                null,
                { raw: true, first: true },
              )
            )?.__nc_ai_id;
          }
          // response = await this.readByPk(
          //   id,
          //   false,
          //   {},
          //   { ignoreView: true, getHiddenColumn: true },
          // );
        } else {
          response = data;
        }
      } else if (ai) {
        rowId = Array.isArray(response)
          ? response?.[0]?.[ai.id]
          : response?.[ai.id];
      }
      rowId = this.extractCompositePK({ ai, ag, rowId, insertObj });
      // when auto generated (with default) pk columns
      if (!rowId && response.length === 1) {
        if (this.model.primaryKeys.length === 1) {
          rowId = response[0][this.model.primaryKeys[0].id];
        } else {
          const responseWithColumnTitle = Object.keys(response[0]).reduce(
            (res, colId) => {
              const col = this.model.columns.find((c) => c.id === colId);
              res[col.title] = response[0][colId];
              return res;
            },
            {},
          );
          rowId = this.extractPksValues(responseWithColumnTitle, true);
        }
      }

      await this.runOps(postInsertOps.map((f) => f(rowId)));

      // run link audit operations after link insert
      for (const f of postInsertAuditOps) {
        await f(rowId);
      }

      if (this.model.primaryKey && rowId !== null && rowId !== undefined) {
        response = await this.readRecord({
          idOrRecord: rowId,
          validateFormula: false,
          ignoreView: true,
          getHiddenColumn: true,
          source,
        });
      }

      await this.afterInsert({
        data: response,
        trx: this.dbDriver,
        req: request,
        insertData: data,
      });

      await this.statsUpdate({
        count: 1,
      });

      return response;
    } catch (e) {
      throw e;
    }
  }

  extractCompositePK({
    ai,
    ag,
    rowId,
    insertObj,
    force = false,
  }: {
    ai: Column<any>;
    ag: Column<any>;
    rowId;
    insertObj: Record<string, any>;
    force?: boolean;
  }) {
    // handle if composite primary key is used along with ai or ag
    if (ag) {
      return insertObj[ag.column_name] ?? rowId;
    } else if (ai && (force || this.model.primaryKeys?.length > 1)) {
      // generate object with ai column and rest of the primary keys
      const pkObj = {};
      for (const pk of this.model.primaryKeys) {
        const key = pk.title;
        if (ai && pk.id === ai.id && !(rowId === null || rowId === undefined)) {
          pkObj[key] = rowId;
        } else {
          pkObj[key] = insertObj[pk.column_name] ?? null;
        }
      }
      rowId = pkObj;
    } else if (!ai && !ag && insertObj) {
      // handle if primary key is not ai or ag
      if (this.model.primaryKeys.length === 1) {
        return insertObj[this.model.primaryKey.column_name] ?? null;
      } else {
        return this.model.primaryKeys.reduce((acc, pk) => {
          acc[pk.title] = insertObj[pk.column_name] ?? null;
          return acc;
        }, {});
      }
    }

    return rowId;
  }

  async prepareNestedLinkQb(param: {
    nestedCols: Column[];
    data: Record<string, any>;
    insertObj: Record<string, any>;
    req: NcRequest;
  }) {
    return new NestedLinkPreparator().prepareNestedLinkQb(this, param);
  }

  async bulkUpsert(
    datas: any[],
    {
      chunkSize = 100,
      cookie,
      raw = false,
      foreign_key_checks = true,
      undo = false,
    }: {
      chunkSize?: number;
      cookie?: any;
      raw?: boolean;
      foreign_key_checks?: boolean;
      undo?: boolean;
    } = {},
  ) {
    let trx;
    try {
      const columns = await this.model.getColumns(this.context);

      let order = await this.getHighestOrderInTable();

      const insertedDatas = [];
      const updatedDatas = [];

      const aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
      const agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);

      // validate and prepare data
      const preparedDatas = raw
        ? datas
        : await Promise.all(
            datas.map(async (d) => {
              await this.validate(d, columns);
              return this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              );
            }),
          );

      const dataWithPks = [];
      const dataWithoutPks = [];

      for (const data of preparedDatas) {
        const pkValues = this.extractPksValues(data, true);
        if (pkValues !== 'N/A' && pkValues !== undefined) {
          dataWithPks.push({ pk: pkValues, data });
        } else {
          await this.prepareNocoData(data, true, cookie, null, {
            ncOrder: order,
            undo,
          });
          order = order?.plus(1);
          // const insertObj = this.handleValidateBulkInsert(data, columns);
          dataWithoutPks.push(data);
        }
      }

      // Check which records with PKs exist in the database
      const existingRecords = await this.chunkList({
        pks: dataWithPks.map((v) => v.pk),
      });

      const existingPkSet = new Set(
        existingRecords.map((r) => this.extractPksValues(r, true)),
      );

      const toInsert = [...dataWithoutPks];
      const toUpdate = [];

      for (const { pk, data } of dataWithPks) {
        if (existingPkSet.has(pk)) {
          await this.prepareNocoData(data, false, cookie);
          toUpdate.push(data);
        } else {
          await this.prepareNocoData(data, true, cookie, null, {
            ncOrder: order,
            undo,
          });
          order = order?.plus(1);
          // const insertObj = this.handleValidateBulkInsert(data, columns);
          toInsert.push(data);
        }
      }

      trx = await this.dbDriver.transaction();

      const updatedPks = [];

      if (toUpdate.length > 0) {
        for (const data of toUpdate) {
          if (!raw) await this.validate(data, columns);
          const pkValues = this.extractPksValues(data);
          updatedPks.push(pkValues);
          const wherePk = await this._wherePk(pkValues, true);
          await trx(this.tnPath).update(data).where(wherePk);
        }
      }

      if (toInsert.length > 0) {
        if (!foreign_key_checks) {
          if (this.isPg) {
            await trx.raw('set session_replication_role to replica;');
          } else if (this.isMySQL) {
            await trx.raw('SET foreign_key_checks = 0;');
          }
        }
        let responses;

        if (this.isSqlite || this.isMySQL) {
          responses = [];

          for (const insertData of toInsert) {
            const query = trx(this.tnPath).insert(insertData);
            let id = (await query)[0];

            if (agPkCol) {
              id = insertData[agPkCol.column_name];
            }

            responses.push(
              this.extractCompositePK({
                rowId: id,
                ai: aiPkCol,
                ag: agPkCol,
                insertObj: insertData,
                force: true,
              }) || insertData,
            );
          }
        } else {
          const returningObj: Record<string, string> = {};

          for (const col of this.model.primaryKeys) {
            returningObj[col.title] = col.column_name;
          }

          responses =
            !raw && (this.isPg || this.isMssql)
              ? await trx
                  .batchInsert(this.tnPath, toInsert, chunkSize)
                  .returning(
                    this.model.primaryKeys?.length ? returningObj : '*',
                  )
              : await trx.batchInsert(this.tnPath, toInsert, chunkSize);
        }

        if (!foreign_key_checks) {
          if (this.isPg) {
            await trx.raw('set session_replication_role to origin;');
          } else if (this.isMySQL) {
            await trx.raw('SET foreign_key_checks = 1;');
          }
        }
        insertedDatas.push(...responses);
      }

      await trx.commit();

      const updatedRecords = await this.chunkList({
        pks: updatedPks,
      });
      updatedDatas.push(...updatedRecords);

      const insertedDataList =
        insertedDatas.length > 0
          ? await this.chunkList({
              pks: insertedDatas.map((d) => this.extractPksValues(d)),
            })
          : [];

      const updatedDataList =
        updatedDatas.length > 0
          ? await this.chunkList({
              pks: updatedDatas.map((d) => this.extractPksValues(d)),
            })
          : [];

      if (insertedDatas.length === 1) {
        await this.afterInsert({
          data: insertedDataList[0],
          trx: this.dbDriver,
          req: cookie,
          insertData: datas[0],
        });

        await this.statsUpdate({
          count: insertedDataList.length,
        });
      } else if (insertedDatas.length > 1) {
        await this.afterBulkInsert(insertedDataList, this.dbDriver, cookie);

        await this.statsUpdate({
          count: insertedDataList.length,
        });
      }

      if (updatedDataList.length === 1) {
        await this.afterUpdate(
          existingRecords[0],
          updatedDataList[0],
          null,
          cookie,
          datas[0],
        );
      } else {
        await this.afterBulkUpdate(
          existingRecords,
          updatedDataList,
          this.dbDriver,
          cookie,
        );
      }

      return [...updatedDataList, ...insertedDataList];
    } catch (e) {
      await trx?.rollback();
      throw e;
    }
  }

  async chunkList(args: { pks: string[]; chunkSize?: number }) {
    const { pks, chunkSize = 1000 } = args;

    const data = [];

    const chunkedPks = chunkArray(pks, chunkSize);

    for (const chunk of chunkedPks) {
      const chunkData = await this.list(
        {
          pks: chunk.join(','),
        },
        {
          limitOverride: chunk.length,
          ignoreViewFilterAndSort: true,
        },
      );

      data.push(...chunkData);
    }

    return data;
  }

  async handleValidateBulkInsert(
    d: Record<string, any>,
    columns?: Column[],
    params: {
      allowSystemColumn: boolean;
      undo: boolean;
      typecast: boolean;
    } = {
      allowSystemColumn: false,
      undo: false,
      typecast: false,
    },
  ) {
    const { allowSystemColumn } = params;
    const cols = columns || (await this.model.getColumns(this.context));
    const insertObj = {};

    for (let i = 0; i < cols.length; ++i) {
      const col = cols[i];

      if (col.title in d || col.id in d) {
        if (
          isCreatedOrLastModifiedTimeCol(col) ||
          isCreatedOrLastModifiedByCol(col)
        ) {
          NcError.badRequest(
            `Column "${col.title}" is auto generated and cannot be updated`,
          );
        }

        if (isVirtualCol(col) && !isLinksOrLTAR(col)) {
          NcError.badRequest(
            `Column "${col.title}" is virtual and cannot be updated`,
          );
        }

        if (
          col.system &&
          !allowSystemColumn &&
          [UITypes.ForeignKey].includes(col.uidt)
        ) {
          NcError.badRequest(
            `Column "${col.title}" is system column and cannot be updated`,
          );
        }

        if (!allowSystemColumn && col.readonly) {
          NcError.badRequest(
            `Column "${col.title}" is readonly column and cannot be updated`,
          );
        }

        if (
          col.system &&
          !allowSystemColumn &&
          col.uidt !== UITypes.Order &&
          !params.undo
        ) {
          NcError.badRequest(
            `Column "${col.title}" is system column and cannot be updated`,
          );
        }
      }

      // populate pk columns
      if (col.pk) {
        if (col.meta?.ag && !(d[col.title] ?? d[col.id])) {
          if (d[col.id]) {
            d[col.title] = d[col.id];
          } else {
            d[col.title] =
              col.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
          }
        }
      }

      // map alias to column
      if (!isVirtualCol(col)) {
        let val = !ncIsUndefined(d?.[col.column_name])
          ? d?.[col.column_name]
          : !ncIsUndefined(d?.[col.title])
          ? d?.[col.title]
          : d?.[col.id];
        if (val !== undefined) {
          if (col.uidt === UITypes.Attachment && typeof val !== 'string') {
            val = JSON.stringify(val);
          }
          if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
            val = this.formatDate(val);
          }
          if (col.uidt === UITypes.Duration) {
            if (col.meta?.duration !== undefined) {
              const duration = convertDurationToSeconds(val, col.meta.duration);
              if (duration._isValid) {
                val = duration._sec;
              }
            }
          }
          insertObj[sanitize(col.column_name)] = val;
        }
      }

      await this.validateOptions(col, insertObj);

      // validate data
      if (col?.meta?.validate && col?.validate) {
        const validate = col.getValidators();
        const cn = col.column_name;
        const columnTitle = col.title;
        if (validate) {
          await validateFuncOnColumn({
            column: col,
            value:
              insertObj?.[cn] ??
              insertObj?.[columnTitle] ??
              insertObj?.[col.id],
            apiVersion: this.context.api_version,
            customValidators: customValidators as any,
          });
        }
      }
    }
    return insertObj;
  }

  // Helper method to format date
  private formatDate(val: string): any {
    const { isMySQL, isSqlite, isMssql, isPg } = this.clientMeta;
    if (val.indexOf('-') < 0 && val.indexOf('+') < 0 && val.slice(-1) !== 'Z') {
      // if no timezone is given,
      // then append +00:00 to make it as UTC
      val += '+00:00';
    }
    if (isMySQL) {
      // first convert the value to utc
      // from UI
      // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
      // from API
      // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
      // if timezone info is not found - considered as utc
      // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
      // if timezone info is found
      // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
      // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
      // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
      // then we use CONVERT_TZ to convert that in the db timezone
      return this.dbDriver.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
        dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss'),
      ]);
    } else if (isSqlite) {
      // convert to UTC
      // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
      return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
    } else if (isPg) {
      // convert to UTC
      // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
      // then convert to db timezone
      return this.dbDriver.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
        dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ'),
      ]);
    } else if (isMssql) {
      // convert ot UTC
      // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
      // then convert to db timezone
      return this.dbDriver.raw(
        `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
        [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
      );
    } else {
      // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
      return dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
    }
  }

  async bulkInsert(
    datas: any[],
    params?: {
      chunkSize?: number;
      cookie?: NcRequest;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      allowSystemColumn?: boolean;
      typecast?: boolean;
      undo?: boolean;
      apiVersion?: NcApiVersion;
    },
  ) {
    return await baseModelInsert(this).bulk(datas, params);
  }

  async bulkUpdate(
    datas: any[],
    {
      cookie,
      raw = false,
      throwExceptionIfNotExist = false,
      isSingleRecordUpdation = false,
      allowSystemColumn = false,
      apiVersion,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
      allowSystemColumn?: boolean;
      apiVersion?: NcApiVersion;
    } = {},
  ) {
    let transaction;
    const readChunkSize = 100;

    try {
      const columns = await this.model.getColumns(this.context);

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns, { allowSystemColumn });
        }
      }

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              this.model.mapAliasToColumn(
                this.context,
                d,
                this.clientMeta,
                this.dbDriver,
                columns,
              ),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      const pkAndData: { pk: string; data: any }[] = [];

      for (const d of updateDatas) {
        const pkValues = this.extractPksValues(d, true);

        if (!pkValues) {
          if (throwExceptionIfNotExist) NcError.recordNotFound(pkValues);
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });
      }

      for (let i = 0; i < pkAndData.length; i += readChunkSize) {
        const chunk = pkAndData.slice(i, i + readChunkSize);
        const pksToRead = chunk.map((v) => v.pk);

        const oldRecords = await this.chunkList({ pks: pksToRead });
        const oldRecordsMap = new Map<string, any>(
          oldRecords.map((r) => [this.extractPksValues(r, true), r]),
        );

        for (const { pk, data } of chunk) {
          const oldRecord = oldRecordsMap.get(pk);

          if (!oldRecord) {
            // removed data from error param, record not found message do not use data
            if (throwExceptionIfNotExist) NcError.recordNotFound(pk);
            continue;
          }

          await this.prepareNocoData(data, false, cookie, oldRecord);
          prevData.push(oldRecord);

          const wherePk = await this._wherePk(pk, true);
          toBeUpdated.push({ d: data, wherePk });

          updatePkValues.push(
            this.extractPksValues(
              {
                ...oldRecord,
                ...data,
              },
              true,
            ),
          );
        }
      }

      transaction = await this.dbDriver.transaction();

      if (
        this.model.primaryKeys.length === 1 &&
        (this.isPg || this.isMySQL || this.isSqlite)
      ) {
        await batchUpdate(
          transaction,
          this.tnPath,
          toBeUpdated.map((o) => o.d),
          this.model.primaryKey.column_name,
        );
      } else {
        for (const o of toBeUpdated) {
          await transaction(this.tnPath).update(o.d).where(o.wherePk);
        }
      }

      await transaction.commit();

      // todo: wrap with transaction
      if (apiVersion === NcApiVersion.V3) {
        for (const d of datas) {
          // remove LTAR/Links if part of the update request
          await this.updateLTARCols({
            rowId: this.extractPksValues(d, true),
            cookie,
            newData: d,
          });
        }
      }

      if (!raw) {
        for (let i = 0; i < updatePkValues.length; i += readChunkSize) {
          const pksChunk = updatePkValues.slice(i, i + readChunkSize);

          const updatedRecords = await this.list(
            { pks: pksChunk.join(',') },
            { limitOverride: pksChunk.length },
          );

          const updatedRecordsMap = new Map(
            updatedRecords.map((record) => [
              this.extractPksValues(record, true),
              record,
            ]),
          );

          for (const pk of pksChunk) {
            if (updatedRecordsMap.has(pk)) {
              newData.push(updatedRecordsMap.get(pk));
            }
          }
        }
      }

      if (!raw) {
        if (isSingleRecordUpdation) {
          await this.afterUpdate(
            prevData[0],
            newData[0],
            null,
            cookie,
            datas[0],
          );
        } else {
          await this.afterBulkUpdate(prevData, newData, this.dbDriver, cookie);
        }
      }

      return newData;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  }

  async updateLTARCols({
    rowId,
    newData,
    cookie,
  }: {
    newData: any;
    rowId: string;
    cookie;
  }) {
    for (const col of this.model.columns) {
      // skip if not LTAR or Links
      if (!isLinksOrLTAR(col)) continue;

      // skip if value is not part of the update
      if (!(col.title in newData)) continue;

      // extract existing link values to current record
      let existingLinks = [];

      if (col.colOptions.type === RelationTypes.MANY_TO_MANY) {
        existingLinks = await this.mmList({
          colId: col.id,
          parentId: rowId,
        });
      } else if (col.colOptions.type === RelationTypes.HAS_MANY) {
        existingLinks = await this.hmList({
          colId: col.id,
          id: rowId,
        });
      } else {
        existingLinks = await this.btRead({
          colId: col.id,
          id: rowId,
        });
      }

      existingLinks = existingLinks || [];

      if (!Array.isArray(existingLinks)) {
        existingLinks = [existingLinks];
      }

      const idsToLink = [
        ...(Array.isArray(newData[col.title])
          ? newData[col.title]
          : [newData[col.title]]
        ).map((rec) => this.extractPksValues(rec, true)),
      ];

      // check for any missing links then unlink
      const idsToUnlink = existingLinks
        .map((link) => this.extractPksValues(link, true))
        .filter((existingLinkPk) => {
          const index = idsToLink.findIndex((linkPk) => {
            return existingLinkPk === linkPk;
          });

          // if found remove from both list
          if (index > -1) {
            idsToLink.splice(index, 1);
            return false;
          }

          return true;
        });

      // check for missing links in new data and unlink them
      if (idsToUnlink?.length) {
        await this.removeLinks({
          colId: col.id,
          childIds: idsToUnlink,
          cookie,
          rowId,
        });
      }

      // check for new data and link them
      if (idsToLink?.length) {
        await this.addLinks({
          colId: col.id,
          childIds: idsToLink,
          cookie,
          rowId,
        });
      }
    }
  }

  async bulkUpdateAll(
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipValidationAndHooks?: boolean;
    } = {},
    data,
    { cookie }: { cookie: NcRequest },
  ) {
    try {
      let count = 0;

      const columns = await this.model.getColumns(this.context);

      const updateData = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );
      if (!args.skipValidationAndHooks)
        await this.validate(updateData, columns);

      // if attachment provided error out
      for (const col of columns) {
        if (col.uidt === UITypes.Attachment && updateData[col.column_name]) {
          NcError.notImplemented(`Attachment bulk update all`);
        }
      }

      await this.prepareNocoData(updateData, false, cookie);

      const pkValues = this.extractPksValues(updateData);
      if (pkValues !== null && pkValues !== undefined) {
        // pk is specified - by pass
      } else {
        const { where } = this._getListArgs(args);
        const qb = this.dbDriver(this.tnPath);
        const aliasColObjMap = await this.model.getAliasColObjMap(
          this.context,
          columns,
        );
        const { filters: filterObj } = extractFilterFromXwhere(
          this.context,
          where,
          aliasColObjMap,
          true,
        );

        const conditionObj = [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ];

        if (args.viewId) {
          conditionObj.push(
            new Filter({
              children:
                (await Filter.rootFilterList(this.context, {
                  viewId: args.viewId,
                })) || [],
              is_group: true,
            }),
          );
        }

        await conditionV2(this, conditionObj, qb, undefined, true);

        count = (
          await this.execAndParse(
            qb.clone().count('*', { as: 'count' }),
            null,
            {
              raw: true,
              first: true,
            },
          )
        )?.count;

        // insert records updating record details to audit table
        await this.bulkAudit({
          qb: qb.clone(),
          data,
          conditions: conditionObj,
          req: cookie,
          event: AuditV1OperationTypes.DATA_BULK_UPDATE,
        });

        qb.update(updateData);

        await this.execAndParse(qb, null, { raw: true });
      }

      if (!args.skipValidationAndHooks)
        await this.afterBulkUpdate(null, count, this.dbDriver, cookie, true);

      return count;
    } catch (e) {
      throw e;
    }
  }

  async bulkDelete(
    ids: any[],
    {
      cookie,
      throwExceptionIfNotExist = false,
      isSingleRecordDeletion = false,
    }: {
      cookie?: any;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordDeletion?: boolean;
    } = {},
  ) {
    const columns = await this.model.getColumns(this.context);

    let transaction;
    try {
      const deleteIds = await Promise.all(
        ids.map((d) =>
          this.model.mapAliasToColumn(
            this.context,
            d,
            this.clientMeta,
            this.dbDriver,
            columns,
          ),
        ),
      );

      const deleted = [];
      const res = [];
      const pkAndData: { pk: any; data: any }[] = [];
      const readChunkSize = 100;
      for (const [i, d] of deleteIds.entries()) {
        const pkValues = getCompositePkValue(
          this.model.primaryKeys,
          this.extractPksValues(d),
        );
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(pkValues);
          }
          continue;
        }

        pkAndData.push({ pk: pkValues, data: d });

        if (pkAndData.length >= readChunkSize || i === deleteIds.length - 1) {
          const tempToRead = pkAndData.splice(0, pkAndData.length);
          const oldRecords = await this.list(
            {
              pks: tempToRead.map((v) => v.pk).join(','),
            },
            {
              limitOverride: tempToRead.length,
              ignoreViewFilterAndSort: true,
            },
          );

          if (oldRecords.length === tempToRead.length) {
            deleted.push(...oldRecords);
            res.push(...tempToRead.map((v) => v.data));
          } else {
            for (const { pk, data } of tempToRead) {
              const oldRecord = oldRecords.find((r) =>
                this.comparePks(this.extractPksValues(r), pk),
              );

              if (!oldRecord) {
                // throw or skip if no record found
                if (throwExceptionIfNotExist) {
                  NcError.recordNotFound(pk);
                }
                continue;
              }

              deleted.push(oldRecord);
              res.push(data);
            }
          }
        }
      }

      await this.beforeBulkDelete(deleted, this.dbDriver, cookie);

      const execQueries: ((
        trx: Knex.Transaction,
        ids: any[],
      ) => Promise<any>)[] = [];

      const base = await this.getSource();

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(
                this.context,
                colOptions.fk_mm_model_id,
              );
              const mmParentColumn = await Column.get(this.context, {
                colId: colOptions.fk_mm_child_column_id,
              });

              execQueries.push((trx, ids) =>
                trx(this.getTnPath(mmTable.table_name))
                  .del()
                  .whereIn(mmParentColumn.column_name, ids),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx, ids) =>
                trx(this.getTnPath(relatedTable.table_name))
                  .update({
                    [childColumn.column_name]: null,
                  })
                  .whereIn(childColumn.column_name, ids),
              );
            }
            break;
          case 'bt':
            {
              // nothing to do
            }
            break;
        }
      }

      const idsVals = res.map((d) => d[this.model.primaryKey.column_name]);

      transaction = await this.dbDriver.transaction();

      if (base.isMeta() && execQueries.length > 0) {
        for (const execQuery of execQueries) {
          await execQuery(transaction, idsVals);
        }
      }

      for (const d of res) {
        await transaction(this.tnPath).del().where(d);
      }

      await transaction.commit();

      await this.clearFileReferences({
        oldData: deleted,
        columns: columns,
      });

      if (isSingleRecordDeletion) {
        await this.afterDelete(deleted[0], null, cookie);
      } else {
        await this.afterBulkDelete(deleted, this.dbDriver, cookie);
      }

      return res;
    } catch (e) {
      if (transaction) await transaction.rollback();
      throw e;
    }
  }

  async bulkDeleteAll(
    args: { where?: string; filterArr?: Filter[]; viewId?: string } = {},
    { cookie }: { cookie: NcRequest },
  ) {
    let trx: Knex.Transaction;
    try {
      const columns = await this.model.getColumns(this.context);
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.tnPath);
      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
        true,
      );

      await conditionV2(
        this,
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
          ...(args.viewId
            ? await Filter.rootFilterList(this.context, {
                viewId: args.viewId,
              })
            : []),
        ],
        qb,
        undefined,
        true,
      );
      const execQueries: ((trx: Knex.Transaction, qb: any) => Promise<any>)[] =
        [];
      // qb.del();

      for (const column of this.model.columns) {
        if (!isLinksOrLTAR(column)) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(this.context);

        if (colOptions.type === 'bt') {
          continue;
        }

        const childColumn = await colOptions.getChildColumn(this.context);
        const parentColumn = await colOptions.getParentColumn(this.context);
        const parentTable = await parentColumn.getModel(this.context);
        const childTable = await childColumn.getModel(this.context);
        await childTable.getColumns(this.context);
        await parentTable.getColumns(this.context);

        const childTn = this.getTnPath(childTable);

        switch (colOptions.type) {
          case 'mm':
            {
              const vChildCol = await colOptions.getMMChildColumn(this.context);
              const vTable = await colOptions.getMMModel(this.context);

              const vTn = this.getTnPath(vTable);

              execQueries.push(() =>
                this.dbDriver(vTn)
                  .where({
                    [vChildCol.column_name]: this.dbDriver(childTn)
                      .select(childColumn.column_name)
                      .first(),
                  })
                  .delete(),
              );
            }
            break;
          case 'hm':
            {
              // skip if it's an mm table column
              const relatedTable = await colOptions.getRelatedTable(
                this.context,
              );
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get(this.context, {
                colId: colOptions.fk_child_column_id,
              });

              execQueries.push((trx, qb) =>
                trx(childTn)
                  .where({
                    [childColumn.column_name]: this.dbDriver.from(
                      qb
                        .select(parentColumn.column_name)
                        // .where(_wherePk(parentTable.primaryKeys, rowId))
                        .first()
                        .as('___cn_alias'),
                    ),
                  })
                  .update({
                    [childColumn.column_name]: null,
                  }),
              );
            }
            break;
        }
      }

      const source = await this.getSource();

      // remove FileReferences for attachments
      const attachmentColumns = columns.filter(
        (c) => c.uidt === UITypes.Attachment,
      );

      // paginate all the records and find file reference ids
      const selectQb = qb
        .clone()
        .select(
          attachmentColumns
            .map((c) => c.column_name)
            .concat(this.model.primaryKeys.map((pk) => pk.column_name)),
        );

      const response = [];

      let offset = 0;
      const limit = 100;

      const fileReferenceIds: string[] = [];

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const rows = await this.execAndParse(
          selectQb
            .clone()
            .offset(offset)
            .limit(limit + 1),
          null,
          {
            raw: true,
          },
        );

        if (rows.length === 0) {
          break;
        }

        let lastPage = false;

        if (rows.length > limit) {
          rows.pop();
        } else {
          lastPage = true;
        }

        for (const row of rows) {
          for (const c of attachmentColumns) {
            if (row[c.column_name]) {
              try {
                let attachments;
                if (typeof row[c.column_name] === 'string') {
                  attachments = JSON.parse(row[c.column_name]);
                  for (const attachment of attachments) {
                    if (attachment.id) {
                      fileReferenceIds.push(attachment.id);
                    }
                  }
                }

                if (Array.isArray(attachments)) {
                  for (const attachment of attachments) {
                    if (attachment.id) {
                      fileReferenceIds.push(attachment.id);
                    }
                  }
                }
              } catch (e) {
                // ignore error
              }
            }
          }

          const primaryData = {};

          for (const pk of this.model.primaryKeys) {
            primaryData[pk.title] = row[pk.column_name];
          }

          response.push(primaryData);
        }

        if (lastPage) {
          break;
        }

        offset += limit;
      }

      // insert records updating record details to audit table
      await this.bulkAudit({
        qb: qb.clone(),
        conditions: filterObj,
        req: cookie,
        event: AuditV1OperationTypes.DATA_BULK_DELETE,
      });

      await FileReference.delete(this.context, fileReferenceIds);

      trx = await this.dbDriver.transaction();

      // unlink LTAR data
      if (source.isMeta()) {
        for (const execQuery of execQueries) {
          await execQuery(trx, qb.clone());
        }
      }

      await qb.clone().transacting(trx).del();

      await trx.commit();

      await this.afterBulkDelete(response, this.dbDriver, cookie, true);

      return response;
    } catch (e) {
      throw e;
    }
  }

  /**
   *  Hooks
   * */

  public async handleRichTextMentions(
    _prevData,
    _newData: Record<string, any> | Array<Record<string, any>>,
    _req,
  ) {
    return;
  }

  public async beforeInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    if (!allowSystemColumn && this.model.synced) {
      NcError.badRequest('Cannot insert into synced table');
    }

    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(
    data: any,
    _trx: any,
    req,
    params?: {
      allowSystemColumn?: boolean;
    },
  ): Promise<void> {
    const { allowSystemColumn = false } = params || {};

    if (!allowSystemColumn && this.model.synced) {
      NcError.badRequest('Cannot insert into synced table');
    }

    await this.handleHooks('before.bulkInsert', null, data, req);
  }

  public async afterInsert({
    data,
    insertData,
    trx: _trx,
    req,
  }: {
    data: any;
    insertData: any;
    trx: any;
    req: NcRequest;
  }): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this.extractPksValues(data);
    const filteredAuditData = removeBlankPropsAndMask(insertData || data, [
      'CreatedAt',
      'UpdatedAt',
      // exclude virtual columns
      ...this.model.columns
        .filter((c) => isVirtualCol(c) || isSystemColumn(c))
        .map((c) => c.title),
    ]);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataInsertPayload>(
          AuditV1OperationTypes.DATA_INSERT,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(id, true),
            },
            details: {
              data: formatDataForAudit(filteredAuditData, this.model.columns),
              column_meta: extractColsMetaForAudit(
                this.model.columns,
                filteredAuditData,
              ),
            },
            req,
          },
        ),
      );
    }
    await this.handleRichTextMentions(null, data, req);
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);
    let parentAuditId;

    // disable external source audit in cloud
    if (!req.ncParentAuditId && (await this.isDataAuditEnabled())) {
      parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);

      await Audit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(
          AuditV1OperationTypes.DATA_BULK_INSERT,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );

      req.ncParentAuditId = parentAuditId;
    }

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      // data here is not mapped to column alias
      await Audit.insert(
        await Promise.all(
          data.map((d) => {
            const data = remapWithAlias({
              data: d,
              columns: this.model.columns,
            });

            return generateAuditV1Payload<DataInsertPayload>(
              AuditV1OperationTypes.DATA_INSERT,
              {
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(data, true),
                },
                details: {
                  data: formatDataForAudit(
                    removeBlankPropsAndMask(data, [
                      'created_at',
                      'updated_at',
                      'created_by',
                      'updated_by',
                    ]),
                    this.model.columns,
                  ),
                  column_meta: extractColsMetaForAudit(
                    this.model.columns,
                    data,
                  ),
                },
                req,
              },
            );
          }),
        ),
      );
    }

    await this.handleRichTextMentions(null, data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = this.extractPksValues(data);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataDeletePayload>(
          AuditV1OperationTypes.DATA_DELETE,
          {
            details: {
              data: removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
              column_meta: extractColsMetaForAudit(this.model.columns, data),
            },
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(id, true),
            },
            req,
          },
        ),
      );
    }

    await this.handleHooks('after.delete', null, data, req);
  }

  public async afterBulkDelete(
    data: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    if (!isBulkAllOperation) {
      await this.handleHooks('after.bulkDelete', null, data, req);
    }

    const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await generateAuditV1Payload<DataBulkDeletePayload>(
          AuditV1OperationTypes.DATA_BULK_DELETE,
          {
            details: {},
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
            },
            req,
            id: parentAuditId,
          },
        ),
      );
    }
    req.ncParentAuditId = parentAuditId;

    const column_meta = extractColsMetaForAudit(this.model.columns);

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      await Audit.insert(
        await Promise.all(
          data?.map?.((d) =>
            generateAuditV1Payload<DataDeletePayload>(
              AuditV1OperationTypes.DATA_DELETE,
              {
                details: {
                  data: d
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(d, ['CreatedAt', 'UpdatedAt']),
                        this.model.columns,
                      )
                    : null,
                  column_meta,
                },
                context: {
                  ...this.context,
                  source_id: this.model.source_id,
                  fk_model_id: this.model.id,
                  row_id: this.extractPksValues(d, true),
                },
                req,
              },
            ),
          ),
        ),
      );
    }
  }

  public async afterBulkUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    if (!isBulkAllOperation) {
      await this.handleHooks('after.bulkUpdate', prevData, newData, req);
    }

    if (newData && newData.length > 0) {
      const parentAuditId = await Noco.ncMeta.genNanoid(MetaTable.AUDIT);

      // disable external source audit in cloud
      if (await this.isDataAuditEnabled()) {
        await Audit.insert(
          await generateAuditV1Payload<DataBulkUpdatePayload>(
            AuditV1OperationTypes.DATA_BULK_UPDATE,
            {
              details: {},
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
              },
              req,
              id: parentAuditId,
            },
          ),
        );

        req.ncParentAuditId = parentAuditId;

        await Audit.insert(
          (
            await Promise.all(
              newData.map(async (d, i) => {
                const formattedOldData = formatDataForAudit(
                  prevData?.[i]
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(prevData?.[i], [
                          'CreatedAt',
                          'UpdatedAt',
                        ]),
                        this.model.columns,
                      )
                    : null,
                  this.model.columns,
                );
                const formattedData = formatDataForAudit(
                  d
                    ? formatDataForAudit(
                        removeBlankPropsAndMask(d, ['CreatedAt', 'UpdatedAt']),
                        this.model.columns,
                      )
                    : null,
                  this.model.columns,
                );

                const updateDiff = populateUpdatePayloadDiff({
                  keepUnderModified: true,
                  prev: formattedOldData,
                  next: formattedData,
                  exclude: extractExcludedColumnNames(this.model.columns),
                  excludeNull: false,
                  excludeBlanks: false,
                  keepNested: true,
                }) as UpdatePayload;

                if (updateDiff) {
                  return await generateAuditV1Payload<DataUpdatePayload>(
                    AuditV1OperationTypes.DATA_UPDATE,
                    {
                      context: {
                        ...this.context,
                        source_id: this.model.source_id,
                        fk_model_id: this.model.id,
                        row_id: this.extractPksValues(d, true),
                      },
                      details: {
                        old_data: updateDiff.previous_state,
                        data: updateDiff.modifications,
                        column_meta: extractColsMetaForAudit(
                          this.model.columns.filter(
                            (c) => c.title in updateDiff.modifications,
                          ),
                          d,
                          prevData?.[i],
                        ),
                      },
                      req,
                    },
                  );
                } else {
                  return [];
                }
              }),
            )
          ).flat(),
        );
      }
    }

    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async beforeUpdate(data: any, _trx: any, req): Promise<void> {
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('before.update', null, data, req);
    }
  }

  public async afterUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    updateObj?: Record<string, any>,
  ): Promise<void> {
    // TODO this is a temporary fix for the audit log / DOMPurify causes issue for long text
    const id = this.extractPksValues(newData);

    const oldData: { [key: string]: any } = {};
    const data: { [key: string]: any } = {};

    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(this.context, updateObj);

      for (const k of Object.keys(updateObj)) {
        oldData[k] = prevData[k];
        data[k] = newData[k];
      }
    } else {
      Object.assign(oldData, prevData);
      Object.assign(data, newData);
    }

    // disable external source audit in cloud
    if (await this.isDataAuditEnabled()) {
      const formattedOldData = formatDataForAudit(oldData, this.model.columns);
      const formattedData = formatDataForAudit(data, this.model.columns);

      const updateDiff = populateUpdatePayloadDiff({
        keepUnderModified: true,
        prev: formattedOldData,
        next: formattedData,
        exclude: extractExcludedColumnNames(this.model.columns),
        excludeNull: false,
        excludeBlanks: false,
        keepNested: true,
      }) as UpdatePayload;

      if (updateDiff) {
        await Audit.insert(
          await generateAuditV1Payload<DataUpdatePayload>(
            AuditV1OperationTypes.DATA_UPDATE,
            {
              context: {
                ...this.context,
                source_id: this.model.source_id,
                fk_model_id: this.model.id,
                row_id: id,
              },
              details: {
                old_data: updateDiff.previous_state,
                data: updateDiff.modifications,
                column_meta: extractColsMetaForAudit(
                  this.model.columns.filter(
                    (c) => c.title in updateDiff.modifications,
                  ),
                  data,
                  oldData,
                ),
              },
              req,
            },
          ),
        );
      }
    }

    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
    await this.handleRichTextMentions(prevData, newData, req);
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    if (this.model.synced) {
      NcError.badRequest('Cannot delete from synced table');
    }

    await this.handleHooks('before.delete', null, data, req);
  }

  public async beforeBulkDelete(_data: any, _trx: any, _req): Promise<void> {
    if (this.model.synced) {
      NcError.badRequest('Cannot delete from synced table');
    }
  }

  protected async handleHooks(hookName, prevData, newData, req): Promise<void> {
    Noco.eventEmitter.emit(HANDLE_WEBHOOK, {
      context: this.context,
      hookName,
      prevData,
      newData,
      user: req?.user,
      viewId: this.viewId,
      modelId: this.model.id,
      tnPath: this.tnPath,
    });
  }

  public async errorInsert(_e, _data, _trx, _cookie) {}

  public async errorUpdate(_e, _data, _trx, _cookie) {}

  // todo: handle composite primary key
  public extractPksValues(data: any, asString = false) {
    // if data is not object return as it is
    if (!data || typeof data !== 'object') {
      if (asString && !ncIsNull(data) && !ncIsUndefined(data)) {
        return `${data}`;
      }
      return data;
    }

    // data can be still inserted without PK

    // if composite primary key return an object with all the primary keys
    if (this.model.primaryKeys.length > 1) {
      const pkValues = {};
      for (const pk of this.model.primaryKeys) {
        pkValues[pk.title] = data[pk.title] ?? data[pk.column_name];
      }

      return asString
        ? Object.values(pkValues)
            .map((val) => val?.toString?.().replaceAll('_', '\\_'))
            .join('___')
        : pkValues;
    } else if (this.model.primaryKey) {
      let pkValue;
      if (typeof data === 'object') {
        pkValue =
          data[this.model.primaryKey.title] ??
          data[this.model.primaryKey.column_name];
      } else {
        pkValue = data;
      }
      if (pkValue !== undefined) return asString ? `${pkValue}` : pkValue;
    } else {
      return 'N/A';
    }
  }

  protected async errorDelete(_e, _id, _trx, _cookie) {}

  async validate(
    data: Record<string, any>,
    columns?: Column[],
    {
      typecast,
      allowSystemColumn,
    }: { typecast?: boolean; allowSystemColumn?: boolean } = {
      typecast: false,
      allowSystemColumn: false,
    },
  ): Promise<boolean> {
    const cols = columns || (await this.model.getColumns(this.context));
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < cols.length; ++i) {
      const column = this.model.columns[i];

      if (column.title in data) {
        if (
          isCreatedOrLastModifiedTimeCol(column) ||
          isCreatedOrLastModifiedByCol(column)
        ) {
          NcError.badRequest(
            `Column "${column.title}" is auto generated and cannot be updated`,
          );
        }

        if (
          !allowSystemColumn &&
          column.system &&
          ![UITypes.ForeignKey, UITypes.Order].includes(column.uidt)
        ) {
          NcError.badRequest(
            `Column "${column.title}" is system column and cannot be updated`,
          );
        }

        if (!allowSystemColumn && column.readonly) {
          NcError.badRequest(
            `Column "${column.title}" is readonly column and cannot be updated`,
          );
        }
      }
      try {
        await this.validateOptions(column, data);
      } catch (ex) {
        if (ex instanceof OptionsNotExistsError && typecast) {
          await Column.update(this.context, column.id, {
            ...column,
            colOptions: {
              options: [
                ...column.colOptions.options,
                ...ex.options.map((k, index) => ({
                  fk_column_id: column.id,
                  title: k,
                  color: enumColors.get(
                    'light',
                    (column.colOptions.options ?? []).length + index,
                  ),
                })),
              ],
            },
          });
        } else {
          throw ex;
        }
      }

      // Validates the constraints on the data based on the column definitions
      this.validateConstraints(column, data);

      // skip validation if `validate` is undefined or false
      if (!column?.meta?.validate || !column?.validate) continue;

      const validate = column.getValidators();
      const cn = column.column_name;
      const columnTitle = column.title;
      if (!validate) continue;

      await validateFuncOnColumn({
        value: data?.[cn] ?? data?.[columnTitle] ?? data?.[column.id],
        column,
        apiVersion: this.context.api_version,
        customValidators: customValidators as any,
      });
    }
    return true;
  }

  /*
   *  Utility method to validate database constraints
   */
  protected validateConstraints(
    column: Column<any>,
    data: Record<string, any>,
  ) {
    if (
      typeof data[column.title] === 'string' &&
      typeof column.dtxp === 'number' &&
      column.dtxp < data[column.title]?.length
    ) {
      NcError.badRequest(
        `Column "${column.title}" value exceeds the maximum length of ${column.dtxp}`,
      );
    }
  }

  public async getHighestOrderInTable(): Promise<BigNumber> {
    const orderColumn = this.model.columns.find(
      (c) => c.uidt === UITypes.Order,
    );

    if (!orderColumn) {
      return null;
    }

    const orderQuery = await this.dbDriver(this.tnPath)
      .max(`${orderColumn.column_name} as max_order`)
      .first();

    const order = new BigNumber(orderQuery ? orderQuery['max_order'] || 0 : 0);

    return order.plus(ORDER_STEP_INCREMENT);
  }

  // method for validating otpions if column is single/multi select
  protected async validateOptions(
    column: Column<any>,
    insertOrUpdateObject: Record<string, any>,
  ) {
    // if SingleSelect or MultiSelect, then validate the options
    if (
      !(
        column.uidt === UITypes.SingleSelect ||
        column.uidt === UITypes.MultiSelect
      )
    ) {
      return;
    }

    const columnTitle = column.title;
    const columnName = column.column_name;
    const columnValue =
      insertOrUpdateObject?.[columnTitle] ?? insertOrUpdateObject?.[columnName];
    if (!columnValue) {
      return;
    }

    const options = await column
      .getColOptions<{ options: SelectOption[] }>(this.context)
      .then(
        (selectOptionsMeta) =>
          selectOptionsMeta?.options?.map((opt) => opt.title) || [],
      );

    let columnValueArr: any[];

    // if multi select, then split the values if it is not an array
    if (column.uidt === UITypes.MultiSelect) {
      if (Array.isArray(columnValue)) {
        columnValueArr = columnValue;
      } else {
        columnValueArr = `${columnValue}`.split(',');
      }
    } else {
      columnValueArr = [columnValue];
    }

    const notExistedOptions: any[] = [];
    for (let j = 0; j < columnValueArr.length; ++j) {
      const val = columnValueArr[j];
      if (!options.includes(val) && !options.includes(`'${val}'`)) {
        notExistedOptions.push(val);
      }
    }
    if (notExistedOptions.length > 0) {
      NcError.optionsNotExists({
        columnTitle,
        validOptions: options,
        options: notExistedOptions,
      });
    }
  }

  async addChild({
    colId,
    rowId,
    childId,
    cookie,
    onlyUpdateAuditLogs,
    prevData,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
    onlyUpdateAuditLogs?: boolean;
    prevData?: Record<string, any>;
  }) {
    await this.model.getColumns(this.context);
    const column = this.model.columnsById[colId];

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );

    // return if onlyUpdateAuditLogs is true and is not bt column
    if (onlyUpdateAuditLogs && colOptions.type !== RelationTypes.BELONGS_TO) {
      return;
    }

    const relationManager = await RelationManager.getRelationManager(
      this,
      colId,
      { rowId, childId },
    );
    await relationManager.addChild({
      onlyUpdateAuditLogs,
      prevData,
      req: cookie,
    });

    await Promise.allSettled(
      relationManager.getAuditUpdateObj(cookie).map((updateObj) => {
        if (updateObj.opSubType === AuditOperationSubTypes.LINK_RECORD) {
          this.afterAddChild({
            columnTitle: updateObj.columnTitle,
            columnId: updateObj.columnId,
            refColumnTitle: updateObj.refColumnTitle,
            rowId: updateObj.rowId,
            refRowId: updateObj.refRowId,
            req: updateObj.req,
            model: updateObj.model,
            refModel: updateObj.refModel,
            displayValue: updateObj.displayValue,
            refDisplayValue: updateObj.refDisplayValue,
            type: updateObj.type,
          });
        }
        if (updateObj.opSubType === AuditOperationSubTypes.UNLINK_RECORD) {
          this.afterRemoveChild({
            columnTitle: updateObj.columnTitle,
            columnId: updateObj.columnId,
            refColumnTitle: updateObj.refColumnTitle,
            rowId: updateObj.rowId,
            refRowId: updateObj.refRowId,
            req: updateObj.req,
            model: updateObj.model,
            refModel: updateObj.refModel,
            displayValue: updateObj.displayValue,
            refDisplayValue: updateObj.refDisplayValue,
            type: updateObj.type,
          });
        }
      }),
    );
  }

  public async afterAddChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }

    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert(
      await generateAuditV1Payload<DataLinkPayload>(
        AuditV1OperationTypes.DATA_LINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  async afterAddOrRemoveChild(
    commonAuditObj: {
      opType: AuditV1OperationTypes;
      model: Model;
      refModel: Model;
      columnTitle: string;
      columnId: string;
      refColumnTitle: string;
      refColumnId: string;
      req: NcRequest;
    },
    auditObjs: Array<{
      rowId: unknown;
      refRowId: unknown;
      displayValue?: unknown;
      refDisplayValue?: unknown;
      type: RelationTypes;
    }>,
  ): Promise<void> {
    if (!(await this.isDataAuditEnabled())) {
      return;
    }

    const { opType, model, refModel, columnTitle, columnId, req } =
      commonAuditObj;

    // populate missing display values
    const refBaseModel = await Model.getBaseModelSQL(this.context, {
      model: refModel,
      dbDriver: this.dbDriver,
    });

    await model.getColumns(this.context);
    await refModel.getColumns(this.context);

    const missingDisplayValues = auditObjs.filter(
      (auditObj) => !auditObj.displayValue,
    );

    const missingRefDisplayValues = auditObjs.filter(
      (auditObj) => !auditObj.refDisplayValue,
    );

    const displayValueColumn = model.displayValue;
    const refDisplayValueColumn = refModel.displayValue;

    const displayValueMap = new Map<string, string>();
    const refDisplayValueMap = new Map<string, string>();

    if (missingDisplayValues.length > 0) {
      for (let i = 0; i < missingDisplayValues.length; i += 100) {
        const chunk = missingDisplayValues.slice(i * 100, (i + 1) * 100);

        const displayValues = await this.list(
          {
            pks: chunk.map((auditObj) => auditObj.rowId).join(','),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
          },
        );

        for (const displayValue of displayValues) {
          const pk = this.extractPksValues(displayValue, true);

          displayValueMap.set(pk, displayValue[displayValueColumn.title]);
        }
      }
    }

    if (missingRefDisplayValues.length > 0) {
      for (let i = 0; i < missingRefDisplayValues.length; i += 100) {
        const chunk = missingRefDisplayValues.slice(i * 100, (i + 1) * 100);

        const refDisplayValues = await refBaseModel.list(
          {
            pks: chunk.map((auditObj) => auditObj.refRowId).join(','),
          },
          {
            limitOverride: chunk.length,
            ignoreViewFilterAndSort: true,
          },
        );

        for (const refDisplayValue of refDisplayValues) {
          const pk = this.extractPksValues(refDisplayValue, true);

          refDisplayValueMap.set(
            pk,
            refDisplayValue[refDisplayValueColumn.title],
          );
        }
      }
    }

    const auditPayloads = await Promise.all(
      auditObjs.map(async (auditObj) => {
        if (!auditObj.refDisplayValue) {
          auditObj.refDisplayValue = refDisplayValueMap.get(
            `${auditObj.refRowId}`,
          );
        }
        if (!auditObj.displayValue) {
          auditObj.displayValue = displayValueMap.get(`${auditObj.rowId}`);
        }
        // Build and return the audit payload.
        return generateAuditV1Payload<DataLinkPayload>(opType, {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(auditObj.rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: auditObj.rowId,
            ref_row_id: auditObj.refRowId,
            display_value: auditObj.displayValue,
            ref_display_value: auditObj.refDisplayValue,
            type: auditObj.type,
          },
          req,
        });
      }),
    );

    await Audit.insert(auditPayloads);
  }

  async removeChild({
    colId,
    rowId,
    childId,
    cookie,
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
  }) {
    await this.model.getColumns(this.context);
    const column = this.model.columnsById[colId];
    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const relationManager = await RelationManager.getRelationManager(
      this,
      colId,
      { rowId, childId },
    );
    await relationManager.removeChild({
      req: cookie,
    });

    await Promise.allSettled(
      relationManager.getAuditUpdateObj(cookie).map(async (updateObj) => {
        await this.afterRemoveChild({
          columnTitle: updateObj.columnTitle,
          columnId: updateObj.columnId,
          refColumnTitle: updateObj.refColumnTitle,
          rowId: updateObj.rowId,
          refRowId: updateObj.refRowId,
          req: updateObj.req,
          model: updateObj.model,
          refModel: updateObj.refModel,
          displayValue: updateObj.displayValue,
          refDisplayValue: updateObj.refDisplayValue,
          type: updateObj.type,
        });
      }),
    );
  }

  public async afterRemoveChild({
    columnTitle,
    columnId,
    rowId,
    refRowId,
    req,
    model = this.model,
    refModel = this.model,
    displayValue,
    refDisplayValue,
    type,
  }: {
    columnTitle: string;
    columnId: string;
    refColumnTitle: string;
    rowId: unknown;
    refRowId: unknown;
    req: NcRequest;
    model: Model;
    refModel: Model;
    displayValue: unknown;
    refDisplayValue: unknown;
    type: RelationTypes;
  }): Promise<void> {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) {
      return;
    }
    if (!refDisplayValue) {
      refDisplayValue = await this.readByPkFromModel(
        refModel,
        undefined,
        true,
        refRowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    if (!displayValue) {
      displayValue = await this.readByPkFromModel(
        model,
        undefined,
        true,
        rowId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert(
      await generateAuditV1Payload<DataUnlinkPayload>(
        AuditV1OperationTypes.DATA_UNLINK,
        {
          context: {
            ...this.context,
            source_id: model.source_id,
            fk_model_id: model.id,
            row_id: this.extractPksValues(rowId, true) as string,
          },
          details: {
            table_title: model.title,
            ref_table_title: refModel.title,
            link_field_title: columnTitle,
            link_field_id: columnId,
            row_id: rowId,
            ref_row_id: refRowId,
            display_value: displayValue,
            ref_display_value: refDisplayValue,
            type,
          },
          req,
        },
      ),
    );
  }

  public async groupedList(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
      options?: (string | number | null | boolean)[];
    } & Partial<XcFilter>,
  ): Promise<
    {
      key: string;
      value: Record<string, unknown>[];
    }[]
  > {
    try {
      const { where, ...rest } = this._getListArgs(args as any);
      const columns = await this.model.getColumns(this.context);
      const column = columns?.find((col) => col.id === args.groupColumnId);

      if (!column) NcError.fieldNotFound(args.groupColumnId);
      if (isVirtualCol(column))
        NcError.notImplemented('Grouping for virtual columns');

      // extract distinct group column values
      let groupingValues: Set<any>;
      if (args.options?.length) {
        groupingValues = new Set(args.options);
      } else if (column.uidt === UITypes.SingleSelect) {
        const colOptions = await column.getColOptions<{
          options: SelectOption[];
        }>(this.context);
        groupingValues = new Set(
          (colOptions?.options ?? []).map((opt) => opt.title),
        );
        groupingValues.add(null);
      } else {
        groupingValues = new Set(
          (
            await this.execAndParse(
              this.dbDriver(this.tnPath).select(column.column_name).distinct(),
              null,
              { raw: true },
            )
          ).map((row) => row[column.column_name]),
        );
        groupingValues.add(null);
      }

      const qb = this.dbDriver(this.tnPath);
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await this.selectObject({ qb, extractPkAndPv: true });

      // todo: refactor and move to a method (applyFilterAndSort)
      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );
      let sorts = extractSortsObject(this.context, args?.sort, aliasColObjMap);
      const { filters: filterObj } = extractFilterFromXwhere(
        this.context,
        where,
        aliasColObjMap,
      );
      // todo: replace with view id
      if (!args.ignoreViewFilterAndSort && this.viewId) {
        await conditionV2(
          this,
          [
            new Filter({
              children:
                (await Filter.rootFilterList(this.context, {
                  viewId: this.viewId,
                })) || [],
              is_group: true,
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
        );

        if (!sorts)
          sorts = args.sortArr?.length
            ? args.sortArr
            : await Sort.list(this.context, { viewId: this.viewId });

        if (sorts?.['length']) await sortV2(this, sorts, qb);
      } else {
        await conditionV2(
          this,
          [
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and',
            }),
          ],
          qb,
        );

        if (!sorts) sorts = args.sortArr;

        if (sorts?.['length']) await sortV2(this, sorts, qb);
      }

      // sort by primary key if not autogenerated string
      // if autogenerated string sort by created_at column if present
      const orderColumn = columns.find((c) => isOrderCol(c));

      if (orderColumn) {
        qb.orderBy(orderColumn.column_name);
      } else if (this.model.primaryKey && this.model.primaryKey.ai) {
        qb.orderBy(this.model.primaryKey.column_name);
      } else if (
        this.model.columns.find((c) => c.column_name === 'created_at')
      ) {
        qb.orderBy('created_at');
      }

      const groupedQb = this.dbDriver.from(
        this.dbDriver
          .unionAll(
            [...groupingValues].map((r) => {
              const query = qb.clone();
              if (r === null) {
                query.where((qb) => {
                  qb.whereNull(column.column_name);
                  if (column.uidt === UITypes.SingleSelect) {
                    qb.orWhere(column.column_name, '=', '');
                  }
                });
              } else {
                query.where(column.column_name, r);
              }

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
          )
          .as('__nc_grouped_list'),
      );

      const proto = await this.getProto();

      const data: any[] = await this.execAndParse(groupedQb);
      const result = data?.map((d) => {
        d.__proto__ = proto;
        return d;
      });

      const groupedResult = result.reduce<Map<string | number | null, any[]>>(
        (aggObj, row) => {
          const rawVal = row[column.title];
          // Treat empty strings as null
          const val =
            typeof rawVal === 'string' && rawVal === '' ? null : rawVal;

          if (!aggObj.has(val)) {
            aggObj.set(val, []);
          }

          aggObj.get(val).push(row);

          return aggObj;
        },
        new Map(),
      );

      return [...groupingValues].map((key) => ({
        key,
        value: groupedResult.get(key) ?? [],
      }));
    } catch (e) {
      throw e;
    }
  }

  public async groupedListCount(
    args: {
      groupColumnId: string;
      ignoreViewFilterAndSort?: boolean;
    } & XcFilter,
  ) {
    const columns = await this.model.getColumns(this.context);
    const column = columns?.find((col) => col.id === args.groupColumnId);

    if (!column) NcError.fieldNotFound(args.groupColumnId);
    if (isVirtualCol(column))
      NcError.notImplemented('Grouping for virtual columns');

    const qb = this.dbDriver(this.tnPath).count('*', { as: 'count' });

    if (column.uidt === UITypes.SingleSelect) {
      qb.groupBy(
        this.dbDriver.raw(`COALESCE(NULLIF(??, ''), NULL)`, [
          column.column_name,
        ]),
      );
    } else {
      qb.groupBy(column.column_name);
    }

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const { filters: filterObj } = extractFilterFromXwhere(
      this.context,
      args.where,
      aliasColObjMap,
    );
    // todo: replace with view id

    if (!args.ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          new Filter({
            children:
              (await Filter.rootFilterList(this.context, {
                viewId: this.viewId,
              })) || [],
            is_group: true,
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
    } else {
      await conditionV2(
        this,
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and',
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        qb,
      );
    }

    await this.selectObject({
      qb,
      columns: [
        new Column({
          ...column,
          title: 'key',
          id: 'key',
        }),
      ],
    });

    return await this.execAndParse(qb);
  }

  public async execAndGetRows(query: string, trx?: Knex | CustomKnex) {
    trx = trx || this.dbDriver;

    query = this.sanitizeQuery(query);

    if (this.isPg || this.isSnowflake) {
      return (await trx.raw(query))?.rows;
    } else if (!this.isMssql && /^(\(|)select/i.test(query)) {
      return await trx.from(trx.raw(query).wrap('(', ') __nc_alias'));
    } else if (this.isMySQL && /^(\(|)insert/i.test(query)) {
      const res = await trx.raw(query);
      if (res && res[0] && res[0].insertId) {
        return res[0].insertId;
      }
      return res;
    } else {
      return await trx.raw(query);
    }
  }

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      skipJsonConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
      bulkAggregate?: boolean;
      apiVersion?: NcApiVersion;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      skipJsonConversion: false,
      raw: false,
      first: false,
      bulkAggregate: false,
      apiVersion: NcApiVersion.V2,
    },
  ) {
    if (options.raw) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
      options.skipJsonConversion = true;
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    const query = typeof qb === 'string' ? qb : qb.toQuery();

    let data = await this.execAndGetRows(query);

    if (!this.model?.columns) {
      await this.model.getColumns(this.context);
    }

    // update attachment fields
    if (!options.skipAttachmentConversion) {
      data = await this.convertAttachmentType(data, dependencyColumns);
    }

    // update date time fields
    if (!options.skipDateConversion) {
      data = this.convertDateFormat(data, dependencyColumns);
    }

    // update user fields
    if (!options.skipUserConversion) {
      data = await this.convertUserFormat(
        data,
        dependencyColumns,
        options?.apiVersion,
      );
    }

    if (!options.skipJsonConversion) {
      data = await this.convertJsonTypes(data, dependencyColumns);
    }
    if (options.apiVersion === NcApiVersion.V3) {
      data = await this.convertMultiSelectTypes(data, dependencyColumns);
    }

    if (!options.skipSubstitutingColumnIds) {
      data = await this.substituteColumnIdsWithColumnTitles(
        data,
        dependencyColumns,
      );
    }

    if (options.first) {
      return data?.[0];
    }

    return data;
  }

  protected sanitizeQuery(query: string | string[]) {
    const fn = (q: string) => {
      if (!this.isPg && !this.isMssql && !this.isSnowflake) {
        return unsanitize(q);
      } else {
        return sanitize(q);
      }
    };
    return Array.isArray(query) ? query.map(fn) : fn(query);
  }

  async runOps(ops: Promise<string>[], trx = this.dbDriver) {
    const queries = await Promise.all(ops);
    for (const query of queries) {
      await trx.raw(query);
    }
  }

  protected async substituteColumnIdsWithColumnTitles(
    data: Record<string, any>[],
    dependencyColumns?: Column[],
    aliasColumns?: Record<string, Column>,
  ) {
    const modelColumns = this.model?.columns.concat(dependencyColumns ?? []);

    if (!modelColumns || !data.length) {
      return data;
    }

    const idToAliasMap: Record<string, string> = {};
    const idToAliasPromiseMap: Record<string, Promise<string>> = {};
    const ltarMap: Record<string, boolean> = {};

    modelColumns.forEach((col) => {
      if (aliasColumns && col.id in aliasColumns) {
        aliasColumns[col.id].id = col.id;
        aliasColumns[col.id].title = col.title;
        col = aliasColumns[col.id];
      }

      idToAliasMap[col.id] = col.title;
      if ([UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(col.uidt)) {
        ltarMap[col.id] = true;
        const linkData = Object.values(data).find(
          (d) =>
            d[col.id] &&
            // we need this check because Object.keys of array exists with 0 length
            // so if it's an array we need to check if it contains item
            ((!Array.isArray(d[col.id]) && Object.keys(d[col.id])) ||
              (Array.isArray(d[col.id]) && d[col.id].length > 0)),
        );
        if (linkData) {
          if (typeof linkData[col.id] === 'object') {
            for (const k of Object.keys(
              Array.isArray(linkData[col.id])
                ? linkData[col.id][0] || {}
                : linkData[col.id],
            )) {
              const linkAlias = idToAliasMap[k];
              if (!linkAlias) {
                idToAliasPromiseMap[k] = Column.get(this.context, {
                  colId: k,
                })
                  .then((col) => {
                    return col?.title;
                  })
                  .catch((e) => {
                    return Promise.resolve(e);
                  });
              }
            }
          } else {
            // Has Many BT
            const linkAlias = idToAliasMap[col.id];
            if (!linkAlias) {
              idToAliasPromiseMap[col.id] = Column.get(this.context, {
                colId: col.id,
              })
                .then((col) => {
                  return col?.title;
                })
                .catch((e) => {
                  return Promise.resolve(e);
                });
            }
          }
        }
      } else {
        ltarMap[col.id] = false;
      }
    });

    for (const k of Object.keys(idToAliasPromiseMap)) {
      idToAliasMap[k] = await idToAliasPromiseMap[k];
      if ((idToAliasMap[k] as unknown) instanceof Error) {
        throw idToAliasMap[k];
      }
    }
    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        const alias = idToAliasMap[key];
        if (alias) {
          if (ltarMap[key]) {
            // Handle LTAR/Lookup columns
            if (ncIsArray(value) && value.length > 0 && ncIsObject(value[0])) {
              // Transform array of objects
              item[alias] = value.map((arrVal) =>
                transformObject(arrVal, idToAliasMap),
              );
            } else if (ncIsObject(value) && !ncIsArray(value)) {
              // Transform non-array objects
              item[alias] = transformObject(value, idToAliasMap);
            } else {
              // Directly assign arrays of primitives or primitive values
              item[alias] = value;
            }
          } else {
            // Non-LTAR/Lookup columns: direct assignment
            item[alias] = value;
          }
          delete item[key];
        }
      });
    });

    return data;
  }

  protected async convertUserFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
    apiVersion?: NcApiVersion,
  ) {
    // user is stored as id within the database
    // convertUserFormat is used to convert the response in id to user object in API response
    if (data) {
      let userColumns = [];

      const columns = this.model?.columns.concat(dependencyColumns ?? []);

      for (const col of columns) {
        if (col.uidt === UITypes.Lookup) {
          if (
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              (await this.getNestedColumn(col))?.uidt as UITypes,
            )
          ) {
            userColumns.push(col);
          }
        } else {
          if (
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              col.uidt,
            )
          ) {
            userColumns.push(col);
          }
        }
      }

      // filter user columns that are not present in data
      if (userColumns.length) {
        if (Array.isArray(data)) {
          const row = data[0];
          if (row) {
            userColumns = userColumns.filter((col) => col.id in row);
          }
        } else {
          userColumns = userColumns.filter((col) => col.id in data);
        }
      }

      // process user columns that are present in data
      if (userColumns.length) {
        const baseUsers = await BaseUser.getUsersList(this.context, {
          base_id: this.model.base_id,
        });

        await PresignedUrl.signMetaIconImage(baseUsers);

        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) =>
              this._convertUserFormat(userColumns, baseUsers, d, apiVersion),
            ),
          );
        } else {
          data = this._convertUserFormat(
            userColumns,
            baseUsers,
            data,
            apiVersion,
          );
        }
      }
    }
    return data;
  }

  protected _convertUserFormat(
    userColumns: Column[],
    baseUsers: Partial<User>[],
    d: Record<string, any>,
    apiVersion?: NcApiVersion,
  ) {
    try {
      if (d) {
        const availableUserColumns = userColumns.filter(
          (col) => d[col.id] && d[col.id].length,
        );
        for (const col of availableUserColumns) {
          d[col.id] = d[col.id].split(',');

          d[col.id] = d[col.id].map((fid) => {
            const { id, email, display_name, meta } = baseUsers.find(
              (u) => u.id === fid,
            );

            let metaObj: any;
            if (apiVersion !== NcApiVersion.V3) {
              metaObj = ncIsObject(meta)
                ? extractProps(meta, ['icon', 'iconType'])
                : null;
            }

            return {
              id,
              email,
              display_name: display_name?.length ? display_name : null,
              meta: metaObj,
            };
          });

          // CreatedBy and LastModifiedBy are always singular
          if ([UITypes.CreatedBy, UITypes.LastModifiedBy].includes(col.uidt)) {
            d[col.id] = d[col.id][0];
          }
        }
      }
    } catch {}
    return d;
  }

  protected async _convertAttachmentType(
    attachmentColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        const promises = [];
        for (const col of attachmentColumns) {
          if (d[col.id] && typeof d[col.id] === 'string') {
            d[col.id] = JSON.parse(d[col.id]);
          }

          if (d[col.id]?.length) {
            for (let i = 0; i < d[col.id].length; i++) {
              if (typeof d[col.id][i] === 'string') {
                d[col.id][i] = JSON.parse(d[col.id][i]);
              }

              const attachment = d[col.id][i];

              // we expect array of array of attachments in case of lookup
              if (Array.isArray(attachment)) {
                for (const lookedUpAttachment of attachment) {
                  if (lookedUpAttachment?.path) {
                    promises.push(
                      PresignedUrl.signAttachment({
                        attachment: lookedUpAttachment,
                        filename: lookedUpAttachment.title,
                      }),
                    );

                    if (!lookedUpAttachment.mimetype?.startsWith('image/')) {
                      continue;
                    }

                    lookedUpAttachment.thumbnails = {
                      tiny: {},
                      small: {},
                      card_cover: {},
                    };

                    const thumbnailPath = `thumbnails/${lookedUpAttachment.path.replace(
                      /^download[/\\]/i,
                      '',
                    )}`;

                    for (const key of Object.keys(
                      lookedUpAttachment.thumbnails,
                    )) {
                      promises.push(
                        PresignedUrl.signAttachment({
                          attachment: {
                            ...lookedUpAttachment,
                            path: `${thumbnailPath}/${key}.jpg`,
                          },
                          filename: lookedUpAttachment.title,
                          mimetype: 'image/jpeg',
                          nestedKeys: ['thumbnails', key],
                        }),
                      );
                    }
                  } else if (lookedUpAttachment?.url) {
                    if (lookedUpAttachment?.url.startsWith('data:')) {
                      continue;
                    }

                    promises.push(
                      PresignedUrl.signAttachment({
                        attachment: lookedUpAttachment,
                        filename: lookedUpAttachment.title,
                      }),
                    );

                    if (!lookedUpAttachment.mimetype?.startsWith('image/')) {
                      continue;
                    }

                    const thumbnailUrl = lookedUpAttachment.url.replace(
                      'nc/uploads',
                      'nc/thumbnails',
                    );

                    lookedUpAttachment.thumbnails = {
                      tiny: {},
                      small: {},
                      card_cover: {},
                    };

                    for (const key of Object.keys(
                      lookedUpAttachment.thumbnails,
                    )) {
                      promises.push(
                        PresignedUrl.signAttachment({
                          attachment: {
                            ...lookedUpAttachment,
                            url: `${thumbnailUrl}/${key}.jpg`,
                          },
                          filename: lookedUpAttachment.title,
                          mimetype: 'image/jpeg',
                          nestedKeys: ['thumbnails', key],
                        }),
                      );
                    }
                  }
                }
              } else {
                if (attachment?.path) {
                  promises.push(
                    PresignedUrl.signAttachment({
                      attachment,
                      filename: attachment.title,
                    }),
                  );

                  if (!attachment.mimetype?.startsWith('image/')) {
                    continue;
                  }

                  const thumbnailPath = `thumbnails/${attachment.path.replace(
                    /^download[/\\]/i,
                    '',
                  )}`;

                  attachment.thumbnails = {
                    tiny: {},
                    small: {},
                    card_cover: {},
                  };

                  for (const key of Object.keys(attachment.thumbnails)) {
                    promises.push(
                      PresignedUrl.signAttachment({
                        attachment: {
                          ...attachment,
                          path: `${thumbnailPath}/${key}.jpg`,
                        },
                        filename: attachment.title,
                        mimetype: 'image/jpeg',
                        nestedKeys: ['thumbnails', key],
                      }),
                    );
                  }
                } else if (attachment?.url) {
                  if (attachment?.url.startsWith('data:')) {
                    continue;
                  }

                  promises.push(
                    PresignedUrl.signAttachment({
                      attachment,
                      filename: attachment.title,
                    }),
                  );

                  const thumbhailUrl = attachment.url.replace(
                    'nc/uploads',
                    'nc/thumbnails',
                  );

                  attachment.thumbnails = {
                    tiny: {},
                    small: {},
                    card_cover: {},
                  };

                  for (const key of Object.keys(attachment.thumbnails)) {
                    promises.push(
                      PresignedUrl.signAttachment({
                        attachment: {
                          ...attachment,
                          url: `${thumbhailUrl}/${key}.jpg`,
                        },
                        filename: attachment.title,
                        mimetype: 'image/jpeg',
                        nestedKeys: ['thumbnails', key],
                      }),
                    );
                  }
                }
              }
            }
          }
        }
        await Promise.all(promises);
      }
    } catch {}
    return d;
  }

  protected async _convertJsonType(
    jsonColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    if (d) {
      for (const col of jsonColumns) {
        if (d[col.id] && typeof d[col.id] === 'string') {
          try {
            d[col.id] = JSON.parse(d[col.id]);
          } catch {}
        }

        if (d[col.id]?.length) {
          for (let i = 0; i < d[col.id].length; i++) {
            if (typeof d[col.id][i] === 'string') {
              try {
                d[col.id][i] = JSON.parse(d[col.id][i]);
              } catch {}
            }
          }
        }
      }
    }
    return d;
  }

  // this function is used to convert the response in string to array in API response
  protected async _convertMultiSelectType(
    multiSelectColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        for (const col of multiSelectColumns) {
          if (d[col.id] && typeof d[col.id] === 'string') {
            d[col.id] = d[col.id].split(',');
          } else if (d[col.title] && typeof d[col.title] === 'string') {
            d[col.title] = d[col.title].split(',');
          }
        }
      }
    } catch {
      // ignore
    }
    return d;
  }

  public async getNestedColumn(column: Column) {
    if (column.uidt !== UITypes.Lookup) {
      return column;
    }
    const colOptions = await column.getColOptions<LookupColumn>(this.context);
    return this.getNestedColumn(
      await colOptions?.getLookupColumn(this.context),
    );
  }

  public async convertJsonTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // buttons & AI result are stringified json in Sqlite and need to be parsed
    // converJsonTypes is used to convert the response in string to object in API response
    if (data) {
      const jsonCols = [];

      const columns = this.model?.columns.concat(dependencyColumns ?? []);

      for (const col of columns) {
        if (col.uidt === UITypes.Lookup) {
          const lookupNestedCol = await this.getNestedColumn(col);

          if (
            JSON_COLUMN_TYPES.includes(lookupNestedCol.uidt) ||
            isAIPromptCol(lookupNestedCol)
          ) {
            jsonCols.push(col);
          }
        } else {
          if (JSON_COLUMN_TYPES.includes(col.uidt) || isAIPromptCol(col)) {
            jsonCols.push(col);
          }
        }
      }

      if (jsonCols.length) {
        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) => this._convertJsonType(jsonCols, d)),
          );
        } else {
          data = await this._convertJsonType(jsonCols, data);
        }
      }
    }
    return data;
  }

  public async convertMultiSelectTypes(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    if (data) {
      const multiSelectColumns = [];

      const columns = this.model?.columns.concat(dependencyColumns ?? []);

      for (const col of columns) {
        if (col.uidt === UITypes.MultiSelect) {
          multiSelectColumns.push(col);
        }
      }

      if (multiSelectColumns.length) {
        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) =>
              this._convertMultiSelectType(multiSelectColumns, d),
            ),
          );
        } else {
          data = await this._convertMultiSelectType(multiSelectColumns, data);
        }
      }
    }
    return data;
  }

  public async convertAttachmentType(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // attachment is stored in text and parse in UI
    // convertAttachmentType is used to convert the response in string to array of object in API response
    if (data) {
      const attachmentColumns = [];

      const columns = this.model?.columns.concat(dependencyColumns ?? []);

      for (const col of columns) {
        if (col.uidt === UITypes.Lookup) {
          if ((await this.getNestedColumn(col))?.uidt === UITypes.Attachment) {
            attachmentColumns.push(col);
          }
        } else {
          if (col.uidt === UITypes.Attachment) {
            attachmentColumns.push(col);
          }
        }
      }

      if (attachmentColumns.length) {
        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) => this._convertAttachmentType(attachmentColumns, d)),
          );
        } else {
          data = await this._convertAttachmentType(attachmentColumns, data);
        }
      }
    }
    return data;
  }

  // TODO(timezone): retrieve the format from the corresponding column meta
  protected _convertDateFormat(
    dateTimeColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    if (!d) return d;
    for (const col of dateTimeColumns) {
      if (!d[col.id]) continue;

      if (col.uidt === UITypes.Formula) {
        if (!d[col.id] || typeof d[col.id] !== 'string') {
          continue;
        }

        // remove milliseconds
        if (this.isMySQL) {
          d[col.id] = d[col.id].replace(/\.000000/g, '');
        } else if (this.isMssql) {
          d[col.id] = d[col.id].replace(/\.0000000 \+00:00/g, '');
        }

        if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g.test(d[col.id])) {
          // convert ISO string (e.g. in MSSQL) to YYYY-MM-DD hh:mm:ssZ
          // e.g. 2023-05-18T05:30:00.000Z -> 2023-05-18 11:00:00+05:30
          d[col.id] = d[col.id].replace(
            /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g,
            (d: string) => {
              if (!dayjs(d).isValid()) return d;
              if (this.isSqlite) {
                // e.g. DATEADD formula
                return dayjs(d).utc().format('YYYY-MM-DD HH:mm:ssZ');
              }
              return dayjs(d).utc(true).format('YYYY-MM-DD HH:mm:ssZ');
            },
          );
          continue;
        }

        // convert all date time values to utc
        // the datetime is either YYYY-MM-DD hh:mm:ss (xcdb)
        // or YYYY-MM-DD hh:mm:ss+/-xx:yy (ext)
        d[col.id] = d[col.id].replace(
          /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:[+-]\d{2}:\d{2})?/g,
          (d: string) => {
            if (!dayjs(d).isValid()) {
              return d;
            }

            if (this.isSqlite) {
              // if there is no timezone info,
              // we assume the input is on NocoDB server timezone
              // then we convert to UTC from server timezone
              // example: datetime without timezone
              // we need to display 2023-04-27 10:00:00 (in HKT)
              // we convert d (e.g. 2023-04-27 18:00:00) to utc, i.e. 2023-04-27 02:00:00+00:00
              // if there is timezone info,
              // we simply convert it to UTC
              // example: datetime with timezone
              // e.g. 2023-04-27 10:00:00+05:30  -> 2023-04-27 04:30:00+00:00
              return dayjs(d)
                .tz(Intl.DateTimeFormat().resolvedOptions().timeZone)
                .utc()
                .format('YYYY-MM-DD HH:mm:ssZ');
            }

            // set keepLocalTime to true if timezone info is not found
            const keepLocalTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/g.test(
              d,
            );

            return dayjs(d).utc(keepLocalTime).format('YYYY-MM-DD HH:mm:ssZ');
          },
        );
        continue;
      }

      if (col.uidt === UITypes.Date) {
        const dateFormat = col.meta?.date_format;
        if (dateFormat) {
          d[col.title] = dayjs(d[col.title], dateFormat).format(dateFormat);
        }
        continue;
      }

      let keepLocalTime = true;

      if (this.isSqlite) {
        if (!col.cdf) {
          if (
            d[col.id].indexOf('-') === -1 &&
            d[col.id].indexOf('+') === -1 &&
            d[col.id].slice(-1) !== 'Z'
          ) {
            // if there is no timezone info,
            // we assume the input is on NocoDB server timezone
            // then we convert to UTC from server timezone
            // e.g. 2023-04-27 10:00:00 (IST) -> 2023-04-27 04:30:00+00:00
            d[col.id] = dayjs(d[col.id])
              .tz(Intl.DateTimeFormat().resolvedOptions().timeZone)
              .utc()
              .format('YYYY-MM-DD HH:mm:ssZ');
            continue;
          } else {
            // otherwise, we convert from the given timezone to UTC
            keepLocalTime = false;
          }
        }
      }

      if (this.isPg) {
        // postgres - timezone already attached to input
        // e.g. 2023-05-11 16:16:51+08:00
        keepLocalTime = false;
      }

      if (d[col.id] instanceof Date) {
        // e.g. MSSQL
        // Wed May 10 2023 17:47:46 GMT+0800 (Hong Kong Standard Time)
        keepLocalTime = false;
      }
      // e.g. 01.01.2022 10:00:00+05:30 -> 2022-01-01 04:30:00+00:00
      // e.g. 2023-05-09 11:41:49 -> 2023-05-09 11:41:49+00:00
      d[col.id] = dayjs(d[col.id])
        // keep the local time
        .utc(keepLocalTime)
        // show the timezone even for Mysql
        .format('YYYY-MM-DD HH:mm:ssZ');
    }
    return d;
  }

  public convertDateFormat(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // Show the date time in UTC format in API response
    // e.g. 2022-01-01 04:30:00+00:00
    if (data) {
      const columns = this.model?.columns.concat(dependencyColumns ?? []);
      const dateTimeColumns = columns.filter(
        (c) =>
          c.uidt === UITypes.DateTime ||
          c.uidt === UITypes.Date ||
          isCreatedOrLastModifiedTimeCol(c) ||
          c.uidt === UITypes.Formula,
      );
      if (dateTimeColumns.length) {
        if (Array.isArray(data)) {
          data = data.map((d) => this._convertDateFormat(dateTimeColumns, d));
        } else {
          data = this._convertDateFormat(dateTimeColumns, data);
        }
      }
    }
    return data;
  }

  async addLinks(params: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) {
    return addOrRemoveLinks(this).addLinks(params);
  }

  async removeLinks(params: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) {
    return addOrRemoveLinks(this).removeLinks(params);
  }

  async btRead(
    { colId, id }: { colId; id; apiVersion?: NcApiVersion },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      await this.model.getColumns(this.context);

      const { where, sort } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = this.model.columnsById[colId];

      const row = await this.execAndParse(
        this.dbDriver(this.tnPath).where(await this._wherePk(id)),
        null,
        { raw: true, first: true },
      );

      // validate rowId
      if (!row) {
        NcError.recordNotFound(id);
      }

      const parentCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getParentColumn(this.context);
      const parentTable = await parentCol.getModel(this.context);
      const chilCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getChildColumn(this.context);
      const childTable = await chilCol.getModel(this.context);

      const parentModel = await Model.getBaseModelSQL(this.context, {
        model: parentTable,
        dbDriver: this.dbDriver,
      });
      await childTable.getColumns(this.context);

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const qb = this.dbDriver(parentTn);
      await this.applySortAndFilter({ table: parentTable, where, qb, sort });

      qb.where(
        parentCol.column_name,
        this.dbDriver(childTn)
          .select(chilCol.column_name)
          .where(_wherePk(childTable.primaryKeys, id)),
      );

      await parentModel.selectObject({ qb, fieldsSet: args.fieldSet });

      const parent = await this.execAndParse(
        qb,
        await parentTable.getColumns(this.context),
        {
          first: true,
        },
      );

      const proto = await parentModel.getProto();

      if (parent) {
        parent.__proto__ = proto;
      }
      return parent;
    } catch (e) {
      throw e;
    }
  }

  async updateLastModified({
    rowIds,
    cookie,
    model = this.model,
    knex = this.dbDriver,
    baseModel = this,
  }: {
    rowIds: any | any[];
    cookie?: { user?: any };
    model?: Model;
    knex?: XKnex;
    baseModel?: BaseModelSqlv2;
  }) {
    const columns = await model.getColumns(this.context);

    const updateObject = {};

    const lastModifiedTimeColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedTime && c.system,
    );

    const lastModifiedByColumn = columns.find(
      (c) => c.uidt === UITypes.LastModifiedBy && c.system,
    );

    if (lastModifiedTimeColumn) {
      updateObject[lastModifiedTimeColumn.column_name] = this.now();
    }

    if (lastModifiedByColumn) {
      updateObject[lastModifiedByColumn.column_name] = cookie?.user?.id;
    }

    if (Object.keys(updateObject).length === 0) return;

    const qb = knex(baseModel.getTnPath(model.table_name)).update(updateObject);

    for (const rowId of Array.isArray(rowIds) ? rowIds : [rowIds]) {
      qb.orWhere(_wherePk(model.primaryKeys, rowId));
    }

    await this.execAndParse(qb, null, { raw: true });
  }

  findIntermediateOrder(before: BigNumber, after: BigNumber): BigNumber {
    if (after.lte(before)) {
      NcError.cannotCalculateIntermediateOrderError();
    }
    return before.plus(after.minus(before).div(2));
  }

  async getUniqueOrdersBeforeItem(before: unknown, amount = 1, depth = 0) {
    try {
      if (depth > MAX_RECURSION_DEPTH) {
        NcError.reorderFailed();
      }

      const orderColumn = this.model.columns.find((c) => isOrderCol(c));
      if (!orderColumn) {
        return;
      }

      if (!before) {
        const highestOrder = await this.getHighestOrderInTable();

        return Array.from({ length: amount }).map((_, i) => {
          return highestOrder.plus(i + 1);
        });
      }

      const row = await this.readByPk(
        before,
        false,
        {},
        { extractOrderColumn: true },
      );

      if (!row) {
        return await this.getUniqueOrdersBeforeItem(null, amount, depth);
      }

      const currentRowOrder = new BigNumber(row[orderColumn.title] ?? 0);

      const resultQuery = this.dbDriver(this.tnPath)
        .where(orderColumn.column_name, '<', currentRowOrder.toString())
        .max(orderColumn.column_name + ' as maxOrder')
        .first();

      const result = await resultQuery;

      const adjacentOrder = new BigNumber(result.maxOrder || 0);

      const orders = [];

      for (let i = 0; i < amount; i++) {
        const intermediateOrder = this.findIntermediateOrder(
          adjacentOrder.plus(i),
          currentRowOrder,
        );

        if (
          intermediateOrder.eq(adjacentOrder) ||
          intermediateOrder.eq(currentRowOrder)
        ) {
          throw NcError.cannotCalculateIntermediateOrderError();
        }

        orders.push(intermediateOrder);
      }

      return orders;
    } catch (error) {
      if (error.error === NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER) {
        console.error('Error in getUniqueOrdersBeforeItem:', error);
        await this.recalculateFullOrder();
        return await this.getUniqueOrdersBeforeItem(before, amount, depth + 1);
      }
      throw error;
    }
  }

  async recalculateFullOrder() {
    const primaryKeys = this.model.primaryKeys.map((pk) => pk.column_name);

    const sql = {
      mysql2: {
        modern: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`, // 8.0+
        legacy: {
          // 5.x and below
          init: 'SET @row_number = 0;',
          update:
            'UPDATE ?? SET ?? = (@row_number:=@row_number+1) ORDER BY ?? ASC',
        },
      },
      pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ${primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE ${this.model.primaryKeys
        .map((_pk) => `t.?? = s.??`)
        .join(' AND ')}`,
      sqlite3: `WITH rn AS (SELECT ${this.model.primaryKeys
        .map((_pk) => `??`)
        .join(
          ', ',
        )}, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE ${this.model.primaryKeys
        .map((_pk) => `rn.?? = ??.??`)
        .join(' AND ')})`,
    };

    const orderColumn = this.model.columns.find((c) => isOrderCol(c));
    if (!orderColumn) {
      NcError.badRequest('Order column not found to recalculateOrder');
    }

    const client = this.dbDriver.client.config.client;
    if (!sql[client]) {
      NcError.notImplemented(
        'Recalculate order not implemented for this database',
      );
    }

    const params = {
      mysql2: [this.tnPath, orderColumn.column_name, orderColumn.column_name],
      pg: [
        this.tnPath,
        orderColumn.column_name,
        orderColumn.column_name,
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        ...primaryKeys.flatMap((pk) => [pk, pk]), // Flatten pk array for binding
      ],
      sqlite3: [
        ...primaryKeys,
        orderColumn.column_name,
        this.tnPath,
        this.tnPath,
        orderColumn.column_name,
        ...primaryKeys.flatMap((pk) => [pk, this.tnPath, pk]), // Flatten pk array for binding
      ],
    };

    // For MySQL, check version and use appropriate query
    if (client === 'mysql2') {
      const version = await this.execAndGetRows('SELECT VERSION()');
      const isMySql8Plus = parseFloat(version[0]?.[0]?.['VERSION()']) >= 8.0;

      if (isMySql8Plus) {
        await this.execAndGetRows(
          this.dbDriver.raw(sql[client].modern, params[client]).toQuery(),
        );
      } else {
        await this.execAndGetRows(sql[client].legacy.init);
        await this.execAndGetRows(
          this.dbDriver
            .raw(sql[client].legacy.update, params[client])
            .toQuery(),
        );
      }
    } else {
      const query = this.dbDriver.raw(sql[client], params[client]).toQuery();
      await this.execAndGetRows(query);
    }
  }

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any; system?: boolean },
    // oldData uses title as key whereas data uses column_name as key
    oldData?,
    extra?: {
      raw?: boolean;
      ncOrder?: BigNumber;
      before?: string;
      undo?: boolean;
    },
  ): Promise<void> {
    for (const column of this.model.columns) {
      if (
        ![
          UITypes.Attachment,
          UITypes.JSON,
          UITypes.User,
          UITypes.CreatedTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedBy,
          UITypes.LastModifiedBy,
          UITypes.LongText,
          UITypes.MultiSelect,
          UITypes.Order,
        ].includes(column.uidt) ||
        (column.uidt === UITypes.LongText &&
          column.meta?.[LongTextAiMetaProp] !== true)
      )
        continue;

      if (column.system) {
        if (isInsertData) {
          if (column.uidt === UITypes.CreatedTime) {
            data[column.column_name] = this.now();
          } else if (column.uidt === UITypes.CreatedBy) {
            data[column.column_name] = cookie?.user?.id;
          } else if (column.uidt === UITypes.Order && !extra?.undo) {
            if (extra?.before) {
              data[column.column_name] = (
                await this.getUniqueOrdersBeforeItem(extra?.before, 1)
              )[0].toString();
            } else {
              data[column.column_name] = (
                extra?.ncOrder ?? (await this.getHighestOrderInTable())
              ).toString();
            }
          }
        }
        if (column.uidt === UITypes.LastModifiedTime) {
          data[column.column_name] = isInsertData ? null : this.now();
        } else if (column.uidt === UITypes.LastModifiedBy) {
          data[column.column_name] = isInsertData ? null : cookie?.user?.id;
        }
      }
      if (column.uidt === UITypes.Attachment) {
        if (column.column_name in data) {
          if (data && data[column.column_name]) {
            try {
              if (typeof data[column.column_name] === 'string') {
                data[column.column_name] = JSON.parse(data[column.column_name]);
              }

              if (
                data[column.column_name] &&
                !Array.isArray(data[column.column_name])
              ) {
                NcError.invalidAttachmentJson(data[column.column_name]);
              }
            } catch (e) {
              NcError.invalidAttachmentJson(data[column.column_name]);
            }

            // Confirm that all urls are valid urls
            for (const attachment of data[column.column_name] || []) {
              if (!('url' in attachment) && !('path' in attachment)) {
                NcError.unprocessableEntity(
                  'Attachment object must contain either url or path',
                );
              }

              if (attachment.url) {
                if (attachment.url.startsWith('data:')) {
                  NcError.unprocessableEntity(
                    `Attachment urls do not support data urls`,
                  );
                }

                if (attachment.url.length > 8 * 1024) {
                  NcError.unprocessableEntity(
                    `Attachment url '${attachment.url}' is too long`,
                  );
                }
              }
            }
          }

          if (oldData && oldData[column.title]) {
            try {
              if (typeof oldData[column.title] === 'string') {
                oldData[column.title] = JSON.parse(oldData[column.title]);
              }
            } catch (e) {}
          }

          const regenerateIds = [];

          if (!isInsertData) {
            const oldAttachmentMap = new Map<
              string,
              { url?: string; path?: string }
            >(
              oldData &&
              oldData[column.title] &&
              Array.isArray(oldData[column.title])
                ? oldData[column.title]
                    .filter((att) => att.id)
                    .map((att) => [att.id, att])
                : [],
            );

            const newAttachmentMap = new Map<
              string,
              { url?: string; path?: string }
            >(
              data[column.column_name] &&
              Array.isArray(data[column.column_name])
                ? data[column.column_name]
                    .filter((att) => att.id)
                    .map((att) => [att.id, att])
                : [],
            );

            const deleteIds = [];

            for (const [oldId, oldAttachment] of oldAttachmentMap) {
              if (!newAttachmentMap.has(oldId)) {
                deleteIds.push(oldId);
              } else if (
                (oldAttachment.url &&
                  oldAttachment.url !== newAttachmentMap.get(oldId).url) ||
                (oldAttachment.path &&
                  oldAttachment.path !== newAttachmentMap.get(oldId).path)
              ) {
                deleteIds.push(oldId);
                regenerateIds.push(oldId);
              }
            }

            if (deleteIds.length) {
              await FileReference.delete(this.context, deleteIds);
            }

            for (const [newId, newAttachment] of newAttachmentMap) {
              if (!oldAttachmentMap.has(newId)) {
                regenerateIds.push(newId);
              } else if (
                (newAttachment.url &&
                  newAttachment.url !== oldAttachmentMap.get(newId).url) ||
                (newAttachment.path &&
                  newAttachment.path !== oldAttachmentMap.get(newId).path)
              ) {
                regenerateIds.push(newId);
              }
            }
          }

          const sanitizedAttachments = [];
          if (Array.isArray(data[column.column_name])) {
            for (const attachment of data[column.column_name]) {
              if (!('url' in attachment) && !('path' in attachment)) {
                NcError.unprocessableEntity(
                  'Attachment object must contain either url or path',
                );
              }
              const sanitizedAttachment = extractProps(attachment, [
                'id',
                'url',
                'path',
                'title',
                'mimetype',
                'size',
                'icon',
                'width',
                'height',
              ]);

              if (
                isInsertData ||
                !sanitizedAttachment.id ||
                regenerateIds.includes(sanitizedAttachment.id)
              ) {
                const source = await this.getSource();
                sanitizedAttachment.id = await FileReference.insert(
                  this.context,
                  {
                    file_url:
                      sanitizedAttachment.url ?? sanitizedAttachment.path,
                    file_size: sanitizedAttachment.size,
                    fk_user_id: cookie?.user?.id ?? 'anonymous',
                    source_id: source.id,
                    fk_model_id: this.model.id,
                    fk_column_id: column.id,
                    is_external: !source.isMeta(),
                  },
                );
              }

              sanitizedAttachments.push(sanitizedAttachment);
            }
          }

          data[column.column_name] = sanitizedAttachments.length
            ? JSON.stringify(sanitizedAttachments)
            : null;
        }
      } else if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          column.uidt,
        )
      ) {
        if (data[column.column_name]) {
          const userIds = [];

          if (
            typeof data[column.column_name] === 'string' &&
            /^\s*[{[]/.test(data[column.column_name])
          ) {
            try {
              data[column.column_name] = JSON.parse(data[column.column_name]);
            } catch (e) {}
          }

          const baseUsers = await BaseUser.getUsersList(this.context, {
            base_id: this.model.base_id,
            // deleted user may still exists on some fields
            // it's still valid as a historical record
            include_ws_deleted: true,
          });

          if (typeof data[column.column_name] === 'object') {
            const users: { id?: string; email?: string }[] = Array.isArray(
              data[column.column_name],
            )
              ? data[column.column_name]
              : [data[column.column_name]];
            for (const userObj of users) {
              const user = extractProps(userObj, ['id', 'email']);
              try {
                if ('id' in user) {
                  const u = baseUsers.find((u) => u.id === user.id);
                  if (!u) {
                    NcError.unprocessableEntity(
                      `User with id '${user.id}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else if ('email' in user) {
                  // skip null input
                  if (!user.email) continue;
                  // trim extra spaces
                  user.email = user.email.trim();
                  // skip empty input
                  if (user.email.length === 0) continue;
                  const u = baseUsers.find((u) => u.email === user.email);
                  if (!u) {
                    NcError.unprocessableEntity(
                      `User with email '${user.email}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else {
                  NcError.unprocessableEntity('Invalid user object');
                }
              } catch (e) {
                NcError.unprocessableEntity(e.message);
              }
            }
          } else if (typeof data[column.column_name] === 'string') {
            const users = data[column.column_name]
              .split(',')
              .map((u) => u.trim());
            for (const user of users) {
              try {
                if (user.length === 0) continue;
                if (user.includes('@')) {
                  const u = baseUsers.find((u) => u.email === user);
                  if (!u) {
                    NcError.unprocessableEntity(
                      `User with email '${user}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                } else {
                  const u = baseUsers.find((u) => u.id === user);
                  if (!u) {
                    NcError.unprocessableEntity(
                      `User with id '${user}' is not part of this workspace`,
                    );
                  }
                  userIds.push(u.id);
                }
              } catch (e) {
                NcError.unprocessableEntity(e.message);
              }
            }
          } else {
            logger.error(
              `${data[column.column_name]} is not a valid user input`,
            );
            NcError.unprocessableEntity('Invalid user object');
          }

          if (userIds.length === 0) {
            data[column.column_name] = null;
          } else {
            const userSet = new Set(userIds);

            if (userSet.size !== userIds.length) {
              NcError.unprocessableEntity(
                'Duplicate users not allowed for user field',
              );
            }

            if (column.meta?.is_multi) {
              data[column.column_name] = userIds.join(',');
            } else {
              if (userIds.length > 1) {
                NcError.unprocessableEntity(
                  `Multiple users not allowed for '${column.title}'`,
                );
              } else {
                data[column.column_name] = userIds[0];
              }
            }
          }
        }
      } else if (UITypes.JSON === column.uidt) {
        if (
          data[column.column_name] &&
          typeof data[column.column_name] !== 'string'
        ) {
          data[column.column_name] = JSON.stringify(data[column.column_name]);
        }
      } else if (UITypes.MultiSelect === column.uidt) {
        if (
          data[column.column_name] &&
          Array.isArray(data[column.column_name])
        ) {
          data[column.column_name] = data[column.column_name].join(',');
        }
      } else if (isAIPromptCol(column) && !extra?.raw) {
        if (data[column.column_name]) {
          let value = data[column.column_name];

          if (typeof value === 'object') {
            value = value.value;
          }

          const obj: {
            value?: string;
            lastModifiedBy?: string;
            lastModifiedTime?: string;
            isStale?: string;
          } = {};

          if (cookie?.system === true) {
            Object.assign(obj, {
              value,
              lastModifiedBy: null,
              lastModifiedTime: null,
              isStale: false,
            });
          } else {
            const oldObj = oldData?.[column.title];
            const isStale = oldObj ? oldObj.isStale : false;

            const isModified = oldObj?.value !== value;

            Object.assign(obj, {
              value,
              lastModifiedBy: isModified
                ? cookie?.user?.id
                : oldObj?.lastModifiedBy,
              lastModifiedTime: isModified
                ? this.now()
                : oldObj?.lastModifiedTime,
              isStale: isModified ? false : isStale,
            });
          }

          data[column.column_name] = JSON.stringify(obj);
        }
      }
    }
  }

  public now() {
    return dayjs()
      .utc()
      .format(
        this.isMySQL || this.isMssql
          ? 'YYYY-MM-DD HH:mm:ss'
          : 'YYYY-MM-DD HH:mm:ssZ',
      );
  }

  async getCustomConditionsAndApply(params: {
    view?: View;
    column: Column<any>;
    qb?;
    filters?;
    args;
    rowId;
    columns?: Column[];
  }): Promise<any> {
    const { filters, qb, view } = params;
    await conditionV2(
      this,
      [
        ...(view
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList(this.context, {
                    viewId: view.id,
                  })) || [],
                is_group: true,
              }),
            ]
          : []),
        new Filter({
          children: filters,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );
  }

  async getSource() {
    // return this.source if defined or fetch and return
    return (
      this.source ||
      (this.source = await Source.get(this.context, this.model.source_id))
    );
  }

  protected async clearFileReferences(args: {
    oldData?: Record<string, any>[] | Record<string, any>;
    columns?: Column[];
  }) {
    const { oldData: _oldData, columns } = args;
    const oldData = Array.isArray(_oldData) ? _oldData : [_oldData];

    const modelColumns = columns || (await this.model.getColumns(this.context));

    const attachmentColumns = modelColumns.filter(
      (c) => c.uidt === UITypes.Attachment,
    );

    if (attachmentColumns.length === 0) return;

    for (const column of attachmentColumns) {
      const oldAttachments = [];

      if (oldData) {
        for (const row of oldData) {
          let attachmentRecord = row[column.title];
          if (attachmentRecord) {
            try {
              if (typeof attachmentRecord === 'string') {
                attachmentRecord = JSON.parse(row[column.title]);
              }
              for (const attachment of attachmentRecord) {
                oldAttachments.push(attachment);
              }
            } catch (e) {
              logger.error(e);
            }
          }
        }
      }

      if (oldAttachments.length === 0) continue;

      await FileReference.delete(
        this.context,
        oldAttachments.filter((at) => at.id).map((at) => at.id),
      );
    }
  }

  protected async bulkAudit({
    qb,
    data,
    conditions,
    req,
    event,
  }: {
    qb: any;
    data?: Record<string, any>;
    conditions: FilterType[];
    req: NcRequest;
    event: BulkAuditV1OperationTypes;
  }) {
    try {
      let batchStart = 0;
      const batchSize = 1000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const pkQb = qb
          .clone()
          .clear('select')
          .select(
            this.dbDriver.raw('?? as ??', [
              this.model.primaryKey.column_name,
              this.model.primaryKey.title,
            ]),
          )
          .limit(batchSize)
          .offset(batchStart)
          .orderBy(this.model.primaryKey.column_name);

        // if bulk update include old data as well
        if (event === AuditV1OperationTypes.DATA_BULK_UPDATE) {
          await this.selectObject({
            qb: pkQb,
            fields: Object.keys(data),
          });
        }

        const ids = await this.execAndParse(pkQb);

        if (!ids?.length) break;

        if (event === AuditV1OperationTypes.DATA_BULK_UPDATE) {
          await this.bulkUpdateAudit({
            rowIds: ids,
            req,
            conditions,
            data,
          });
        } else if (event === AuditV1OperationTypes.DATA_BULK_DELETE) {
          await this.bulkDeleteAudit({
            rowIds: ids,
            req,
            conditions,
          });
        }
        batchStart += batchSize;
      }
    } catch (e) {
      logger.error(e.message, e.stack);
    }
  }

  public async bulkUpdateAudit({
    rowIds,
    req,
    conditions,
    data,
  }: {
    rowIds: any[];
    conditions: FilterType[];
    data?: Record<string, any>;
    req: NcRequest;
  }) {
    // disable external source audit in cloud
    if (!(await this.isDataAuditEnabled())) return;

    const auditUpdateObj = [];
    for (const rowId of rowIds) {
      auditUpdateObj.push(
        await generateAuditV1Payload<DataBulkUpdateAllPayload>(
          AuditV1OperationTypes.DATA_BULK_ALL_UPDATE,
          {
            context: {
              ...this.context,
              source_id: this.model.source_id,
              fk_model_id: this.model.id,
              row_id: this.extractPksValues(rowId, true),
            },
            details: {
              data: removeBlankPropsAndMask(data, ['CreatedAt', 'UpdatedAt']),
              old_data: removeBlankPropsAndMask(rowId, [
                'CreatedAt',
                'UpdatedAt',
              ]),
              conditions: conditions,
              column_meta: extractColsMetaForAudit(this.model.columns, data),
            },
            req,
          },
        ),
      );
    }
    await Audit.insert(auditUpdateObj);
  }

  protected async bulkDeleteAudit(_: {
    rowIds: any[];
    conditions: FilterType[];
    req: NcRequest;
  }) {
    // placeholder
  }

  async isDataAuditEnabled() {
    return isDataAuditEnabledFn() as boolean;
  }

  getViewId() {
    return this.viewId;
  }

  async statsUpdate(_args: { count: number }) {}
}

export { BaseModelSqlv2 };
