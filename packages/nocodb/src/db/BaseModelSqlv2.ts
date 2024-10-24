import autoBind from 'auto-bind';
import groupBy from 'lodash/groupBy';
import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone';
import equal from 'fast-deep-equal';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import Validator from 'validator';
import { customAlphabet } from 'nanoid';
import DOMPurify from 'isomorphic-dompurify';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@nestjs/common';
import type { SortType } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type LookupColumn from '~/models/LookupColumn';
import type { XKnex } from '~/db/CustomKnex';
import type {
  XcFilter,
  XcFilterWithAlias,
} from '~/db/sql-data-mapper/lib/BaseModel';
import type CustomKnex from '~/db/CustomKnex';
import type { NcContext } from '~/interface/config';
import type {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  QrCodeColumn,
  RollupColumn,
  SelectOption,
  User,
} from '~/models';
import { nocoExecute } from '~/utils';
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
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import { customValidators } from '~/db/util/customValidators';
import { extractLimitAndOffset } from '~/helpers';
import { NcError } from '~/helpers/catchError';
import getAst from '~/helpers/getAst';
import { sanitize, unsanitize } from '~/helpers/sqlSanitize';
import Noco from '~/Noco';
import { HANDLE_WEBHOOK } from '~/services/hook-handler.service';
import {
  COMPARISON_OPS,
  COMPARISON_SUB_OPS,
  GROUPBY_COMPARISON_OPS,
  IS_WITHIN_COMPARISON_SUB_OPS,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { getAliasGenerator } from '~/utils';
import applyAggregation from '~/db/aggregation';

dayjs.extend(utc);

dayjs.extend(timezone);

const logger = new Logger('BaseModelSqlv2');

const GROUP_COL = '__nc_group_id';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

const isPrimitiveType = (val) =>
  typeof val === 'string' || typeof val === 'number';

export async function populatePk(
  context: NcContext,
  model: Model,
  insertObj: any,
) {
  await model.getColumns(context);
  for (const pkCol of model.primaryKeys) {
    if (!pkCol.meta?.ag || insertObj[pkCol.title]) continue;
    insertObj[pkCol.title] =
      pkCol.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
  }
}

function checkColumnRequired(
  column: Column<any>,
  fields: string[],
  extractPkAndPv?: boolean,
) {
  // if primary key or foreign key included in fields, it's required
  if (column.pk || column.uidt === UITypes.ForeignKey) return true;

  if (extractPkAndPv && column.pv) return true;

  // check fields defined and if not, then select all
  // if defined check if it is in the fields
  return !fields || fields.includes(column.title);
}

export async function getColumnName(
  context: NcContext,
  column: Column<any>,
  columns?: Column[],
) {
  if (
    !isCreatedOrLastModifiedTimeCol(column) &&
    !isCreatedOrLastModifiedByCol(column)
  )
    return column.column_name;
  columns =
    columns ||
    (await Column.list(context, { fk_model_id: column.fk_model_id }));

  switch (column.uidt) {
    case UITypes.CreatedTime: {
      const createdTimeSystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.CreatedTime,
      );
      if (createdTimeSystemCol) return createdTimeSystemCol.column_name;
      return column.column_name || 'created_at';
    }
    case UITypes.LastModifiedTime: {
      const lastModifiedTimeSystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.LastModifiedTime,
      );
      if (lastModifiedTimeSystemCol)
        return lastModifiedTimeSystemCol.column_name;
      return column.column_name || 'updated_at';
    }
    case UITypes.CreatedBy: {
      const createdBySystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.CreatedBy,
      );
      if (createdBySystemCol) return createdBySystemCol.column_name;
      return column.column_name || 'created_by';
    }
    case UITypes.LastModifiedBy: {
      const lastModifiedBySystemCol = columns.find(
        (col) => col.system && col.uidt === UITypes.LastModifiedBy,
      );
      if (lastModifiedBySystemCol) return lastModifiedBySystemCol.column_name;
      return column.column_name || 'updated_by';
    }
    default:
      return column.column_name;
  }
}

export function getAs(column: Column) {
  return column.asId || column.id;
}

export function replaceDynamicFieldWithValue(
  _row: any,
  _rowId,
  _tableColumns: Column[],
  _readByPk: typeof BaseModelSqlv2.prototype.readByPk,
  _queryParams?: Record<string, string>,
) {
  const replaceWithValue = async (conditions: Filter[]) => {
    return conditions;
  };
  return replaceWithValue;
}

function transformObject(value, idToAliasMap) {
  const result = {};
  Object.entries(value).forEach(([k, v]) => {
    const btAlias = idToAliasMap[k];
    if (btAlias) {
      result[btAlias] = v;
    }
  });
  return result;
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 {
  protected _dbDriver: XKnex;
  protected viewId: string;
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
    this.viewId = viewId;
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
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      extractOnlyPrimaries?: boolean;
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
      });
    } catch (e) {
      if (
        validateFormula ||
        !haveFormulaColumn(await this.model.getColumns(this.context))
      )
        throw e;
      logger.log(e);
      return this.readByPk(id, true);
    }

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }

    return data ? await nocoExecute(ast, data, {}, parsedQuery) : null;
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
    const sorts = extractSortsObject(rest?.sort, aliasColObjMap);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

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

    if (Array.isArray(sorts) && sorts?.length) {
      await sortV2(this, sorts, qb);
    } else if (this.model.primaryKey) {
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
      const proto = await this.getProto();
      data.__proto__ = proto;
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
      rest?.sort,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );
    const filterObj = extractFilterFromXwhere(
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

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (this.model.primaryKey && this.model.primaryKey.ai) {
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
      data = await this.execAndParse(qb);
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
    const filterObj = extractFilterFromXwhere(
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

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
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
    try {
      const columns = await this.model.getColumns(this.context);
      const aliasColObjMap = await this.model.getAliasColObjMap(
        this.context,
        columns,
      );
      const selectors = [] as Array<Knex.Raw>;

      const viewFilterList = await Filter.rootFilterList(this.context, {
        viewId: this.viewId,
      });

      if (!bulkFilterList?.length) {
        return NcError.badRequest('bulkFilterList is required');
      }

      for (const f of bulkFilterList) {
        const { where, ...rest } = this._getListArgs(f);
        const groupBySelectors = [];
        const groupByColumns: Record<string, Column> = {};

        const getAlias = getAliasGenerator('__nc_gb');
        const groupFilter = extractFilterFromXwhere(f.where, aliasColObjMap);

        const tQb = this.dbDriver(this.tnPath);
        const colSelectors = [];

        await Promise.all(
          rest.column_name.split(',').map(async (col) => {
            let column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );

            // if qrCode or Barcode replace it with value column nd keep the alias
            if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
              column = new Column({
                ...(await column
                  .getColOptions<BarcodeColumn | QrCodeColumn>(this.context)
                  .then((col) => col.getValueColumn(this.context))),
                asId: column.id,
              });
            }

            groupByColumns[getAs(column)] = column;

            switch (column.uidt) {
              case UITypes.Attachment:
                NcError.badRequest(
                  'Group by using attachment column is not supported',
                );
                break;
              case UITypes.Button: {
                NcError.badRequest(
                  'Group by using Button column is not supported',
                );
                break;
              }
              case UITypes.Links:
              case UITypes.Rollup:
                colSelectors.push(
                  (
                    await genRollupSelectv2({
                      baseModelSqlv2: this,
                      knex: this.dbDriver,
                      columnOptions: (await column.getColOptions(
                        this.context,
                      )) as RollupColumn,
                    })
                  ).builder.as(getAs(column)),
                );
                groupBySelectors.push(getAs(column));
                break;
              case UITypes.Formula: {
                let selectQb;
                try {
                  const _selectQb = await this.getSelectQueryBuilderForFormula(
                    column,
                  );
                  selectQb = this.dbDriver.raw(`?? as ??`, [
                    _selectQb.builder,
                    getAs(column),
                  ]);
                } catch (e) {
                  console.log(e);
                  selectQb = this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]);
                }
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }

              case UITypes.Lookup:
              case UITypes.LinkToAnotherRecord: {
                const _selectQb = await generateLookupSelectQuery({
                  baseModelSqlv2: this,
                  column,
                  alias: null,
                  model: this.model,
                  getAlias,
                });
                const selectQb = this.dbDriver.raw(`?? as ??`, [
                  this.dbDriver.raw(_selectQb.builder).wrap('(', ')'),
                  getAs(column),
                ]);
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }
              case UITypes.DateTime:
              case UITypes.CreatedTime:
              case UITypes.LastModifiedTime:
                {
                  const columnName = await getColumnName(
                    this.context,
                    column,
                    columns,
                  );
                  // ignore seconds part in datetime and group
                  if (this.dbDriver.clientType() === 'pg') {
                    colSelectors.push(
                      this.dbDriver.raw(
                        "date_trunc('minute', ??) + interval '0 seconds' as ??",
                        [columnName, getAs(column)],
                      ),
                    );
                  } else if (
                    this.dbDriver.clientType() === 'mysql' ||
                    this.dbDriver.clientType() === 'mysql2'
                  ) {
                    colSelectors.push(
                      // this.dbDriver.raw('??::date as ??', [columnName, getAs(column)]),
                      this.dbDriver.raw(
                        "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND) as ??",
                        [columnName, columnName, getAs(column)],
                      ),
                    );
                  } else if (this.dbDriver.clientType() === 'sqlite3') {
                    colSelectors.push(
                      this.dbDriver.raw(
                        `strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
   CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   ELSE
    '+00:00'
   END) AS :id:`,
                        {
                          column: columnName,
                          id: getAs(column),
                        },
                      ),
                    );
                  } else {
                    colSelectors.push(
                      this.dbDriver.raw('DATE(??) as ??', [
                        columnName,
                        getAs(column),
                      ]),
                    );
                  }
                  groupBySelectors.push(getAs(column));
                }
                break;
              default: {
                const columnName = await getColumnName(
                  this.context,
                  column,
                  columns,
                );
                colSelectors.push(
                  this.dbDriver.raw('?? as ??', [columnName, getAs(column)]),
                );
                groupBySelectors.push(getAs(column));
                break;
              }
            }
          }),
        );

        // get aggregated count of each group
        tQb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
        tQb.select(...colSelectors);

        if (+rest?.shuffle) {
          await this.shuffle({ qb: tQb });
        }

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
              children: rest.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(where, aliasColObjMap),
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: groupFilter,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
          ],
          tQb,
        );

        tQb.groupBy(...groupBySelectors);

        const count = this.dbDriver
          .count('*', { as: 'count' })
          .from(tQb.as('groupby'));

        let subQuery;
        switch (this.dbDriver.client.config.client) {
          case 'pg':
            subQuery = this.dbDriver
              .select(
                this.dbDriver.raw(`json_build_object('count', "count") as ??`, [
                  getAlias(),
                ]),
              )
              .from(count.as(getAlias()));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'mysql2':
            subQuery = this.dbDriver
              .select(this.dbDriver.raw(`JSON_OBJECT('count', \`count\`)`))
              .from(count.as(getAlias()));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'sqlite3':
            subQuery = this.dbDriver
              .select(
                this.dbDriver.raw(`json_object('count', "count") as ??`, [
                  f.alias,
                ]),
              )
              .from(count.as(getAlias()));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          default:
            NcError.notImplemented(
              'This database does not support bulk groupBy count',
            );
        }
      }

      const qb = this.dbDriver(this.tnPath);
      qb.select(...selectors).limit(1);

      const data = await this.execAndParse(qb, null, {
        raw: true,
        first: true,
      });

      return data;
    } catch (e) {
      console.log(e);
    }
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
    const columns = await this.model.getColumns(this.context);
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const selectors = [] as Array<Knex.Raw>;

    const viewFilterList = await Filter.rootFilterList(this.context, {
      viewId: this.viewId,
    });

    try {
      if (!bulkFilterList?.length) {
        return NcError.badRequest('bulkFilterList is required');
      }

      for (const f of bulkFilterList) {
        const { where, ...rest } = this._getListArgs(f);
        const groupBySelectors = [];
        const groupByColumns: Record<string, Column> = {};

        const getAlias = getAliasGenerator('__nc_gb');
        const groupFilter = extractFilterFromXwhere(f?.where, aliasColObjMap);
        let groupSort = extractSortsObject(rest?.sort, aliasColObjMap);

        const tQb = this.dbDriver(this.tnPath);
        const colSelectors = [];
        const colIds = rest.column_name
          .split(',')
          .map((col) => {
            const column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );
            if (!column) {
              throw NcError.fieldNotFound(col);
            }
            return column?.id;
          })
          .join('_');

        await Promise.all(
          rest.column_name.split(',').map(async (col) => {
            let column = columns.find(
              (c) => c.column_name === col || c.title === col,
            );

            // if qrCode or Barcode replace it with value column nd keep the alias
            if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt)) {
              column = new Column({
                ...(await column
                  .getColOptions<BarcodeColumn | QrCodeColumn>(this.context)
                  .then((col) => col.getValueColumn(this.context))),
                asId: column.id,
              });
            }

            groupByColumns[getAs(column)] = column;

            switch (column.uidt) {
              case UITypes.Attachment:
                NcError.badRequest(
                  'Group by using attachment column is not supported',
                );
                break;
              case UITypes.Button: {
                NcError.badRequest(
                  'Group by using Button column is not supported',
                );
                break;
              }
              case UITypes.Links:
              case UITypes.Rollup:
                colSelectors.push(
                  (
                    await genRollupSelectv2({
                      baseModelSqlv2: this,
                      knex: this.dbDriver,
                      columnOptions: (await column.getColOptions(
                        this.context,
                      )) as RollupColumn,
                    })
                  ).builder.as(getAs(column)),
                );
                groupBySelectors.push(getAs(column));
                break;
              case UITypes.Formula: {
                let selectQb;
                try {
                  const _selectQb = await this.getSelectQueryBuilderForFormula(
                    column,
                  );
                  selectQb = this.dbDriver.raw(`?? as ??`, [
                    _selectQb.builder,
                    getAs(column),
                  ]);
                } catch (e) {
                  console.log(e);
                  selectQb = this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]);
                }
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }

              case UITypes.Lookup:
              case UITypes.LinkToAnotherRecord: {
                const _selectQb = await generateLookupSelectQuery({
                  baseModelSqlv2: this,
                  column,
                  alias: null,
                  model: this.model,
                  getAlias,
                });
                const selectQb = this.dbDriver.raw(`?? as ??`, [
                  this.dbDriver.raw(_selectQb.builder).wrap('(', ')'),
                  getAs(column),
                ]);
                colSelectors.push(selectQb);
                groupBySelectors.push(getAs(column));
                break;
              }
              case UITypes.DateTime:
              case UITypes.CreatedTime:
              case UITypes.LastModifiedTime:
                {
                  const columnName = await getColumnName(
                    this.context,
                    column,
                    columns,
                  );
                  // ignore seconds part in datetime and group
                  if (this.dbDriver.clientType() === 'pg') {
                    colSelectors.push(
                      this.dbDriver.raw(
                        "date_trunc('minute', ??) + interval '0 seconds' as ??",
                        [columnName, getAs(column)],
                      ),
                    );
                  } else if (
                    this.dbDriver.clientType() === 'mysql' ||
                    this.dbDriver.clientType() === 'mysql2'
                  ) {
                    colSelectors.push(
                      // this.dbDriver.raw('??::date as ??', [columnName, getAs(column)]),
                      this.dbDriver.raw(
                        "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND) as ??",
                        [columnName, columnName, getAs(column)],
                      ),
                    );
                  } else if (this.dbDriver.clientType() === 'sqlite3') {
                    colSelectors.push(
                      this.dbDriver.raw(
                        `strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
   CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   ELSE
    '+00:00'
   END) AS :id:`,
                        {
                          column: columnName,
                          id: getAs(column),
                        },
                      ),
                    );
                  } else {
                    colSelectors.push(
                      this.dbDriver.raw('DATE(??) as ??', [
                        columnName,
                        getAs(column),
                      ]),
                    );
                  }
                  groupBySelectors.push(getAs(column));
                }
                break;
              default: {
                const columnName = await getColumnName(
                  this.context,
                  column,
                  columns,
                );
                colSelectors.push(
                  this.dbDriver.raw('?? as ??', [columnName, getAs(column)]),
                );
                groupBySelectors.push(getAs(column));
                break;
              }
            }
          }),
        );

        // get aggregated count of each group
        tQb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
        tQb.select(...colSelectors);

        if (+rest?.shuffle) {
          await this.shuffle({ qb: tQb });
        }

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
              children: rest.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: extractFilterFromXwhere(where, aliasColObjMap),
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: groupFilter,
              is_group: true,
              logical_op: 'and',
            }),
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and',
            }),
          ],
          tQb,
        );

        if (!groupSort) {
          if (rest.sortArr?.length) {
            groupSort = rest.sortArr;
          } else if (this.viewId) {
            groupSort = await Sort.list(this.context, { viewId: this.viewId });
          }
        }

        for (const sort of groupSort || []) {
          if (!groupByColumns[sort.fk_column_id]) {
            continue;
          }

          const column = groupByColumns[sort.fk_column_id];

          if (
            [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
              column.uidt as UITypes,
            )
          ) {
            const columnName = await getColumnName(
              this.context,
              column,
              columns,
            );
            const baseUsers = await BaseUser.getUsersList(this.context, {
              base_id: column.base_id,
            });

            // create nested replace statement for each user
            const finalStatement = baseUsers.reduce((acc, user) => {
              const qb = this.dbDriver.raw(`REPLACE(${acc}, ?, ?)`, [
                user.id,
                user.display_name || user.email,
              ]);
              return qb.toQuery();
            }, this.dbDriver.raw(`??`, [columnName]).toQuery());

            if (!['asc', 'desc'].includes(sort.direction)) {
              tQb.orderBy(
                'count',
                sort.direction === 'count-desc' ? 'desc' : 'asc',
                sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
              );
            } else {
              tQb.orderBy(
                sanitize(this.dbDriver.raw(finalStatement)),
                sort.direction,
                sort.direction === 'desc' ? 'LAST' : 'FIRST',
              );
            }
          } else {
            if (!['asc', 'desc'].includes(sort.direction)) {
              tQb.orderBy(
                'count',
                sort.direction === 'count-desc' ? 'desc' : 'asc',
                sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
              );
            } else {
              tQb.orderBy(
                getAs(column),
                sort.direction,
                sort.direction === 'desc' ? 'LAST' : 'FIRST',
              );
            }
          }
          tQb.groupBy(...groupBySelectors);
          applyPaginate(tQb, rest);
        }

        let subQuery;
        switch (this.dbDriver.client.config.client) {
          case 'pg':
            subQuery = this.dbDriver
              .select(
                this.dbDriver.raw(
                  `json_agg(json_build_object('count', "count", '${rest.column_name}', "${colIds}")) as ??`,
                  [getAlias()],
                ),
              )
              .from(tQb.as(getAlias()));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, `${f.alias}`]),
            );
            break;
          case 'mysql2':
            subQuery = this.dbDriver
              .select(
                this.dbDriver.raw(
                  `JSON_ARRAYAGG(JSON_OBJECT('count', \`count\`, '${rest.column_name}', \`${colIds}\`))`,
                ),
              )
              .from(this.dbDriver.raw(`(??) as ??`, [tQb, getAlias()]));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, f.alias]),
            );
            break;
          case 'sqlite3':
            subQuery = this.dbDriver
              .select(
                this.dbDriver.raw(
                  `json_group_array(json_object('count', "count", '${rest.column_name}', "${colIds}")) as ??`,
                  [f.alias],
                ),
              )
              .from(tQb.as(getAlias()));
            selectors.push(
              this.dbDriver.raw(`(??) as ??`, [subQuery, f.alias]),
            );
            break;
          default:
            NcError.notImplemented(
              'This database does not support bulk groupBy',
            );
        }
      }

      const qb = this.dbDriver(this.tnPath);
      qb.select(...selectors).limit(1);

      const data = await this.execAndParse(qb, null, {
        raw: true,
        first: true,
      });
      return data;
    } catch (err) {
      logger.log(err);
      return [];
    }
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
        return NcError.badRequest('bulkFilterList is required');
      }

      const { where, aggregation } = this._getListArgs(args as any);

      const columns = await this.model.getColumns(this.context);

      let viewColumns = (
        await GridViewColumn.list(this.context, this.viewId)
      ).filter((c) => {
        const col = columns.find((col) => col.id === c.fk_column_id);
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
        const col = columns.find((c) => c.id === viewColumn.fk_column_id);
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
        const aggFilter = extractFilterFromXwhere(f.where, aliasColObjMap);
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
              children: extractFilterFromXwhere(where, aliasColObjMap),
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

      const data = await this.execAndParse(qb, null, {
        first: true,
        bulkAggregate: true,
      });

      return data;
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
        const col = columns.find((col) => col.id === c.fk_column_id);
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
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
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
    limit?;
    offset?;
    sort?: string | string[];
    filterArr?: Filter[];
    sortArr?: Sort[];
  }) {
    const { where, ...rest } = this._getListArgs(args as any);

    args.column_name = args.column_name || '';

    const columns = await this.model.getColumns(this.context);
    const groupByColumns: Record<string, Column> = {};

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');

    await Promise.all(
      args.column_name.split(',').map(async (col) => {
        let column = columns.find(
          (c) => c.column_name === col || c.title === col,
        );
        if (!column) {
          throw NcError.fieldNotFound(col);
        }

        // if qrCode or Barcode replace it with value column nd keep the alias
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
          column = new Column({
            ...(await column
              .getColOptions<BarcodeColumn | QrCodeColumn>(this.context)
              .then((col) => col.getValueColumn(this.context))),
            asId: column.id,
          });

        groupByColumns[getAs(column)] = column;

        switch (column.uidt) {
          case UITypes.Attachment:
            NcError.badRequest(
              'Group by using attachment column is not supported',
            );
            break;
          case UITypes.Button:
            {
              NcError.badRequest(
                'Group by using Button column is not supported',
              );
            }
            break;
          case UITypes.Links:
          case UITypes.Rollup:
            selectors.push(
              (
                await genRollupSelectv2({
                  baseModelSqlv2: this,
                  knex: this.dbDriver,
                  columnOptions: (await column.getColOptions(
                    this.context,
                  )) as RollupColumn,
                })
              ).builder.as(getAs(column)),
            );
            groupBySelectors.push(getAs(column));
            break;
          case UITypes.Formula:
            {
              let selectQb;
              try {
                const _selectQb = await this.getSelectQueryBuilderForFormula(
                  column,
                );

                selectQb = this.dbDriver.raw(`?? as ??`, [
                  _selectQb.builder,
                  getAs(column),
                ]);
              } catch (e) {
                logger.log(e);
                // return dummy select
                selectQb = this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]);
              }

              selectors.push(selectQb);
              groupBySelectors.push(getAs(column));
            }
            break;
          case UITypes.Lookup:
          case UITypes.LinkToAnotherRecord:
            {
              const _selectQb = await generateLookupSelectQuery({
                baseModelSqlv2: this,
                column,
                alias: null,
                model: this.model,
                getAlias,
              });

              const selectQb = this.dbDriver.raw(`?? as ??`, [
                this.dbDriver.raw(_selectQb.builder).wrap('(', ')'),
                getAs(column),
              ]);

              selectors.push(selectQb);
              groupBySelectors.push(getAs(column));
            }
            break;
          case UITypes.CreatedTime:
          case UITypes.LastModifiedTime:
          case UITypes.DateTime:
            {
              const columnName = await getColumnName(
                this.context,
                column,
                columns,
              );
              // ignore seconds part in datetime and group
              if (this.dbDriver.clientType() === 'pg') {
                selectors.push(
                  this.dbDriver.raw(
                    "date_trunc('minute', ??) + interval '0 seconds' as ??",
                    [columnName, getAs(column)],
                  ),
                );
              } else if (
                this.dbDriver.clientType() === 'mysql' ||
                this.dbDriver.clientType() === 'mysql2'
              ) {
                selectors.push(
                  // this.dbDriver.raw('??::date as ??', [columnName, getAs(column)]),
                  this.dbDriver.raw(
                    "DATE_SUB(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), INTERVAL SECOND(??) SECOND) as ??",
                    [columnName, columnName, getAs(column)],
                  ),
                );
              } else if (this.dbDriver.clientType() === 'sqlite3') {
                selectors.push(
                  this.dbDriver.raw(
                    `strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
   CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   ELSE
    '+00:00'
   END) AS :id:`,
                    {
                      column: columnName,
                      id: getAs(column),
                    },
                  ),
                );
              } else {
                selectors.push(
                  this.dbDriver.raw('DATE(??) as ??', [
                    columnName,
                    getAs(column),
                  ]),
                );
              }
              groupBySelectors.push(getAs(column));
            }
            break;
          default:
            {
              const columnName = await getColumnName(
                this.context,
                column,
                columns,
              );
              selectors.push(
                this.dbDriver.raw('?? as ??', [columnName, getAs(column)]),
              );
              groupBySelectors.push(getAs(column));
            }
            break;
        }
      }),
    );

    const qb = this.dbDriver(this.tnPath);

    // get aggregated count of each group
    qb.count(`${this.model.primaryKey?.column_name || '*'} as count`);

    // get each group
    qb.select(...selectors);

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );

    let sorts = extractSortsObject(rest?.sort, aliasColObjMap);

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
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

    if (!sorts) {
      if (args.sortArr?.length) {
        sorts = args.sortArr;
      } else if (this.viewId) {
        sorts = await Sort.list(this.context, { viewId: this.viewId });
      }
    }

    // if sort is provided filter out the group by columns sort and apply
    // since we are grouping by the column and applying sort on any other column is not required
    for (const sort of sorts || []) {
      if (!groupByColumns[sort.fk_column_id]) {
        continue;
      }

      const column = groupByColumns[sort.fk_column_id];

      if (
        [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
          column.uidt as UITypes,
        )
      ) {
        const columnName = await getColumnName(this.context, column, columns);

        const baseUsers = await BaseUser.getUsersList(this.context, {
          base_id: column.base_id,
        });

        // create nested replace statement for each user
        const finalStatement = baseUsers.reduce((acc, user) => {
          const qb = this.dbDriver.raw(`REPLACE(${acc}, ?, ?)`, [
            user.id,
            user.display_name || user.email,
          ]);
          return qb.toQuery();
        }, this.dbDriver.raw(`??`, [columnName]).toQuery());

        if (!['asc', 'desc'].includes(sort.direction)) {
          qb.orderBy(
            'count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
        } else {
          qb.orderBy(
            sanitize(this.dbDriver.raw(finalStatement)),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      } else {
        if (!['asc', 'desc'].includes(sort.direction)) {
          qb.orderBy(
            'count',
            sort.direction === 'count-desc' ? 'desc' : 'asc',
            sort.direction === 'count-desc' ? 'LAST' : 'FIRST',
          );
        } else {
          qb.orderBy(
            getAs(column),
            sort.direction,
            sort.direction === 'desc' ? 'LAST' : 'FIRST',
          );
        }
      }
    }

    // group by using the column aliases
    qb.groupBy(...groupBySelectors);

    applyPaginate(qb, rest);

    return await this.execAndParse(qb);
  }

  async groupByCount(args: {
    where?: string;
    column_name: string;
    limit?;
    offset?;
    filterArr?: Filter[];
  }) {
    const { where } = this._getListArgs(args as any);

    args.column_name = args.column_name || '';

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');

    const columns = await this.model.getColumns(this.context);

    // todo: refactor and avoid duplicate code
    await Promise.all(
      args.column_name.split(',').map(async (col) => {
        let column = columns.find(
          (c) => c.column_name === col || c.title === col,
        );
        if (!column) {
          throw NcError.fieldNotFound(col);
        }

        // if qrCode or Barcode replace it with value column nd keep the alias
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
          column = new Column({
            ...(await column
              .getColOptions<BarcodeColumn | QrCodeColumn>(this.context)
              .then((col) => col.getValueColumn(this.context))),
            asId: column.id,
          });

        switch (column.uidt) {
          case UITypes.Attachment:
            NcError.badRequest(
              'Group by using attachment column is not supported',
            );
            break;
          case UITypes.Button: {
            NcError.badRequest('Group by using Button column is not supported');
            break;
          }
          case UITypes.Rollup:
          case UITypes.Links:
            selectors.push(
              (
                await genRollupSelectv2({
                  baseModelSqlv2: this,
                  // tn: this.title,
                  knex: this.dbDriver,
                  // column,
                  // alias,
                  columnOptions: (await column.getColOptions(
                    this.context,
                  )) as RollupColumn,
                })
              ).builder.as(getAs(column)),
            );
            groupBySelectors.push(getAs(column));
            break;
          case UITypes.Formula: {
            let selectQb;
            try {
              const _selectQb = await this.getSelectQueryBuilderForFormula(
                column,
              );

              selectQb = this.dbDriver.raw(`?? as ??`, [
                _selectQb.builder,
                getAs(column),
              ]);
            } catch (e) {
              logger.log(e);
              // return dummy select
              selectQb = this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]);
            }

            selectors.push(selectQb);
            groupBySelectors.push(getAs(column));
            break;
          }
          case UITypes.Lookup:
          case UITypes.LinkToAnotherRecord:
            {
              const _selectQb = await generateLookupSelectQuery({
                baseModelSqlv2: this,
                column,
                alias: null,
                model: this.model,
                getAlias,
              });

              const selectQb = this.dbDriver.raw(`?? as ??`, [
                this.dbDriver.raw(_selectQb.builder).wrap('(', ')'),
                getAs(column),
              ]);

              selectors.push(selectQb);
              groupBySelectors.push(getAs(column));
            }
            break;
          case UITypes.CreatedTime:
          case UITypes.LastModifiedTime:
          case UITypes.DateTime:
            {
              const columnName = await getColumnName(
                this.context,
                column,
                columns,
              );
              // ignore seconds part in datetime and group
              if (this.dbDriver.clientType() === 'pg') {
                selectors.push(
                  this.dbDriver.raw(
                    "date_trunc('minute', ??) + interval '0 seconds' as ??",
                    [columnName, getAs(column)],
                  ),
                );
              } else if (
                this.dbDriver.clientType() === 'mysql' ||
                this.dbDriver.clientType() === 'mysql2'
              ) {
                selectors.push(
                  this.dbDriver.raw(
                    "CONVERT_TZ(DATE_SUB(??, INTERVAL SECOND(??) SECOND), @@GLOBAL.time_zone, '+00:00') as ??",
                    [columnName, columnName, getAs(column)],
                  ),
                );
              } else if (this.dbDriver.clientType() === 'sqlite3') {
                selectors.push(
                  this.dbDriver.raw(
                    `strftime ('%Y-%m-%d %H:%M:00',:column:) ||
  (
   CASE WHEN substr(:column:, 20, 1) = '+' THEN
    printf ('+%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   WHEN substr(:column:, 20, 1) = '-' THEN
    printf ('-%s:',
     substr(:column:, 21, 2)) || printf ('%s',
     substr(:column:, 24, 2))
   ELSE
    '+00:00'
   END) as :id:`,
                    {
                      column: columnName,
                      id: getAs(column),
                    },
                  ),
                );
              } else {
                selectors.push(
                  this.dbDriver.raw('DATE(??) as ??', [
                    columnName,
                    getAs(column),
                  ]),
                );
              }
              groupBySelectors.push(getAs(column));
            }
            break;
          default:
            {
              const columnName = await getColumnName(
                this.context,
                column,
                columns,
              );
              selectors.push(
                this.dbDriver.raw('?? as ??', [columnName, getAs(column)]),
              );
              groupBySelectors.push(getAs(column));
            }
            break;
        }
      }),
    );

    const qb = this.dbDriver(this.tnPath);
    qb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
    qb.select(...selectors);

    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
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

    qb.groupBy(...groupBySelectors);

    const qbP = this.dbDriver
      .count('*', { as: 'count' })
      .from(qb.as('groupby'));

    return (await this.execAndParse(qbP, null, { raw: true, first: true }))
      ?.count;
  }

  async multipleHmList(
    { colId, ids: _ids }: { colId: string; ids: any[] },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    try {
      // skip duplicate id
      const ids = [...new Set(_ids)];

      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getChildColumn(this.context);
      const childTable = await chilCol.getModel(this.context);
      const parentCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getParentColumn(this.context);
      const parentTable = await parentCol.getModel(this.context);
      const childModel = await Model.getBaseModelSQL(this.context, {
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns(this.context);

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const qb = this.dbDriver(childTn);
      await childModel.selectObject({
        qb,
        extractPkAndPv: true,
        fieldsSet: args.fieldsSet,
      });
      await this.applySortAndFilter({ table: childTable, where, qb, sort });

      const childQb = this.dbDriver.queryBuilder().from(
        this.dbDriver
          .unionAll(
            ids.map((p) => {
              const query = qb
                .clone()
                .select(this.dbDriver.raw('? as ??', [p, GROUP_COL]))
                .whereIn(
                  chilCol.column_name,
                  this.dbDriver(parentTn)
                    .select(parentCol.column_name)
                    // .where(parentTable.primaryKey.cn, p)
                    .where(_wherePk(parentTable.primaryKeys, p)),
                );
              // todo: sanitize
              query.limit(+rest?.limit || 25);
              query.offset(+rest?.offset || 0);

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite,
          )
          .as('list'),
      );

      const children = await this.execAndParse(
        childQb,
        await childTable.getColumns(this.context),
      );
      const proto = await (
        await Model.getBaseModelSQL(this.context, {
          id: childTable.id,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return groupBy(
        children.map((c) => {
          c.__proto__ = proto;
          return c;
        }),
        GROUP_COL,
      );
    } catch (e) {
      logger.error(e);
    }
  }

  public async mmList(
    { colId, parentId },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    selectAllRecords = false,
  ) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const mmTable = await relColOptions.getMMModel(this.context);
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);
    const childModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTn)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId)),
      );

    await childModel.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
    });

    await this.applySortAndFilter({
      table: childTable,
      where,
      qb,
      sort,
    });

    // todo: sanitize
    if (!selectAllRecords) {
      qb.limit(+rest?.limit || 25);
    }
    qb.offset(selectAllRecords ? 0 : +rest?.offset || 0);

    const children = await this.execAndParse(
      qb,
      await childTable.getColumns(this.context),
    );
    const proto = await (
      await Model.getBaseModelSQL(this.context, {
        id: rtnId,
        dbDriver: this.dbDriver,
      })
    ).getProto();

    return children.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  async multipleHmListCount({ colId, ids }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getChildColumn(this.context);
      const childTable = await chilCol.getModel(this.context);
      const parentCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getParentColumn(this.context);
      const parentTable = await parentCol.getModel(this.context);
      await parentTable.getColumns(this.context);

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const children = await this.execAndParse(
        this.dbDriver.unionAll(
          ids.map((p) => {
            const query = this.dbDriver(childTn)
              .count(`${chilCol?.column_name} as count`)
              .whereIn(
                chilCol.column_name,
                this.dbDriver(parentTn)
                  .select(parentCol.column_name)
                  // .where(parentTable.primaryKey.cn, p)
                  .where(_wherePk(parentTable.primaryKeys, p)),
              )
              .first();

            return this.isSqlite ? this.dbDriver.select().from(query) : query;
          }),
          !this.isSqlite,
        ),
        null,
        { raw: true },
      );

      return children.map(({ count }) => count);
    } catch (e) {
      throw e;
    }
  }

  async hmList(
    { colId, id },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      const { where, sort, ...rest } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getChildColumn(this.context);
      const childTable = await chilCol.getModel(this.context);
      const parentCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getParentColumn(this.context);
      const parentTable = await parentCol.getModel(this.context);
      const childBaseModel = await Model.getBaseModelSQL(this.context, {
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns(this.context);

      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const qb = this.dbDriver(childTn);
      await this.applySortAndFilter({ table: childTable, where, qb, sort });

      qb.whereIn(
        chilCol.column_name,
        this.dbDriver(parentTn)
          .select(parentCol.column_name)
          // .where(parentTable.primaryKey.cn, p)
          .where(_wherePk(parentTable.primaryKeys, id)),
      );
      // todo: sanitize
      qb.limit(+rest?.limit || 25);
      qb.offset(+rest?.offset || 0);

      await childBaseModel.selectObject({
        qb,
        fieldsSet: args.fieldSet,
      });

      await this.applySortAndFilter({
        table: childTable,
        where,
        qb,
        sort,
      });

      const children = await this.execAndParse(
        qb,
        await childTable.getColumns(this.context),
      );

      const proto = await (
        await Model.getBaseModelSQL(this.context, {
          id: childTable.id,
          dbDriver: this.dbDriver,
        })
      ).getProto();

      return children.map((c) => {
        c.__proto__ = proto;
        return c;
      });
    } catch (e) {
      throw e;
    }
  }

  async hmListCount({ colId, id }, args) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const { where } = this._getListArgs(args as any);
      const relColumn = (await this.model.getColumns(this.context)).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getChildColumn(this.context);
      const childTable = await chilCol.getModel(this.context);
      const parentCol = await (
        (await relColumn.getColOptions(
          this.context,
        )) as LinkToAnotherRecordColumn
      ).getParentColumn(this.context);
      const parentTable = await parentCol.getModel(this.context);
      await parentTable.getColumns(this.context);

      const childBaseModel = await Model.getBaseModelSQL(this.context, {
        dbDriver: this.dbDriver,
        model: childTable,
      });
      const childTn = childBaseModel.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const query = this.dbDriver(childTn)
        .count(`${chilCol?.column_name} as count`)
        .whereIn(
          chilCol.column_name,
          this.dbDriver(parentTn)
            .select(parentCol.column_name)
            .where(_wherePk(parentTable.primaryKeys, id)),
        );
      const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

      await conditionV2(
        this,
        [
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and',
          }),
        ],
        query,
      );

      return (await this.execAndParse(query, null, { raw: true, first: true }))
        ?.count;
    } catch (e) {
      throw e;
    }
  }

  public async multipleMmList(
    {
      colId,
      parentIds: _parentIds,
    }: {
      colId: string;
      parentIds: any[];
    },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
  ) {
    // skip duplicate id
    const parentIds = [...new Set(_parentIds)];
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn(this.context)).title;
    const mmTable = await relColOptions.getMMModel(this.context);

    // if mm table is not present then return
    if (!mmTable) {
      return;
    }

    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);
    const childModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn).join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`);

    await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

    await this.applySortAndFilter({
      table: childTable,
      where,
      qb,
      sort,
    });

    const finalQb = this.dbDriver.unionAll(
      parentIds.map((id) => {
        const query = qb
          .clone()
          .whereIn(
            `${vtn}.${vcn}`,
            this.dbDriver(parentTn)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(parentTable.primaryKeys, id)),
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));

        // todo: sanitize
        query.limit(+rest?.limit || 25);
        query.offset(+rest?.offset || 0);

        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite,
    );

    const children = await this.execAndParse(
      finalQb,
      await childTable.getColumns(this.context),
    );

    const proto = await (
      await Model.getBaseModelSQL(this.context, {
        id: rtnId,
        dbDriver: this.dbDriver,
      })
    ).getProto();
    const gs = groupBy(
      children.map((c) => {
        c.__proto__ = proto;
        return c;
      }),
      GROUP_COL,
    );
    return _parentIds.map((id) => gs[id] || []);
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel(this.context);
    const assocBaseModel = await Model.getBaseModelSQL(this.context, {
      id: mmTable.id,
      dbDriver: this.dbDriver,
    });

    const vtn = assocBaseModel.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);

    const childView = await relColOptions.getChildView(this.context);
    let listArgs: any = {};
    if (childView) {
      const { dependencyFields } = await getAst(this.context, {
        model: childTable,
        query: {},
        view: childView,
        throwErrorIfInvalidParams: false,
      });

      listArgs = dependencyFields;
      try {
        listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
      } catch (e) {}
      try {
        listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
      } catch (e) {}
    }

    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      id: parentTable.id,
      dbDriver: this.dbDriver,
    });
    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      id: childTable.id,
      dbDriver: this.dbDriver,
    });
    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const rtn = childTn;
    const qb = this.dbDriver(rtn)
      .count(`*`, { as: 'count' })
      .where((qb) => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid)),
            ),
        ).orWhereNull(rcn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: pid,
    });

    return (
      await this.execAndParse(qb, await childTable.getColumns(this.context), {
        raw: true,
        first: true,
      })
    )?.count;
  }

  public async multipleMmListCount({ colId, parentIds }) {
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel(this.context);
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' });

    // await childModel.selectObject({ qb });
    const children = await this.execAndParse(
      this.dbDriver.unionAll(
        parentIds.map((id) => {
          const query = qb
            .clone()
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, id)
                .where(_wherePk(parentTable.primaryKeys, id)),
            )
            .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
          // this._paginateAndSort(query, { sort, limit, offset }, null, true);
          return this.isSqlite ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite,
      ),
      null,
      { raw: true },
    );

    const gs = groupBy(children, GROUP_COL);
    return parentIds.map((id) => gs?.[id]?.[0] || []);
  }

  public async mmListCount({ colId, parentId }, args) {
    const { where } = this._getListArgs(args as any);

    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel(this.context);

    const assocBaseModel = await Model.getBaseModelSQL(this.context, {
      model: mmTable,
      dbDriver: this.dbDriver,
    });

    const vtn = assocBaseModel.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);

    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' })
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTn)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId)),
      );
    const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(
      this,
      [
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and',
        }),
      ],
      qb,
    );
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel(this.context);
    const assocBaseModel = await Model.getBaseModelSQL(this.context, {
      id: mmTable.id,
      dbDriver: this.dbDriver,
    });

    const vtn = assocBaseModel.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn(this.context))
      .column_name;
    const vrcn = (await relColOptions.getMMParentColumn(this.context))
      .column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;

    const childTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    await parentTable.getColumns(this.context);
    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      id: parentTable.id,
      dbDriver: this.dbDriver,
    });
    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      id: childTable.id,
    });
    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const childView = await relColOptions.getChildView(this.context);
    let listArgs: any = {};
    if (childView) {
      const { dependencyFields } = await getAst(this.context, {
        model: childTable,
        query: {},
        view: childView,
        throwErrorIfInvalidParams: false,
      });
      listArgs = dependencyFields;
    }

    const rtn = childTn;

    const qb = this.dbDriver(rtn).where((qb) =>
      qb
        .whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTn)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid)),
            ),
        )
        .orWhereNull(rcn),
    );

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await childBaseModel.selectObject({
      qb,
      fieldsSet: listArgs?.fieldsSet,
      viewId: childView?.id,
    });

    const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: pid,
    });

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childBaseModel.getProto();
    const data = await this.execAndParse(
      qb,
      await childTable.getColumns(this.context),
    );
    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });
    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: parentTable,
    });
    await parentTable.getColumns(this.context);

    const childView = await relColOptions.getChildView(this.context);

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const tn = childTn;
    const rtn = parentTn;

    const qb = this.dbDriver(tn).where((qb) => {
      qb.whereNotIn(
        cn,
        this.dbDriver(rtn)
          .select(rcn)
          // .where(parentTable.primaryKey.cn, pid)
          .where(_wherePk(parentTable.primaryKeys, pid)),
      ).orWhereNull(cn);
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await childBaseModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: pid,
    });
    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childBaseModel.getProto();
    const data = await this.execAndParse(
      qb,
      await childTable.getColumns(this.context),
    );
    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );

    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);

    const childView = await relColOptions.getChildView(this.context);

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const tn = childTn;
    const rtn = parentTn;
    await parentTable.getColumns(this.context);

    const qb = this.dbDriver(tn)
      .count(`*`, { as: 'count' })
      .where((qb) => {
        qb.whereNotIn(
          cn,
          this.dbDriver(rtn)
            .select(rcn)
            // .where(parentTable.primaryKey.cn, pid)
            .where(_wherePk(parentTable.primaryKeys, pid)),
        ).orWhereNull(cn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: pid,
    });

    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getExcludedOneToOneChildrenList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    const parentModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: parentTable,
    });
    const childModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childView = await relColOptions.getChildView(this.context);
    let listArgs: any = {};
    if (childView) {
      const { dependencyFields } = await getAst(this.context, {
        model: childTable,
        query: {},
        view: childView,
        throwErrorIfInvalidParams: false,
      });
      listArgs = dependencyFields;
    }

    const rtn = this.getTnPath(parentTable);
    const tn = this.getTnPath(childTable);
    await childTable.getColumns(this.context);

    // one-to-one relation is combination of both hm and bt to identify table which have
    // foreign key column(similar to bt) we are adding a boolean flag `bt` under meta
    const isBt = relColumn.meta?.bt;

    const qb = this.dbDriver(isBt ? rtn : tn).where((qb) => {
      qb.whereNotIn(
        isBt ? rcn : cn,
        this.dbDriver(isBt ? tn : rtn)
          .select(isBt ? cn : rcn)
          .where(_wherePk((isBt ? childTable : parentTable).primaryKeys, cid))
          .whereNotNull(isBt ? cn : rcn),
      ).orWhereNull(isBt ? rcn : cn);
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await (isBt ? parentModel : childModel).selectObject({
      qb,
      fieldsSet: listArgs.fieldsSet,
      viewId: childView?.id,
    });

    const aliasColObjMap = await parentTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: cid,
    });

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (parentTable.primaryKey && parentTable.primaryKey.ai) {
      qb.orderBy(parentTable.primaryKey.column_name);
    } else if (
      parentTable.columns.find((c) => c.column_name === 'created_at')
    ) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await (isBt ? parentModel : childModel).getProto();
    const data = await this.execAndParse(
      qb,
      await (isBt ? parentTable : childTable).getColumns(this.context),
    );

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: parentTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns(this.context);

    const qb = this.dbDriver(rtn)
      .where((qb) => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(tn)
            .select(cn)
            // .where(childTable.primaryKey.cn, cid)
            .where(_wherePk(childTable.primaryKeys, cid))
            .whereNotNull(cn),
        );
      })
      .count(`*`, { as: 'count' });

    const aliasColObjMap = await parentTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    const targetView = await relColOptions.getChildView(this.context);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: targetView,
      filters: filterObj,
      args,
      qb,
      rowId: cid,
    });

    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async countExcludedOneToOneChildren(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);

    const childView = await relColOptions.getChildView(this.context);
    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: parentTable,
    });
    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });
    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns(this.context);

    // one-to-one relation is combination of both hm and bt to identify table which have
    // foreign key column(similar to bt) we are adding a boolean flag `bt` under meta
    const isBt = relColumn.meta?.bt;

    const qb = this.dbDriver(isBt ? rtn : tn)
      .where((qb) => {
        qb.whereNotIn(
          isBt ? rcn : cn,
          this.dbDriver(isBt ? tn : rtn)
            .select(isBt ? cn : rcn)
            .where(_wherePk((isBt ? childTable : parentTable).primaryKeys, cid))
            .whereNotNull(isBt ? cn : rcn),
        ).orWhereNull(isBt ? rcn : cn);
      })
      .count(`*`, { as: 'count' });

    const aliasColObjMap = await parentTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: childView,
      filters: filterObj,
      args,
      qb,
      rowId: cid,
    });

    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns(this.context)).find(
      (c) => c.id === colId,
    );
    const relColOptions = (await relColumn.getColOptions(
      this.context,
    )) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn(this.context)).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn(this.context)
    ).getModel(this.context);
    const cn = (await relColOptions.getChildColumn(this.context)).column_name;
    const childTable = await (
      await relColOptions.getChildColumn(this.context)
    ).getModel(this.context);
    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: parentTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns(this.context);

    const qb = this.dbDriver(rtn).where((qb) => {
      qb.whereNotIn(
        rcn,
        this.dbDriver(tn)
          .select(cn)
          // .where(childTable.primaryKey.cn, cid)
          .where(_wherePk(childTable.primaryKeys, cid))
          .whereNotNull(cn),
      );
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await parentBaseModel.selectObject({ qb });

    const aliasColObjMap = await parentTable.getAliasColObjMap(this.context);
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    const targetView = await relColOptions.getChildView(this.context);
    await this.getCustomConditionsAndApply({
      column: relColumn,
      view: targetView,
      filters: filterObj,
      args,
      qb,
      rowId: cid,
    });

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (parentTable.primaryKey && parentTable.primaryKey.ai) {
      qb.orderBy(parentTable.primaryKey.column_name);
    } else if (
      parentTable.columns.find((c) => c.column_name === 'created_at')
    ) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await parentBaseModel.getProto();
    const data = await this.execAndParse(
      qb,
      await parentTable.getColumns(this.context),
    );

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  protected async applySortAndFilter({
    table,
    view,
    where,
    qb,
    sort,
  }: {
    table: Model;
    view?: View;
    where: string;
    qb;
    sort: string;
  }) {
    const childAliasColMap = await table.getAliasColObjMap(this.context);

    const filter = extractFilterFromXwhere(where, childAliasColMap);
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
        ...filter,
      ],
      qb,
    );
    if (!sort) return;
    const sortObj = extractSortsObject(sort, childAliasColMap);
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
    const qb = await formulaQueryBuilderv2(
      this,
      formula.formula,
      null,
      this.model,
      column,
      aliasToColumnBuilder,
      tableAlias,
      validateFormula,
    );
    return qb;
  }

  async getProto() {
    if (this._proto) {
      return this._proto;
    }

    const proto: any = { __columnAliases: {} };
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
                // todo : handle mm
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

  _getListArgs(args: XcFilterWithAlias): XcFilter {
    const obj: XcFilter = extractLimitAndOffset(args);
    obj.where = args.filter || args.where || args.w || '';
    obj.having = args.having || args.h || '';
    obj.shuffle = args.shuffle || args.r || '';
    obj.condition = args.condition || args.c || {};
    obj.conditionGraph = args.conditionGraph || {};
    obj.limit = Math.max(
      Math.min(
        Math.max(+(args.limit || args.l), 0) ||
          BaseModelSqlv2.config.limitDefault,
        BaseModelSqlv2.config.limitMax,
      ),
      BaseModelSqlv2.config.limitMin,
    );
    obj.offset = Math.max(+(args.offset || args.o) || 0, 0);
    obj.fields = args.fields || args.f;
    obj.sort = args.sort || args.s;
    obj.pks = args.pks;
    obj.aggregation = args.aggregation || [];
    obj.column_name = args.column_name;
    return obj;
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
  public async selectObject({
    qb,
    columns: _columns,
    fields: _fields,
    extractPkAndPv,
    viewId,
    fieldsSet,
    alias,
    validateFormula,
  }: {
    fieldsSet?: Set<string>;
    qb: Knex.QueryBuilder & Knex.QueryInterface;
    columns?: Column[];
    fields?: string[] | string;
    extractPkAndPv?: boolean;
    viewId?: string;
    alias?: string;
    validateFormula?: boolean;
  }): Promise<void> {
    // keep a common object for all columns to share across all columns
    const aliasToColumnBuilder = {};
    let viewOrTableColumns: Column[] | { fk_column_id?: string }[];

    const res = {};
    let view: View;
    let fields: string[];

    if (fieldsSet?.size) {
      viewOrTableColumns =
        _columns || (await this.model.getColumns(this.context));
    } else {
      view = await View.get(this.context, viewId);
      const viewColumns =
        viewId && (await View.getColumns(this.context, viewId));
      fields = Array.isArray(_fields) ? _fields : _fields?.split(',');

      // const columns = _columns ?? (await this.model.getColumns(this.context));
      // for (const column of columns) {
      viewOrTableColumns =
        viewColumns || _columns || (await this.model.getColumns(this.context));
    }
    for (const viewOrTableColumn of viewOrTableColumns) {
      const column =
        viewOrTableColumn instanceof Column
          ? viewOrTableColumn
          : await Column.get(this.context, {
              colId: (viewOrTableColumn as GridViewColumn).fk_column_id,
            });
      // hide if column marked as hidden in view
      // of if column is system field and system field is hidden
      if (
        shouldSkipField(
          fieldsSet,
          viewOrTableColumn,
          view,
          column,
          extractPkAndPv,
        )
      ) {
        continue;
      }

      if (!checkColumnRequired(column, fields, extractPkAndPv)) continue;

      switch (column.uidt) {
        case UITypes.CreatedTime:
        case UITypes.LastModifiedTime:
        case UITypes.DateTime:
          {
            const columnName = await getColumnName(
              this.context,
              column,
              _columns || (await this.model.getColumns(this.context)),
            );
            if (this.isMySQL) {
              // MySQL stores timestamp in UTC but display in timezone
              // To verify the timezone, run `SELECT @@global.time_zone, @@session.time_zone;`
              // If it's SYSTEM, then the timezone is read from the configuration file
              // if a timezone is set in a DB, the retrieved value would be converted to the corresponding timezone
              // for example, let's say the global timezone is +08:00 in DB
              // the value 2023-01-01 10:00:00 (UTC) would display as 2023-01-01 18:00:00 (UTC+8)
              // our existing logic is based on UTC, during the query, we need to take the UTC value
              // hence, we use CONVERT_TZ to convert back to UTC value
              res[sanitize(getAs(column) || columnName)] = this.dbDriver.raw(
                `CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00')`,
                [`${sanitize(alias || this.tnPath)}.${columnName}`],
              );
              break;
            } else if (this.isPg) {
              // if there is no timezone info,
              // convert to database timezone,
              // then convert to UTC
              if (
                column.dt !== 'timestamp with time zone' &&
                column.dt !== 'timestamptz'
              ) {
                res[sanitize(getAs(column) || columnName)] = this.dbDriver
                  .raw(
                    `?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC'`,
                    [`${sanitize(alias || this.tnPath)}.${columnName}`],
                  )
                  .wrap('(', ')');
                break;
              }
            } else if (this.isMssql) {
              // if there is no timezone info,
              // convert to database timezone,
              // then convert to UTC
              if (column.dt !== 'datetimeoffset') {
                res[sanitize(getAs(column) || columnName)] = this.dbDriver.raw(
                  `CONVERT(DATETIMEOFFSET, ?? AT TIME ZONE 'UTC')`,
                  [`${sanitize(alias || this.tnPath)}.${columnName}`],
                );
                break;
              }
            }
            res[sanitize(getAs(column) || columnName)] = sanitize(
              `${alias || this.tnPath}.${columnName}`,
            );
          }
          break;
        case UITypes.LinkToAnotherRecord:
        case UITypes.Lookup:
          break;
        case UITypes.QrCode: {
          const qrCodeColumn = await column.getColOptions<QrCodeColumn>(
            this.context,
          );

          if (!qrCodeColumn.fk_qr_value_column_id) {
            qb.select(this.dbDriver.raw(`? as ??`, ['ERR!', getAs(column)]));
            break;
          }

          const qrValueColumn = await Column.get(this.context, {
            colId: qrCodeColumn.fk_qr_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (qrValueColumn == null) {
            break;
          }

          switch (qrValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb = await this.getSelectQueryBuilderForFormula(
                  qrValueColumn,
                  alias,
                  validateFormula,
                  aliasToColumnBuilder,
                );
                qb.select({
                  [column.column_name]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({ [column.column_name]: qrValueColumn.column_name });
              break;
            }
          }

          break;
        }
        case UITypes.Barcode: {
          const barcodeColumn = await column.getColOptions<BarcodeColumn>(
            this.context,
          );

          if (!barcodeColumn.fk_barcode_value_column_id) {
            qb.select(this.dbDriver.raw(`? as ??`, ['ERR!', getAs(column)]));
            break;
          }

          const barcodeValueColumn = await Column.get(this.context, {
            colId: barcodeColumn.fk_barcode_value_column_id,
          });

          // If the referenced value cannot be found: cancel current iteration
          if (barcodeValueColumn == null) {
            break;
          }

          switch (barcodeValueColumn.uidt) {
            case UITypes.Formula:
              try {
                const selectQb = await this.getSelectQueryBuilderForFormula(
                  barcodeValueColumn,
                  alias,
                  validateFormula,
                  aliasToColumnBuilder,
                );
                qb.select({
                  [getAs(column)]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({
                [getAs(column)]: barcodeValueColumn.column_name,
              });
              break;
            }
          }

          break;
        }
        case UITypes.Formula:
          {
            try {
              const selectQb = await this.getSelectQueryBuilderForFormula(
                column,
                alias,
                validateFormula,
                aliasToColumnBuilder,
              );
              qb.select(
                this.dbDriver.raw(`?? as ??`, [
                  selectQb.builder,
                  getAs(column),
                ]),
              );
            } catch (e) {
              logger.log(e);
              // return dummy select
              qb.select(this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
            }
          }
          break;
        case UITypes.Button: {
          try {
            const colOption = column.colOptions as ButtonColumn;
            if (colOption.type === 'url') {
              const selectQb = await this.getSelectQueryBuilderForFormula(
                column,
                alias,
                validateFormula,
                aliasToColumnBuilder,
              );
              switch (this.dbDriver.client.config.client) {
                case 'mysql2':
                  qb.select(
                    this.dbDriver.raw(
                      `JSON_OBJECT('type', ? , 'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'pg':
                  qb.select(
                    this.dbDriver.raw(
                      `json_build_object('type', ? ,'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'sqlite3':
                  qb.select(
                    this.dbDriver.raw(
                      `json_object('type', ?, 'label', ?, 'url', ??) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        selectQb.builder,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                default:
                  qb.select(this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
              }
            } else if (colOption.type === 'webhook') {
              switch (this.dbDriver.client.config.client) {
                case 'mysql2':
                  qb.select(
                    this.dbDriver.raw(
                      `JSON_OBJECT('type', ?, 'label', ?, 'fk_webhook_id', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption.fk_webhook_id,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'pg':
                  qb.select(
                    this.dbDriver.raw(
                      `json_build_object('type', ?, 'label', ?, 'fk_webhook_id', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption.fk_webhook_id,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                case 'sqlite3':
                  qb.select(
                    this.dbDriver.raw(
                      `json_object('type', ?, 'label', ?, 'fk_webhook_id', ?) as ??`,
                      [
                        colOption.type,
                        `${colOption.label}`,
                        colOption.fk_webhook_id,
                        getAs(column),
                      ],
                    ),
                  );
                  break;
                default:
                  qb.select(this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
              }
            }
          } catch (e) {
            logger.log(e);
            // return dummy select
            qb.select(this.dbDriver.raw(`'ERR' as ??`, [getAs(column)]));
          }
          break;
        }
        case UITypes.Rollup:
        case UITypes.Links:
          qb.select(
            (
              await genRollupSelectv2({
                baseModelSqlv2: this,
                // tn: this.title,
                knex: this.dbDriver,
                // column,
                alias,
                columnOptions: (await column.getColOptions(
                  this.context,
                )) as RollupColumn,
              })
            ).builder.as(getAs(column)),
          );
          break;
        case UITypes.CreatedBy:
        case UITypes.LastModifiedBy: {
          const columnName = await getColumnName(
            this.context,
            column,
            _columns || (await this.model.getColumns(this.context)),
          );

          res[sanitize(getAs(column) || columnName)] = sanitize(
            `${alias || this.tnPath}.${columnName}`,
          );
          break;
        }
        default:
          if (this.isPg) {
            if (column.dt === 'bytea') {
              res[sanitize(getAs(column) || column.column_name)] =
                this.dbDriver.raw(
                  `encode(??.??, '${
                    column.meta?.format === 'hex' ? 'hex' : 'escape'
                  }')`,
                  [alias || this.model.table_name, column.column_name],
                );
              break;
            }
          }

          res[sanitize(getAs(column) || column.column_name)] = sanitize(
            `${alias || this.tnPath}.${column.column_name}`,
          );
          break;
      }
    }
    qb.select(res);
  }

  async insert(data, trx?, cookie?, _disableOptimization = false) {
    try {
      const columns = await this.model.getColumns(this.context);

      // exclude auto increment columns in body
      for (const col of columns) {
        if (col.ai) {
          const keyName =
            data?.[col.column_name] !== undefined ? col.column_name : col.title;

          if (data[keyName]) {
            delete data[keyName];
          }
        }
      }

      await populatePk(this.context, this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        this.context,
        data,
        this.clientMeta,
        this.dbDriver,
        columns,
      );

      await this.validate(insertObj, columns);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      await this.prepareNocoData(insertObj, true, cookie);

      let response;
      // const driver = trx ? trx : this.dbDriver;

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
        if (!response) await this.execAndParse(query);
        response = await this.readByPk(
          this.extractCompositePK({
            rowId: insertObj[ag.column_name],
            insertObj,
            ag,
            ai,
          }),
          false,
          {},
          { ignoreView: true, getHiddenColumn: true },
        );
      } else if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          const res = await this.execAndParse(query, null, {
            raw: true,
          });
          id = res?.id ?? res[0]?.insertId ?? res;
        }

        if (ai) {
          if (this.isSqlite) {
            // sqlite doesnt return id after insert
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath)
                  .select(ai.column_name)
                  .max(ai.column_name, { as: '__nc_ai_id' }),
                null,
                { raw: true, first: true },
              )
            )?.__nc_ai_id;
          } else if (this.isSnowflake || this.isDatabricks) {
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: '__nc_ai_id',
                }),
                null,
                { raw: true, first: true },
              )
            ).__nc_ai_id;
          }
          response = await this.readByPk(
            this.extractCompositePK({ rowId: id, insertObj, ag, ai }),
            false,
            {},
            { ignoreView: true, getHiddenColumn: true },
          );
        } else {
          response = data;
        }
      } else if (ai) {
        const id = Array.isArray(response)
          ? response?.[0]?.[ai.id]
          : response?.[ai.id];
        response = await this.readByPk(
          this.extractCompositePK({ rowId: id, insertObj, ag, ai }),
          false,
          {},
          { ignoreView: true, getHiddenColumn: true },
        );
      }

      await this.afterInsert(response, trx, cookie);
      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
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
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

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
        oldData: data,
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

  async nestedInsert(data, _trx = null, cookie?) {
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
      const { postInsertOps, preInsertOps } = await this.prepareNestedLinkQb({
        nestedCols,
        data,
        insertObj,
      });

      await this.validate(insertObj, columns);

      await this.beforeInsert(insertObj, this.dbDriver, cookie);

      await this.prepareNocoData(insertObj, true, cookie);

      await this.runOps(preInsertOps.map((f) => f()));

      let response;
      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if (this.isPg || this.isMssql) {
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

      await this.runOps(postInsertOps.map((f) => f(rowId)));

      if (rowId !== null && rowId !== undefined) {
        response = await this.readRecord({
          idOrRecord: rowId,
          validateFormula: false,
          ignoreView: true,
          getHiddenColumn: true,
          source,
        });
      }

      await this.afterInsert(response, this.dbDriver, cookie);

      return response;
    } catch (e) {
      throw e;
    }
  }

  protected extractCompositePK({
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

  protected async prepareNestedLinkQb({
    nestedCols,
    data,
    insertObj,
  }: {
    nestedCols: Column[];
    data: Record<string, any>;
    insertObj: Record<string, any>;
  }) {
    const postInsertOps: ((rowId: any) => Promise<string>)[] = [];
    const preInsertOps: (() => Promise<string>)[] = [];
    for (const col of nestedCols) {
      if (col.title in data) {
        const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>(
          this.context,
        );

        // parse data if it's JSON string
        let nestedData;
        try {
          nestedData =
            typeof data[col.title] === 'string'
              ? JSON.parse(data[col.title])
              : data[col.title];
        } catch {
          continue;
        }
        switch (colOptions.type) {
          case RelationTypes.BELONGS_TO:
            {
              if (typeof nestedData !== 'object') continue;
              const childCol = await colOptions.getChildColumn(this.context);
              const parentCol = await colOptions.getParentColumn(this.context);
              insertObj[childCol.column_name] = nestedData?.[parentCol.title];
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = col.meta?.bt;

              const childCol = await colOptions.getChildColumn(this.context);
              const childModel = await childCol.getModel(this.context);
              await childModel.getColumns(this.context);

              if (isBt) {
                // if array then extract value from first element
                const colVal = Array.isArray(nestedData)
                  ? nestedData[0]?.[childModel.primaryKey.title]
                  : nestedData[childModel.primaryKey.title];
                // todo: unlink the ref record
                preInsertOps.push(async () => {
                  return this.dbDriver(this.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: null,
                    })
                    .where(childCol.column_name, colVal)
                    .toQuery();
                });

                if (typeof nestedData !== 'object') continue;
                const childCol = await colOptions.getChildColumn(this.context);
                const parentCol = await colOptions.getParentColumn(
                  this.context,
                );
                insertObj[childCol.column_name] = nestedData?.[parentCol.title];
              } else {
                const parentCol = await colOptions.getParentColumn(
                  this.context,
                );
                const parentModel = await parentCol.getModel(this.context);
                await parentModel.getColumns(this.context);

                postInsertOps.push(async (rowId) => {
                  let refId = rowId;
                  if (parentModel.primaryKey.id !== parentCol.id) {
                    refId = this.dbDriver(
                      this.getTnPath(parentModel.table_name),
                    )
                      .select(parentCol.column_name)
                      .where(parentModel.primaryKey.column_name, rowId)
                      .first();
                  }
                  return this.dbDriver(this.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: refId,
                    })
                    .where(
                      childModel.primaryKey.column_name,
                      nestedData[childModel.primaryKey.title],
                    )
                    .toQuery();
                });
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              if (!Array.isArray(nestedData)) continue;
              const childCol = await colOptions.getChildColumn(this.context);
              const parentCol = await colOptions.getParentColumn(this.context);
              const childModel = await childCol.getModel(this.context);
              const parentModel = await parentCol.getModel(this.context);
              await childModel.getColumns(this.context);
              await parentModel.getColumns(this.context);

              postInsertOps.push(async (rowId) => {
                let refId = rowId;
                if (parentModel.primaryKey.id !== parentCol.id) {
                  refId = this.dbDriver(this.getTnPath(parentModel.table_name))
                    .select(parentCol.column_name)
                    .where(parentModel.primaryKey.column_name, rowId)
                    .first();
                }
                return this.dbDriver(this.getTnPath(childModel.table_name))
                  .update({
                    [childCol.column_name]: refId,
                  })
                  .whereIn(
                    childModel.primaryKey.column_name,
                    nestedData?.map((r) => r[childModel.primaryKey.title]),
                  )
                  .toQuery();
              });
            }
            break;
          case RelationTypes.MANY_TO_MANY: {
            if (!Array.isArray(nestedData)) continue;
            postInsertOps.push(async (rowId) => {
              const parentModel = await colOptions
                .getParentColumn(this.context)
                .then((c) => c.getModel(this.context));
              await parentModel.getColumns(this.context);
              const parentMMCol = await colOptions.getMMParentColumn(
                this.context,
              );
              const childMMCol = await colOptions.getMMChildColumn(
                this.context,
              );
              const mmModel = await colOptions.getMMModel(this.context);

              const rows = nestedData.map((r) => ({
                [parentMMCol.column_name]: r[parentModel.primaryKey.title],
                [childMMCol.column_name]: rowId,
              }));
              return this.dbDriver(this.getTnPath(mmModel.table_name))
                .insert(rows)
                .toQuery();
            });
          }
        }
      }
    }
    return { postInsertOps, preInsertOps };
  }

  async bulkInsert(
    datas: any[],
    {
      chunkSize: _chunkSize = 100,
      cookie,
      foreign_key_checks = true,
      skip_hooks = false,
      raw = false,
      insertOneByOneAsFallback = false,
      isSingleRecordInsertion = false,
      allowSystemColumn = false,
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
      allowSystemColumn?: boolean;
    } = {},
  ) {
    let trx;
    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];
      let postInsertOps: ((rowId: any) => Promise<string>)[] = [];
      let preInsertOps: (() => Promise<string>)[] = [];
      let aiPkCol: Column;
      let agPkCol: Column;
      if (!raw) {
        const columns = await this.model.getColumns(this.context);

        const nestedCols = columns.filter((c) => isLinksOrLTAR(c));

        for (const d of datas) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

            if (col.title in d) {
              if (
                isCreatedOrLastModifiedTimeCol(col) ||
                isCreatedOrLastModifiedByCol(col)
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is auto generated and cannot be updated`,
                );
              }

              if (
                col.system &&
                !allowSystemColumn &&
                col.uidt !== UITypes.ForeignKey
              ) {
                NcError.badRequest(
                  `Column "${col.title}" is system column and cannot be updated`,
                );
              }
            }

            // populate pk columns
            if (col.pk) {
              if (col.meta?.ag && !d[col.title]) {
                d[col.title] =
                  col.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
              }
            }

            // map alias to column
            if (!isVirtualCol(col)) {
              let val =
                d?.[col.column_name] !== undefined
                  ? d?.[col.column_name]
                  : d?.[col.title];
              if (val !== undefined) {
                if (
                  col.uidt === UITypes.Attachment &&
                  typeof val !== 'string'
                ) {
                  val = JSON.stringify(val);
                }
                if (col.uidt === UITypes.DateTime && dayjs(val).isValid()) {
                  const { isMySQL, isSqlite, isMssql, isPg } = this.clientMeta;
                  if (
                    val.indexOf('-') < 0 &&
                    val.indexOf('+') < 0 &&
                    val.slice(-1) !== 'Z'
                  ) {
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
                    val = this.dbDriver.raw(
                      `CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ss')],
                    );
                  } else if (isSqlite) {
                    // convert to UTC
                    // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
                  } else if (isPg) {
                    // convert to UTC
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    // then convert to db timezone
                    val = this.dbDriver.raw(
                      `? AT TIME ZONE CURRENT_SETTING('timezone')`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
                    );
                  } else if (isMssql) {
                    // convert ot UTC
                    // e.g. 2023-05-10T08:49:32.000Z -> 2023-05-10 08:49:32-08:00
                    // then convert to db timezone
                    val = this.dbDriver.raw(
                      `SWITCHOFFSET(CONVERT(datetimeoffset, ?), DATENAME(TzOffset, SYSDATETIMEOFFSET()))`,
                      [dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ')],
                    );
                  } else {
                    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
                    val = dayjs(val).utc().format('YYYY-MM-DD HH:mm:ssZ');
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
                const { func, msg } = validate;
                for (let j = 0; j < func.length; ++j) {
                  const fn =
                    typeof func[j] === 'string'
                      ? customValidators[func[j]]
                        ? customValidators[func[j]]
                        : Validator[func[j]]
                      : func[j];
                  const columnValue =
                    insertObj?.[cn] || insertObj?.[columnTitle];
                  const arg =
                    typeof func[j] === 'string'
                      ? columnValue + ''
                      : columnValue;
                  if (
                    ![null, undefined, ''].includes(columnValue) &&
                    !(fn.constructor.name === 'AsyncFunction'
                      ? await fn(arg)
                      : fn(arg))
                  ) {
                    NcError.badRequest(
                      msg[j]
                        .replace(/\{VALUE}/g, columnValue)
                        .replace(/\{cn}/g, columnTitle),
                    );
                  }
                }
              }
            }
          }

          await this.prepareNocoData(insertObj, true, cookie);

          // prepare nested link data for insert only if it is single record insertion
          if (isSingleRecordInsertion) {
            const operations = await this.prepareNestedLinkQb({
              nestedCols,
              data: d,
              insertObj,
            });

            postInsertOps = operations.postInsertOps;
            preInsertOps = operations.preInsertOps;
          }

          insertDatas.push(insertObj);
        }

        aiPkCol = this.model.primaryKeys.find((pk) => pk.ai);
        agPkCol = this.model.primaryKeys.find((pk) => pk.meta?.ag);
      } else {
        await this.model.getColumns(this.context);

        await Promise.all(
          insertDatas.map((d) => this.prepareNocoData(d, true, cookie)),
        );
      }

      if ('beforeBulkInsert' in this) {
        await this.beforeBulkInsert(insertDatas, trx, cookie);
      }

      // await this.beforeInsertb(insertDatas, null);

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      trx = await this.dbDriver.transaction();

      if (!foreign_key_checks) {
        if (this.isPg) {
          await trx.raw('set session_replication_role to replica;');
        } else if (this.isMySQL) {
          await trx.raw('SET foreign_key_checks = 0;');
        }
      }

      await this.runOps(
        preInsertOps.map((f) => f()),
        trx,
      );

      let responses;

      // insert one by one as fallback to get ids for sqlite and mysql
      if (insertOneByOneAsFallback && (this.isSqlite || this.isMySQL)) {
        // sqlite and mysql doesn't support returning, so insert one by one and return ids
        responses = [];

        for (const insertData of insertDatas) {
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
                .batchInsert(this.tnPath, insertDatas, chunkSize)
                .returning(this.model.primaryKeys?.length ? returningObj : '*')
            : await trx.batchInsert(this.tnPath, insertDatas, chunkSize);
      }

      if (!foreign_key_checks) {
        if (this.isPg) {
          await trx.raw('set session_replication_role to origin;');
        } else if (this.isMySQL) {
          await trx.raw('SET foreign_key_checks = 1;');
        }
      }

      // insert nested link data for single record insertion
      if (isSingleRecordInsertion) {
        let rowId = responses[0][this.model.primaryKey?.title];

        if (aiPkCol || agPkCol) {
          rowId = this.extractCompositePK({
            rowId,
            ai: aiPkCol,
            ag: agPkCol,
            insertObj: insertDatas[0],
          });
        }

        await this.runOps(
          postInsertOps.map((f) => f(rowId)),
          trx,
        );
      }

      await trx.commit();

      if (!raw && !skip_hooks) {
        if (isSingleRecordInsertion) {
          const insertData = await this.readByPk(responses[0]);
          await this.afterInsert(insertData, this.dbDriver, cookie);
        } else {
          await this.afterBulkInsert(insertDatas, this.dbDriver, cookie);
        }
      }

      return responses;
    } catch (e) {
      await trx?.rollback();
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async bulkUpdate(
    datas: any[],
    {
      cookie,
      raw = false,
      throwExceptionIfNotExist = false,
      isSingleRecordUpdation = false,
    }: {
      cookie?: any;
      raw?: boolean;
      throwExceptionIfNotExist?: boolean;
      isSingleRecordUpdation?: boolean;
    } = {},
  ) {
    let transaction;
    try {
      const columns = await this.model.getColumns(this.context);

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await this.validate(d, columns);
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
      const pkAndData: { pk: any; data: any }[] = [];
      const readChunkSize = 100;
      for (const [i, d] of updateDatas.entries()) {
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
        if (!raw) {
          pkAndData.push({
            pk: pkValues,
            data: d,
          });

          if (
            pkAndData.length >= readChunkSize ||
            i === updateDatas.length - 1
          ) {
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

            for (const record of tempToRead) {
              const oldRecord = oldRecords.find((r) =>
                this.comparePks(this.extractPksValues(r), record.pk),
              );

              if (!oldRecord) {
                // throw or skip if no record found
                if (throwExceptionIfNotExist) {
                  NcError.recordNotFound(record);
                }
                continue;
              }

              await this.prepareNocoData(record.data, false, cookie, oldRecord);

              prevData.push(oldRecord);
            }

            for (let i = 0; i < tempToRead.length; i++) {
              const { pk, data } = tempToRead[i];
              const wherePk = await this._wherePk(pk, true);
              toBeUpdated.push({ d: data, wherePk });
              updatePkValues.push(
                getCompositePkValue(this.model.primaryKeys, {
                  ...prevData[i],
                  ...data,
                }),
              );
            }
          }
        } else {
          await this.prepareNocoData(d, false, cookie);

          const wherePk = await this._wherePk(pkValues, true);

          toBeUpdated.push({ d, wherePk });

          updatePkValues.push(
            getCompositePkValue(this.model.primaryKeys, {
              ...pkValues,
              ...d,
            }),
          );
        }
      }

      transaction = await this.dbDriver.transaction();

      for (const o of toBeUpdated) {
        await transaction(this.tnPath).update(o.d).where(o.wherePk);
      }

      await transaction.commit();

      if (!raw) {
        while (updatePkValues.length) {
          const updatedRecords = await this.list(
            {
              pks: updatePkValues.splice(0, readChunkSize).join(','),
            },
            {
              limitOverride: readChunkSize,
            },
          );

          newData.push(...updatedRecords);
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

  async bulkUpdateAll(
    args: {
      where?: string;
      filterArr?: Filter[];
      viewId?: string;
      skipValidationAndHooks?: boolean;
    } = {},
    data,
    { cookie }: { cookie?: any } = {},
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
        const filterObj = extractFilterFromXwhere(where, aliasColObjMap, true);

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

      const execQueries: ((
        trx: Knex.Transaction,
        ids: any[],
      ) => Promise<any>)[] = [];

      const base = await this.getSource();

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

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
    args: { where?: string; filterArr?: Filter[] } = {},
    { cookie }: { cookie?: any } = {},
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
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap, true);

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
        undefined,
        true,
      );
      const execQueries: ((trx: Knex.Transaction, qb: any) => Promise<any>)[] =
        [];
      // qb.del();

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

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
                continue;
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

      await this.afterBulkDelete(response.length, this.dbDriver, cookie, true);

      return response;
    } catch (e) {
      throw e;
    }
  }

  /**
   *  Hooks
   * */

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.insert', null, data, req);
  }

  public async beforeBulkInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.bulkInsert', null, data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('after.insert', null, data, req);
    const id = this.extractPksValues(data);

    let details = '';

    if (data && typeof data === 'object') {
      const updateObj = await this.model.mapColumnToAlias(
        this.context,
        data,
        this.model.columns?.filter((c) => !c.pk && !isSystemColumn(c)),
      );

      for (const k of Object.keys(updateObj)) {
        if (
          updateObj[k] === null ||
          updateObj[k] === undefined ||
          (typeof updateObj[k] === 'string' && updateObj[k] === '')
        ) {
          continue;
        }

        const newValue =
          typeof updateObj[k] === 'object'
            ? JSON.stringify(updateObj[k])
            : updateObj[k];
        details += DOMPurify.sanitize(`<span class="">${k}</span>
          : <span class="black--text green lighten-4 px-2">${newValue}</span>`);
      }
    }

    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.INSERT,
      description: DOMPurify.sanitize(
        `Record with ID ${id} has been inserted into Table ${this.model.title}`,
      ),
      details: details || null,
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkUpdate(
    prevData: any,
    newData: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    let noOfUpdatedRecords = newData;
    if (!isBulkAllOperation) {
      noOfUpdatedRecords = newData.length;
      await this.handleHooks('after.bulkUpdate', prevData, newData, req);
    }

    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_UPDATE,
      description: DOMPurify.sanitize(
        `${noOfUpdatedRecords} ${
          noOfUpdatedRecords > 1 ? 'records have' : 'record has'
        } been bulk updated in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkDelete(
    data: any,
    _trx: any,
    req,
    isBulkAllOperation = false,
  ): Promise<void> {
    let noOfDeletedRecords = data;
    if (!isBulkAllOperation) {
      noOfDeletedRecords = data.length;
      await this.handleHooks('after.bulkDelete', null, data, req);
    }

    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_DELETE,
      description: DOMPurify.sanitize(
        `${noOfDeletedRecords} ${
          noOfDeletedRecords > 1 ? 'records have' : 'record has'
        } been bulk deleted in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
  }

  public async afterBulkInsert(data: any[], _trx: any, req): Promise<void> {
    await this.handleHooks('after.bulkInsert', null, data, req);

    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.BULK_INSERT,
      description: DOMPurify.sanitize(
        `${data.length} ${
          data.length > 1 ? 'records have' : 'record has'
        } been bulk inserted in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
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
    const id = this.extractPksValues(newData);
    let desc = `Record with ID ${id} has been updated in Table ${this.model.title}.`;
    let details = '';
    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(this.context, updateObj);

      for (const k of Object.keys(updateObj)) {
        const prevValue =
          typeof prevData[k] === 'object'
            ? JSON.stringify(prevData[k])
            : prevData[k];
        const newValue =
          typeof newData[k] === 'object'
            ? JSON.stringify(newData[k])
            : newData[k];
        desc += `\n`;
        desc += `Column "${k}" got changed from "${prevValue}" to "${newValue}"`;
        details += DOMPurify.sanitize(`<span class="">${k}</span>
  : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${prevValue}</span>
  <span class="black--text green lighten-4 px-2">${newValue}</span>`);
      }
    }
    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UPDATE,
      description: DOMPurify.sanitize(desc),
      details,
      ip: req?.clientIp,
      user: req?.user?.email,
    });

    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('after.update', prevData, newData, req);
    }
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('before.delete', null, data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    const id = this.extractPksValues(data);
    await Audit.insert({
      fk_workspace_id: this.model.fk_workspace_id,
      base_id: this.model.base_id,
      source_id: this.model.source_id,
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.DELETE,
      description: DOMPurify.sanitize(
        `Record with ID ${id} has been deleted in Table ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
    await this.handleHooks('after.delete', null, data, req);
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

  protected async errorInsert(_e, _data, _trx, _cookie) {}

  protected async errorUpdate(_e, _data, _trx, _cookie) {}

  // todo: handle composite primary key
  public extractPksValues(data: any, asString = false) {
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
      return (
        data[this.model.primaryKey.title] ??
        data[this.model.primaryKey.column_name]
      );
    } else {
      return 'N/A';
    }
  }

  protected async errorDelete(_e, _id, _trx, _cookie) {}

  async validate(
    data: Record<string, any>,
    columns?: Column[],
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

        if (column.system && column.uidt !== UITypes.ForeignKey) {
          NcError.badRequest(
            `Column "${column.title}" is system column and cannot be updated`,
          );
        }
      }
      await this.validateOptions(column, data);
      // Validates the constraints on the data based on the column definitions
      this.validateConstraints(column, data);

      // skip validation if `validate` is undefined or false
      if (!column?.meta?.validate || !column?.validate) continue;

      const validate = column.getValidators();
      const cn = column.column_name;
      const columnTitle = column.title;
      if (!validate) continue;

      const { func, msg } = validate;
      for (let j = 0; j < func.length; ++j) {
        const fn =
          typeof func[j] === 'string'
            ? customValidators[func[j]]
              ? customValidators[func[j]]
              : Validator[func[j]]
            : func[j];
        const columnValue = data?.[cn] || data?.[columnTitle];
        const arg =
          typeof func[j] === 'string' ? columnValue + '' : columnValue;
        if (
          ![null, undefined, ''].includes(columnValue) &&
          !(fn.constructor.name === 'AsyncFunction' ? await fn(arg) : fn(arg))
        ) {
          NcError.badRequest(
            msg[j]
              .replace(/\{VALUE}/g, columnValue)
              .replace(/\{cn}/g, columnTitle),
          );
        }
      }
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

    // if multi select, then split the values
    const columnValueArr =
      column.uidt === UITypes.MultiSelect
        ? columnValue.split(',')
        : [columnValue];
    for (let j = 0; j < columnValueArr.length; ++j) {
      const val = columnValueArr[j];
      if (!options.includes(val) && !options.includes(`'${val}'`)) {
        NcError.badRequest(
          `Invalid option "${val}" provided for column "${columnTitle}". Valid options are "${options.join(
            ', ',
          )}"`,
        );
      }
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
    const columns = await this.model.getColumns(this.context);
    const column = columns.find((c) => c.id === colId);

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

    const childColumn = await colOptions.getChildColumn(this.context);
    const parentColumn = await colOptions.getParentColumn(this.context);
    const parentTable = await parentColumn.getModel(this.context);
    const childTable = await childColumn.getModel(this.context);
    await childTable.getColumns(this.context);
    await parentTable.getColumns(this.context);

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      model: parentTable,
      dbDriver: this.dbDriver,
    });

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const relatedChildCol = getRelatedLinksColumn(
      column,
      this.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditUpdateObj = [] as {
      rowId: string;
      childId: string;
      model: Model;
      childModel: Model;
      op_sub_type:
        | AuditOperationSubTypes.LINK_RECORD
        | AuditOperationSubTypes.UNLINK_RECORD;
      columnTitle: string;
      pkValue?: Record<string, any>;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
    };

    const triggerAfterRemoveChild = async () => {
      await Promise.allSettled(
        auditUpdateObj
          .filter((a) => a.op_sub_type === AuditOperationSubTypes.UNLINK_RECORD)
          .map((updateObj) => {
            this.afterRemoveChild(
              updateObj.columnTitle,
              updateObj.rowId,
              updateObj.childId,
              cookie,
              updateObj.model,
              updateObj.childModel,
              updateObj.pkValue,
            );
          }),
      );
    };

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(this.context);
          const vParentCol = await colOptions.getMMParentColumn(this.context);
          const vTable = await colOptions.getMMModel(this.context);

          const assocBaseModel = await Model.getBaseModelSQL(this.context, {
            model: vTable,
            dbDriver: this.dbDriver,
          });

          const vTn = assocBaseModel.getTnPath(vTable);

          if (this.isSnowflake || this.isDatabricks) {
            const parentPK = parentBaseModel
              .dbDriver(parentTn)
              .select(parentColumn.column_name)
              .where(_wherePk(parentTable.primaryKeys, childId))
              .first();

            const childPK = childBaseModel
              .dbDriver(childTn)
              .select(childColumn.column_name)
              .where(_wherePk(childTable.primaryKeys, rowId))
              .first();

            await this.execAndParse(
              this.dbDriver.raw(
                `INSERT INTO ?? (??, ??) SELECT (${parentPK.toQuery()}), (${childPK.toQuery()})`,
                [vTn, vParentCol.column_name, vChildCol.column_name],
              ) as any,
              null,
              { raw: true },
            );
          } else {
            await this.execAndParse(
              this.dbDriver(vTn).insert({
                [vParentCol.column_name]: this.dbDriver(parentTn)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, childId))
                  .first(),
                [vChildCol.column_name]: this.dbDriver(childTn)
                  .select(childColumn.column_name)
                  .where(_wherePk(childTable.primaryKeys, rowId))
                  .first(),
              }),
              null,
              { raw: true },
            );
          }

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
          await this.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            this.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            this.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          const linkedHmRowObj = await this.execAndParse(
            this.dbDriver(childTn)
              .select(
                ...new Set(
                  [childColumn, ...childTable.primaryKeys].map(
                    (col) => `${childTable.table_name}.${col.column_name}`,
                  ),
                ),
              )
              .where(_wherePk(childTable.primaryKeys, childId)),
            null,
            { raw: true, first: true },
          );

          const oldRowId = linkedHmRowObj
            ? linkedHmRowObj?.[childTable.primaryKey?.column_name]
            : null;

          if (oldRowId) {
            const [parentRelatedPkValue, childRelatedPkValue] =
              await this.readOnlyPrimariesByPkFromModel([
                { model: childTable, id: childId },
                { model: parentTable, id: oldRowId },
              ]);

            auditUpdateObj.push({
              model: auditConfig.parentModel,
              childModel: auditConfig.childModel,
              rowId: oldRowId as string,
              childId,
              op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
              columnTitle: auditConfig.parentColTitle,
              pkValue: parentRelatedPkValue,
            });

            if (parentTable.id !== childTable.id) {
              auditUpdateObj.push({
                model: auditConfig.childModel,
                childModel: auditConfig.parentModel,
                rowId: childId,
                childId: oldRowId as string,
                op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                columnTitle: auditConfig.childColTitle,
                pkValue: childRelatedPkValue,
              });
            }
          }

          await this.execAndParse(
            this.dbDriver(childTn)
              .update({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, rowId))
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, childId)),
            null,
            { raw: true },
          );
          await triggerAfterRemoveChild();

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          if (onlyUpdateAuditLogs) {
            const oldChildRowId = prevData[column.title]
              ? getCompositePkValue(
                  parentTable.primaryKeys,
                  this.extractPksValues(prevData[column.title]),
                )
              : null;

            if (oldChildRowId) {
              auditUpdateObj.push({
                model: auditConfig.parentModel,
                childModel: auditConfig.childModel,
                rowId,
                childId: oldChildRowId as string,
                op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                columnTitle: auditConfig.parentColTitle,
                pkValue:
                  prevData[column.title]?.[parentTable.displayValue.title] ??
                  null,
              });

              const [childRelatedPkValue] =
                await this.readOnlyPrimariesByPkFromModel([
                  { model: childTable, id: rowId },
                ]);

              if (parentTable.id !== childTable.id) {
                auditUpdateObj.push({
                  model: auditConfig.childModel,
                  childModel: auditConfig.parentModel,
                  rowId: oldChildRowId as string,
                  childId: rowId,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.childColTitle,
                  pkValue: childRelatedPkValue,
                });
              }
            }
            await triggerAfterRemoveChild();
          } else {
            const linkedHmRowObj = await this.execAndParse(
              this.dbDriver(childTn)
                .select(
                  ...new Set(
                    [childColumn, ...childTable.primaryKeys].map(
                      (col) => col.column_name,
                    ),
                  ),
                )
                .where(_wherePk(childTable.primaryKeys, rowId)),
              null,
              { raw: true, first: true },
            );

            const oldChildRowId = linkedHmRowObj
              ? linkedHmRowObj[childTable.primaryKeys[0]?.column_name]
              : null;

            if (oldChildRowId) {
              const [parentRelatedPkValue, childRelatedPkValue] =
                await this.readOnlyPrimariesByPkFromModel([
                  { model: parentTable, id: oldChildRowId },
                  { model: childTable, id: rowId },
                ]);

              auditUpdateObj.push({
                model: auditConfig.parentModel,
                childModel: auditConfig.childModel,
                rowId,
                childId: oldChildRowId as string,
                op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                columnTitle: auditConfig.parentColTitle,
                pkValue: parentRelatedPkValue,
              });

              if (parentTable.id !== childTable.id) {
                auditUpdateObj.push({
                  model: auditConfig.childModel,
                  childModel: auditConfig.parentModel,
                  rowId: oldChildRowId as string,
                  childId: rowId,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.childColTitle,
                  pkValue: childRelatedPkValue,
                });
              }
            }

            await this.execAndParse(
              this.dbDriver(childTn)
                .update({
                  [childColumn.column_name]: this.dbDriver.from(
                    this.dbDriver(parentTn)
                      .select(parentColumn.column_name)
                      .where(_wherePk(parentTable.primaryKeys, childId))
                      .first()
                      .as('___cn_alias'),
                  ),
                })
                .where(_wherePk(childTable.primaryKeys, rowId)),
              null,
              { raw: true },
            );

            await triggerAfterRemoveChild();

            await this.updateLastModified({
              baseModel: parentBaseModel,
              model: parentTable,
              rowIds: [childId],
              cookie,
            });
          }
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          const isBt = column.meta?.bt;
          auditConfig.parentModel = isBt ? childTable : parentTable;
          auditConfig.childModel = isBt ? parentTable : childTable;

          let linkedOoRowObj;
          let linkedCurrentOoRowObj;
          if (isBt) {
            // 1. check current row is linked with another child
            linkedCurrentOoRowObj = await this.execAndParse(
              this.dbDriver(childTn)
                .select(
                  ...new Set(
                    [childColumn, ...childTable.primaryKeys].map(
                      (col) => col.column_name,
                    ),
                  ),
                )
                .where(_wherePk(childTable.primaryKeys, rowId)),
              null,
              { raw: true, first: true },
            );

            const oldChildRowId = linkedCurrentOoRowObj
              ? linkedCurrentOoRowObj[childTable.primaryKeys[0]?.column_name]
              : null;

            if (oldChildRowId) {
              const [parentRelatedPkValue, childRelatedPkValue] =
                await this.readOnlyPrimariesByPkFromModel([
                  { model: parentTable, id: oldChildRowId },
                  { model: childTable, id: rowId },
                ]);

              auditUpdateObj.push({
                model: auditConfig.parentModel,
                childModel: auditConfig.childModel,
                rowId,
                childId: oldChildRowId as string,
                op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                columnTitle: auditConfig.parentColTitle,
                pkValue: parentRelatedPkValue,
              });

              if (parentTable.id !== childTable.id) {
                auditUpdateObj.push({
                  model: auditConfig.childModel,
                  childModel: auditConfig.parentModel,
                  rowId: oldChildRowId as string,
                  childId: rowId,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.childColTitle,
                  pkValue: childRelatedPkValue,
                });
              }
            }

            // 2. check current child is linked with another row cell
            linkedOoRowObj = await this.execAndParse(
              this.dbDriver(childTn).where({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(
                      _wherePk(parentTable.primaryKeys, isBt ? childId : rowId),
                    )
                    .first()
                    .as('___cn_alias'),
                ),
              }),
              null,
              { raw: true, first: true },
            );

            if (linkedOoRowObj) {
              const oldRowId = getCompositePkValue(
                childTable.primaryKeys,
                this.extractPksValues(linkedOoRowObj),
              );

              if (oldRowId) {
                const [parentRelatedPkValue, childRelatedPkValue] =
                  await this.readOnlyPrimariesByPkFromModel([
                    { model: parentTable, id: childId },
                    { model: childTable, id: oldRowId },
                  ]);

                auditUpdateObj.push({
                  model: auditConfig.parentModel,
                  childModel: auditConfig.childModel,
                  rowId: oldRowId as string,
                  childId: childId,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.parentColTitle,
                  pkValue: parentRelatedPkValue,
                });

                if (parentTable.id !== childTable.id) {
                  auditUpdateObj.push({
                    model: auditConfig.childModel,
                    childModel: auditConfig.parentModel,
                    rowId: childId,
                    childId: oldRowId as string,
                    op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                    columnTitle: auditConfig.childColTitle,
                    pkValue: childRelatedPkValue,
                  });
                }
              }
            }
          } else {
            // 1. check current row is linked with another child
            linkedCurrentOoRowObj = await this.execAndParse(
              this.dbDriver(childTn).where({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, rowId))
                    .first()
                    .as('___cn_alias'),
                ),
              }),
              null,
              { raw: true, first: true },
            );

            if (linkedCurrentOoRowObj) {
              const oldChildRowId = getCompositePkValue(
                childTable.primaryKeys,
                this.extractPksValues(linkedCurrentOoRowObj),
              );

              if (oldChildRowId) {
                const [parentRelatedPkValue, childRelatedPkValue] =
                  await this.readOnlyPrimariesByPkFromModel([
                    { model: childTable, id: oldChildRowId },
                    { model: parentTable, id: rowId },
                  ]);

                auditUpdateObj.push({
                  model: auditConfig.parentModel,
                  childModel: auditConfig.childModel,
                  rowId,
                  childId: oldChildRowId as string,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.parentColTitle,
                  pkValue: parentRelatedPkValue,
                });

                if (parentTable.id !== childTable.id) {
                  auditUpdateObj.push({
                    model: auditConfig.childModel,
                    childModel: auditConfig.parentModel,
                    rowId: oldChildRowId as string,
                    childId: rowId,
                    op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                    columnTitle: auditConfig.childColTitle,
                    pkValue: childRelatedPkValue,
                  });
                }
              }
            }

            // 2. check current child is linked with another row cell
            linkedOoRowObj = await this.execAndParse(
              this.dbDriver(childTn)
                .select(
                  ...new Set(
                    [childColumn, ...childTable.primaryKeys].map(
                      (col) => `${childTable.table_name}.${col.column_name}`,
                    ),
                  ),
                )
                .where(_wherePk(childTable.primaryKeys, childId)),
              null,
              { raw: true, first: true },
            );

            const oldRowId = linkedOoRowObj
              ? linkedOoRowObj[childTable.primaryKeys[0]?.column_name]
              : null;
            if (oldRowId) {
              const [parentRelatedPkValue, childRelatedPkValue] =
                await this.readOnlyPrimariesByPkFromModel([
                  { model: childTable, id: childId },
                  { model: parentTable, id: oldRowId },
                ]);

              auditUpdateObj.push({
                model: auditConfig.parentModel,
                childModel: auditConfig.childModel,
                rowId: oldRowId as string,
                childId: childId,
                op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                columnTitle: auditConfig.parentColTitle,
                pkValue: parentRelatedPkValue,
              });

              if (parentTable.id !== childTable.id) {
                auditUpdateObj.push({
                  model: auditConfig.childModel,
                  childModel: auditConfig.parentModel,
                  rowId: childId,
                  childId: oldRowId as string,
                  op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
                  columnTitle: auditConfig.childColTitle,
                  pkValue: childRelatedPkValue,
                });
              }
            }
          }

          // todo: unlink if it's already mapped
          // unlink already mapped record if any
          await this.execAndParse(
            this.dbDriver(childTn)
              .where({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(
                      _wherePk(parentTable.primaryKeys, isBt ? childId : rowId),
                    )
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await triggerAfterRemoveChild();

          await this.execAndParse(
            this.dbDriver(childTn)
              .update({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(
                      _wherePk(parentTable.primaryKeys, isBt ? childId : rowId),
                    )
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, isBt ? rowId : childId)),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
    }

    auditUpdateObj.push({
      model: auditConfig.parentModel,
      childModel: auditConfig.childModel,
      rowId,
      childId,
      op_sub_type: AuditOperationSubTypes.LINK_RECORD,
      columnTitle: auditConfig.parentColTitle,
    });

    if (parentTable.id !== childTable.id) {
      auditUpdateObj.push({
        model: auditConfig.childModel,
        childModel: auditConfig.parentModel,
        rowId: childId,
        childId: rowId,
        op_sub_type: AuditOperationSubTypes.LINK_RECORD,
        columnTitle: auditConfig.childColTitle,
      });
    }

    await Promise.allSettled(
      auditUpdateObj
        .filter((a) => a.op_sub_type === AuditOperationSubTypes.LINK_RECORD)
        .map((updateObj) => {
          this.afterAddChild(
            updateObj.columnTitle,
            updateObj.rowId,
            updateObj.childId,
            cookie,
            updateObj.model,
            updateObj.childModel,
            updateObj.pkValue,
          );
        }),
    );
  }

  public async afterAddChild(
    columnTitle,
    rowId,
    childId,
    req,
    model = this.model,
    childModel = this.model,
    pkValue = undefined,
  ): Promise<void> {
    if (!pkValue) {
      pkValue = await this.readByPkFromModel(
        childModel,
        undefined,
        true,
        childId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert({
      fk_workspace_id: model.fk_workspace_id,
      base_id: model.base_id,
      source_id: model.source_id,
      fk_model_id: model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.LINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been linked with record [id:${rowId}] in ${model.title}`,
      ),
      details: DOMPurify.sanitize(`<span class="">${columnTitle}</span>
      : <span class="black--text green lighten-4 px-2">${
        pkValue ?? null
      }</span>`),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
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
    const columns = await this.model.getColumns(this.context);
    const column = columns.find((c) => c.id === colId);
    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );

    const childColumn = await colOptions.getChildColumn(this.context);
    const parentColumn = await colOptions.getParentColumn(this.context);
    const parentTable = await parentColumn.getModel(this.context);
    const childTable = await childColumn.getModel(this.context);
    await childTable.getColumns(this.context);
    await parentTable.getColumns(this.context);

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      model: parentTable,
      dbDriver: this.dbDriver,
    });

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const relatedChildCol = getRelatedLinksColumn(
      column,
      this.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditUpdateObj = [] as {
      rowId: string;
      childId: string;
      model: Model;
      childModel: Model;
      columnTitle: string;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
    };

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(this.context);
          const vParentCol = await colOptions.getMMParentColumn(this.context);
          const vTable = await colOptions.getMMModel(this.context);
          const assocBaseModel = await Model.getBaseModelSQL(this.context, {
            model: vTable,
            dbDriver: this.dbDriver,
          });
          const vTn = assocBaseModel.getTnPath(vTable);

          await this.execAndParse(
            this.dbDriver(vTn)
              .where({
                [vParentCol.column_name]: this.dbDriver(parentTn)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, childId))
                  .first(),
                [vChildCol.column_name]: this.dbDriver(childTn)
                  .select(childColumn.column_name)
                  .where(_wherePk(childTable.primaryKeys, rowId))
                  .first(),
              })
              .delete(),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
          await this.updateLastModified({
            baseModel: childBaseModel,
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            this.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            this.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await this.execAndParse(
            this.dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: this.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, rowId)
              //     .first()
              // })
              .where(_wherePk(childTable.primaryKeys, childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          await this.execAndParse(
            this.dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: this.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, childId)
              //     .first()
              // })
              .where(_wherePk(childTable.primaryKeys, rowId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          const isBt = column.meta?.bt;

          auditConfig.parentModel = isBt ? childTable : parentTable;
          auditConfig.childModel = isBt ? parentTable : childTable;

          await this.execAndParse(
            this.dbDriver(childTn)
              .where(_wherePk(childTable.primaryKeys, isBt ? rowId : childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            baseModel: parentBaseModel,
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
    }

    auditUpdateObj.push({
      model: auditConfig.parentModel,
      childModel: auditConfig.childModel,
      rowId,
      childId,
      columnTitle: auditConfig.parentColTitle,
    });

    if (parentTable.id !== childTable.id) {
      auditUpdateObj.push({
        model: auditConfig.childModel,
        childModel: auditConfig.parentModel,
        rowId: childId,
        childId: rowId,
        columnTitle: auditConfig.childColTitle,
      });
    }

    await Promise.allSettled(
      auditUpdateObj.map(async (updateObj) => {
        await this.afterRemoveChild(
          updateObj.columnTitle,
          updateObj.rowId,
          updateObj.childId,
          cookie,
          updateObj.model,
          updateObj.childModel,
        );
      }),
    );
  }

  public async afterRemoveChild(
    columnTitle,
    rowId,
    childId,
    req,
    model = this.model,
    childModel = this.model,
    pkValue = undefined,
  ): Promise<void> {
    if (!pkValue) {
      pkValue = await this.readByPkFromModel(
        childModel,
        undefined,
        true,
        childId,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true, extractOnlyPrimaries: true },
      );
    }

    await Audit.insert({
      fk_workspace_id: model.fk_workspace_id,
      base_id: model.base_id,
      source_id: model.source_id,
      fk_model_id: model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been unlinked with record [id:${rowId}] in ${model.title}`,
      ),
      details: DOMPurify.sanitize(`<span class="">${columnTitle}</span>
        : <span class="text-decoration-line-through red px-2 lighten-4 black--text">${
          pkValue && typeof pkValue === 'object'
            ? Object.values(pkValue)[0]
            : pkValue ?? null
        }</span>`),
      ip: req?.clientIp,
      user: req?.user?.email,
    });
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
      let sorts = extractSortsObject(args?.sort, aliasColObjMap);
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
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
      if (this.model.primaryKey && this.model.primaryKey.ai) {
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
                query.whereNull(column.column_name);
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
          if (!aggObj.has(row[column.title])) {
            aggObj.set(row[column.title], []);
          }

          aggObj.get(row[column.title]).push(row);

          return aggObj;
        },
        new Map(),
      );

      const r = [...groupingValues].map((key) => ({
        key,
        value: groupedResult.get(key) ?? [],
      }));

      return r;
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

    const qb = this.dbDriver(this.tnPath)
      .count('*', { as: 'count' })
      .groupBy(column.column_name);

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap(
      this.context,
      columns,
    );
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
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
      // replace id with 'key' as we select as id
      columns: [new Column({ ...column, title: 'key', id: 'key' })],
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
      skipButtonConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
      bulkAggregate?: boolean;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      skipButtonConversion: false,
      raw: false,
      first: false,
      bulkAggregate: false,
    },
  ) {
    if (options.raw) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
      options.skipButtonConversion = true;
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
      data = await this.convertUserFormat(data, dependencyColumns);
    }

    if (!options.skipButtonConversion) {
      data = await this.convertButtonType(data, dependencyColumns);
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
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        ltarMap[col.id] = true;
        const linkData = Object.values(data).find(
          (d) => d[col.id] && Object.keys(d[col.id]),
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
            if (value && typeof value === 'object') {
              const tempObj = Array.isArray(value)
                ? value.map((arrVal) => transformObject(arrVal, idToAliasMap))
                : transformObject(value, idToAliasMap);
              item[alias] = tempObj;
              item[alias] = tempObj;
            } else {
              item[alias] = value;
            }
          } else {
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

        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) => this._convertUserFormat(userColumns, baseUsers, d)),
          );
        } else {
          data = await this._convertUserFormat(userColumns, baseUsers, data);
        }
      }
    }
    return data;
  }

  protected _convertUserFormat(
    userColumns: Column[],
    baseUsers: Partial<User>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        const availableUserColumns = userColumns.filter(
          (col) => d[col.id] && d[col.id].length,
        );
        for (const col of availableUserColumns) {
          d[col.id] = d[col.id].split(',');

          d[col.id] = d[col.id].map((fid) => {
            const { id, email, display_name } = baseUsers.find(
              (u) => u.id === fid,
            );
            return {
              id,
              email,
              display_name: display_name?.length ? display_name : null,
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

  protected async _convertButtonType(
    buttonColumns: Record<string, any>[],
    d: Record<string, any>,
  ) {
    try {
      if (d) {
        for (const col of buttonColumns) {
          if (d[col.id] && typeof d[col.id] === 'string') {
            d[col.id] = JSON.parse(d[col.id]);
          }

          if (d[col.id]?.length) {
            for (let i = 0; i < d[col.id].length; i++) {
              if (typeof d[col.id][i] === 'string') {
                d[col.id][i] = JSON.parse(d[col.id][i]);
              }
            }
          }
        }
      }
    } catch {}
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

  public async convertButtonType(
    data: Record<string, any>,
    dependencyColumns?: Column[],
  ) {
    // buttons result are stringified json in Sqlite and need to be parsed
    // convertButtonType is used to convert the response in string to array of object in API response
    if (data) {
      const buttonCols = [];

      const columns = this.model?.columns.concat(dependencyColumns ?? []);

      for (const col of columns) {
        if (col.uidt === UITypes.Lookup) {
          if ((await this.getNestedColumn(col))?.uidt === UITypes.Button) {
            buttonCols.push(col);
          }
        } else {
          if (col.uidt === UITypes.Button) {
            buttonCols.push(col);
          }
        }
      }

      if (buttonCols.length) {
        if (Array.isArray(data)) {
          data = await Promise.all(
            data.map((d) => this._convertButtonType(buttonCols, d)),
          );
        } else {
          data = await this._convertButtonType(buttonCols, data);
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

  async addLinks({
    cookie,
    childIds: _childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) {
    const columns = await this.model.getColumns(this.context);
    const column = columns.find((c) => c.id === colId);

    if (!column || !isLinksOrLTAR(column)) NcError.fieldNotFound(colId);

    const row = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.recordNotFound(rowId);
    }

    if (!_childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );

    const childColumn = await colOptions.getChildColumn(this.context);
    const parentColumn = await colOptions.getParentColumn(this.context);
    const parentTable = await parentColumn.getModel(this.context);
    const childTable = await childColumn.getModel(this.context);
    await childTable.getColumns(this.context);
    await parentTable.getColumns(this.context);

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      model: childTable,
      dbDriver: this.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      model: parentTable,
      dbDriver: this.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    let relationType = colOptions.type;
    let childIds = _childIds;

    const relatedChildCol = getRelatedLinksColumn(
      column,
      this.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditUpdateObj = [] as {
      rowId: string | number;
      childId: string | number;
      model: Model;
      childModel: Model;
      op_sub_type:
        | AuditOperationSubTypes.LINK_RECORD
        | AuditOperationSubTypes.UNLINK_RECORD;
      columnTitle: string;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
    };

    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = column.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
      childIds = childIds.slice(0, 1);

      // unlink
      await this.execAndParse(
        this.dbDriver(childTn)
          .where({
            [childColumn.column_name]: this.dbDriver.from(
              this.dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(
                  _wherePk(
                    parentTable.primaryKeys,
                    column.meta?.bt ? childIds[0] : rowId,
                  ),
                )
                .first()
                .as('___cn_alias'),
            ),
          })
          .update({ [childColumn.column_name]: null }),
        null,
        { raw: true },
      );

      auditConfig.parentModel = column.meta?.bt ? childTable : parentTable;
      auditConfig.childModel = column.meta?.bt ? parentTable : childTable;
    }

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(this.context);
          const vParentCol = await colOptions.getMMParentColumn(this.context);
          const vTable = await colOptions.getMMModel(this.context);

          const assocBaseModel = await Model.getBaseModelSQL(this.context, {
            model: vTable,
            dbDriver: this.dbDriver,
          });

          const vTn = assocBaseModel.getTnPath(vTable);

          let insertData: Record<string, any>[];

          // validate Ids
          {
            const childRowsQb = this.dbDriver(parentTn)
              .select(`${parentTable.table_name}.${parentColumn.column_name}`)
              .select(`${vTable.table_name}.${vChildCol.column_name}`)
              .leftJoin(vTn, (qb) => {
                qb.on(
                  `${vTable.table_name}.${vParentCol.column_name}`,
                  `${parentTable.table_name}.${parentColumn.column_name}`,
                ).andOn(
                  `${vTable.table_name}.${vChildCol.column_name}`,
                  this.dbDriver.raw('?', [
                    row[childColumn.title] ?? row[childColumn.column_name],
                  ]),
                );
              });

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                `${parentTable.table_name}.${parentTable.primaryKey.column_name}`,
                typeof childIds[0] === 'object'
                  ? childIds.map(
                      (c) =>
                        c[parentTable.primaryKey.title] ??
                        c[parentTable.primaryKey.column_name],
                    )
                  : childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTable.table_name}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await this.execAndParse(childRowsQb, null, {
              raw: true,
            });

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }

            insertData = childRows
              // skip existing links
              .filter((childRow) => !childRow[vChildCol.column_name])
              // generate insert data for new links
              .map((childRow) => ({
                [vParentCol.column_name]:
                  childRow[parentColumn.title] ??
                  childRow[parentColumn.column_name],
                [vChildCol.column_name]:
                  row[childColumn.title] ?? row[childColumn.column_name],
              }));

            // if no new links, return true
            if (!insertData.length) return true;
          }

          // todo: use bulk insert
          await this.execAndParse(this.dbDriver(vTn).insert(insertData), null, {
            raw: true,
          });

          await this.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
          });
          await this.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            this.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            this.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          // validate Ids
          {
            const childRowsQb = this.dbDriver(childTn).select(
              childTable.primaryKey.column_name,
            );

            if (childTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(childTable.primaryKeys, childId));
                }
              });
            } else {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                typeof childIds[0] === 'object'
                  ? childIds.map(
                      (c) =>
                        c[parentTable.primaryKey.title] ??
                        c[parentTable.primaryKey.column_name],
                    )
                  : childIds,
              );
            }

            const childRows = await this.execAndParse(childRowsQb, null, {
              raw: true,
            });

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find((r) => r[parentColumn.column_name] === id),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }
          const updateQb = this.dbDriver(childTn).update({
            [childColumn.column_name]: this.dbDriver.from(
              this.dbDriver(parentTn)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, rowId))
                .first()
                .as('___cn_alias'),
            ),
          });
          if (childTable.primaryKeys.length > 1) {
            updateQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(childTable.primaryKeys, childId));
              }
            });
          } else {
            updateQb.whereIn(
              childTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map(
                    (c) =>
                      c[childTable.primaryKey.title] ??
                      c[childTable.primaryKey.column_name],
                  )
                : childIds,
            );
          }
          await this.execAndParse(updateQb, null, { raw: true });

          await this.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          // validate Ids
          {
            const childRowsQb = this.dbDriver(parentTn)
              .select(parentTable.primaryKey.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]))
              .first();

            const childRow = await this.execAndParse(childRowsQb, null, {
              first: true,
              raw: true,
            });

            if (!childRow) {
              NcError.recordNotFound(extractIds(childIds, true));
            }
          }

          await this.execAndParse(
            this.dbDriver(childTn)
              .update({
                [childColumn.column_name]: this.dbDriver.from(
                  this.dbDriver(parentTn)
                    .select(parentColumn.column_name)
                    .where(_wherePk(parentTable.primaryKeys, childIds[0]))
                    // .whereIn(parentTable.primaryKey.column_name, childIds)
                    .first()
                    .as('___cn_alias'),
                ),
              })
              .where(_wherePk(childTable.primaryKeys, rowId)),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
    }

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? Object.values(childId).join('_')
          : childId;

      auditUpdateObj.push({
        model: auditConfig.parentModel,
        childModel: auditConfig.childModel,
        rowId,
        childId: _childId,
        op_sub_type: AuditOperationSubTypes.LINK_RECORD,
        columnTitle: auditConfig.parentColTitle,
      });

      if (parentTable.id !== childTable.id) {
        auditUpdateObj.push({
          model: auditConfig.childModel,
          childModel: auditConfig.parentModel,
          rowId: _childId,
          childId: rowId,
          op_sub_type: AuditOperationSubTypes.LINK_RECORD,
          columnTitle: auditConfig.childColTitle,
        });
      }
    }

    await Promise.allSettled(
      auditUpdateObj.map(async (updateObj) => {
        await this.afterAddChild(
          updateObj.columnTitle,
          updateObj.rowId,
          updateObj.childId,
          cookie,
          updateObj.model,
          updateObj.childModel,
        );
      }),
    );
  }

  async removeLinks({
    cookie,
    childIds,
    colId,
    rowId,
  }: {
    cookie: any;
    childIds: (string | number | Record<string, any>)[];
    colId: string;
    rowId: string;
  }) {
    const columns = await this.model.getColumns(this.context);
    const column = columns.find((c) => c.id === colId);

    if (!column || !isLinksOrLTAR(column)) NcError.fieldNotFound(colId);

    const row = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    // validate rowId
    if (!row) {
      NcError.recordNotFound(rowId);
    }

    if (!childIds.length) return;

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>(
      this.context,
    );

    const childColumn = await colOptions.getChildColumn(this.context);
    const parentColumn = await colOptions.getParentColumn(this.context);
    const parentTable = await parentColumn.getModel(this.context);
    const childTable = await childColumn.getModel(this.context);
    await childTable.getColumns(this.context);
    await parentTable.getColumns(this.context);

    const childBaseModel = await Model.getBaseModelSQL(this.context, {
      model: childTable,
      dbDriver: this.dbDriver,
    });

    const parentBaseModel = await Model.getBaseModelSQL(this.context, {
      model: parentTable,
      dbDriver: this.dbDriver,
    });

    const childTn = childBaseModel.getTnPath(childTable);
    const parentTn = parentBaseModel.getTnPath(parentTable);

    const relatedChildCol = getRelatedLinksColumn(
      column,
      this.model.id === parentTable.id ? childTable : parentTable,
    );

    const auditUpdateObj = [] as {
      rowId: string | number;
      childId: string | number;
      model: Model;
      childModel: Model;
      op_sub_type:
        | AuditOperationSubTypes.LINK_RECORD
        | AuditOperationSubTypes.UNLINK_RECORD;
      columnTitle: string;
    }[];

    const auditConfig = {
      childModel: childTable,
      parentModel: parentTable,
      childColTitle: relatedChildCol?.title || '',
      parentColTitle: column.title,
    } as {
      childModel: Model;
      parentModel: Model;
      childColTitle: string;
      parentColTitle: string;
    };

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn(this.context);
          const vParentCol = await colOptions.getMMParentColumn(this.context);
          const vTable = await colOptions.getMMModel(this.context);

          const assocBaseModel = await Model.getBaseModelSQL(this.context, {
            model: vTable,
            dbDriver: this.dbDriver,
          });

          // validate Ids
          {
            const childRowsQb = this.dbDriver(parentTn).select(
              parentColumn.column_name,
            );

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                `${parentTable.table_name}.${parentTable.primaryKey.column_name}`,
                childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ||
                    c[parentTable.primaryKey.column_name],
                ),
              );
            } else {
              childRowsQb.whereIn(
                `${parentTable.table_name}.${parentTable.primaryKey.column_name}`,
                childIds,
              );
            }

            if (parentTable.primaryKey.column_name !== parentColumn.column_name)
              childRowsQb.select(
                `${parentTable.table_name}.${parentTable.primaryKey.column_name}`,
              );

            const childRows = await this.execAndParse(childRowsQb, null, {
              raw: true,
            });

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? id[parentTable.primaryKey.title] ??
                          id[parentTable.primaryKey.column_name]
                        : id),
                  ),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }

          const vTn = assocBaseModel.getTnPath(vTable);

          const delQb = this.dbDriver(vTn)
            .where({
              [vChildCol.column_name]: this.dbDriver(childTn)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first(),
            })
            .delete();

          delQb.whereIn(
            `${vTable.table_name}.${vParentCol.column_name}`,
            typeof childIds[0] === 'object'
              ? childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ??
                    c[parentTable.primaryKey.column_name],
                )
              : childIds,
          );
          await this.execAndParse(delQb, null, { raw: true });

          await this.updateLastModified({
            model: parentTable,
            rowIds: childIds,
            cookie,
          });
          await this.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });

          auditConfig.parentModel =
            this.model.id === parentTable.id ? parentTable : childTable;
          auditConfig.childModel =
            this.model.id === parentTable.id ? childTable : parentTable;
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          // validate Ids
          {
            const childRowsQb = this.dbDriver(childTn).select(
              childTable.primaryKey.column_name,
            );

            if (parentTable.primaryKeys.length > 1) {
              childRowsQb.where((qb) => {
                for (const childId of childIds) {
                  qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
                }
              });
            } else if (typeof childIds[0] === 'object') {
              childRowsQb.whereIn(
                parentTable.primaryKey.column_name,
                childIds.map(
                  (c) =>
                    c[parentTable.primaryKey.title] ??
                    c[parentTable.primaryKey.column_name],
                ),
              );
            } else {
              childRowsQb.whereIn(parentTable.primaryKey.column_name, childIds);
            }

            const childRows = await this.execAndParse(childRowsQb, null, {
              raw: true,
            });

            if (childRows.length !== childIds.length) {
              const missingIds = childIds.filter(
                (id) =>
                  !childRows.find(
                    (r) =>
                      r[parentColumn.column_name] ===
                      (typeof id === 'object'
                        ? id[parentTable.primaryKey.title] ??
                          id[parentTable.primaryKey.column_name]
                        : id),
                  ),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }

          const childRowsQb = this.dbDriver(childTn);

          if (parentTable.primaryKeys.length > 1) {
            childRowsQb.where((qb) => {
              for (const childId of childIds) {
                qb.orWhere(_wherePk(parentTable.primaryKeys, childId));
              }
            });
          } else {
            childRowsQb.whereIn(
              parentTable.primaryKey.column_name,
              typeof childIds[0] === 'object'
                ? childIds.map(
                    (c) =>
                      c[parentTable.primaryKey.title] ??
                      c[parentTable.primaryKey.column_name],
                  )
                : childIds,
            );
          }

          await this.execAndParse(
            childRowsQb.update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          auditConfig.parentModel = childTable;
          auditConfig.childModel = parentTable;

          // validate Ids
          {
            if (childIds.length > 1)
              NcError.unprocessableEntity(
                'Request must contain only one parent id',
              );

            const childRowsQb = this.dbDriver(parentTn)
              .select(parentTable.primaryKey.column_name)
              .where(_wherePk(parentTable.primaryKeys, childIds[0]))
              .first();

            const childRow = await this.execAndParse(childRowsQb, null, {
              first: true,
              raw: true,
            });

            if (!childRow) {
              NcError.recordNotFound(extractIds(childIds, true));
            }
          }

          await this.execAndParse(
            this.dbDriver(childTn)
              // .where({
              //   [childColumn.cn]: this.dbDriver(parentTable.tn)
              //     .select(parentColumn.cn)
              //     .where(parentTable.primaryKey.cn, childId)
              //     .first()
              // })
              // .where(_wherePk(childTable.primaryKeys, rowId))
              .where(childTable.primaryKey.column_name, rowId)
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            model: parentTable,
            rowIds: [childIds[0]],
            cookie,
          });
        }
        break;
    }

    for (const childId of childIds) {
      const _childId =
        typeof childId === 'object'
          ? Object.values(childId).join('_')
          : childId;

      auditUpdateObj.push({
        model: auditConfig.parentModel,
        childModel: auditConfig.childModel,
        rowId,
        childId: _childId,
        op_sub_type: AuditOperationSubTypes.LINK_RECORD,
        columnTitle: auditConfig.parentColTitle,
      });

      if (parentTable.id !== childTable.id) {
        auditUpdateObj.push({
          model: auditConfig.childModel,
          childModel: auditConfig.parentModel,
          rowId: _childId,
          childId: rowId,
          op_sub_type: AuditOperationSubTypes.LINK_RECORD,
          columnTitle: auditConfig.childColTitle,
        });
      }
    }

    await Promise.allSettled(
      auditUpdateObj.map(async (updateObj) => {
        await this.afterRemoveChild(
          updateObj.columnTitle,
          updateObj.rowId,
          updateObj.childId,
          cookie,
          updateObj.model,
          updateObj.childModel,
        );
      }),
    );
  }

  async btRead(
    { colId, id }: { colId; id },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      const columns = await this.model.getColumns(this.context);

      const { where, sort } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = columns.find((c) => c.id === colId);

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

  async prepareNocoData(
    data,
    isInsertData = false,
    cookie?: { user?: any },
    oldData?,
  ) {
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
        ].includes(column.uidt)
      )
        continue;

      if (column.system) {
        if (isInsertData) {
          if (column.uidt === UITypes.CreatedTime) {
            data[column.column_name] = this.now();
          } else if (column.uidt === UITypes.CreatedBy) {
            data[column.column_name] = cookie?.user?.id;
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
            } catch (e) {
              NcError.invalidAttachmentJson(data[column.column_name]);
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

            for (const [oldId, oldAttachment] of oldAttachmentMap) {
              if (!newAttachmentMap.has(oldId)) {
                await FileReference.delete(this.context, oldId);
              } else if (
                (oldAttachment.url &&
                  oldAttachment.url !== newAttachmentMap.get(oldId).url) ||
                (oldAttachment.path &&
                  oldAttachment.path !== newAttachmentMap.get(oldId).path)
              ) {
                await FileReference.delete(this.context, oldId);
                regenerateIds.push(oldId);
              }
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
            include_ws_deleted: false,
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
}

export function extractSortsObject(
  _sorts: string | string[],
  aliasColObjMap: { [columnAlias: string]: Column },
  throwErrorIfInvalid = false,
): Sort[] {
  if (!_sorts?.length) return;

  let sorts = _sorts;
  if (!Array.isArray(sorts)) sorts = sorts.split(/\s*,\s*/);

  return sorts.map((s) => {
    const sort: SortType = { direction: 'asc' };
    if (s.startsWith('-')) {
      sort.direction = 'desc';
      sort.fk_column_id = aliasColObjMap[s.slice(1)]?.id;
    } else if (s.startsWith('~-')) {
      sort.direction = 'count-desc';
      sort.fk_column_id = aliasColObjMap[s.slice(2)]?.id;
    } else if (s.startsWith('~+')) {
      sort.direction = 'count-asc';
      sort.fk_column_id = aliasColObjMap[s.slice(2)]?.id;
    }
    // replace + at the beginning if present
    else {
      sort.fk_column_id = aliasColObjMap[s.replace(/^\+/, '')]?.id;
    }

    if (throwErrorIfInvalid && !sort.fk_column_id)
      NcError.fieldNotFound(s.replace(/^[+-]/, ''));
    return new Sort(sort);
  });
}

export function extractFilterFromXwhere(
  str,
  aliasColObjMap: { [columnAlias: string]: Column },
  throwErrorIfInvalid = false,
) {
  if (!str) {
    return [];
  }

  // if array treat it as `and` group
  if (Array.isArray(str)) {
    // calling recursively for nested query
    return str.map((s) =>
      extractFilterFromXwhere(s, aliasColObjMap, throwErrorIfInvalid),
    );
  } else if (typeof str !== 'string' && throwErrorIfInvalid) {
    throw new Error(
      'Invalid filter format. Expected string or array of strings.',
    );
  }

  let nestedArrayConditions = [];

  let openIndex = str.indexOf('((');

  if (openIndex === -1) openIndex = str.indexOf('(~');

  let nextOpenIndex = openIndex;

  let closingIndex = str.indexOf('))');

  // if it's a simple query simply return array of conditions
  if (openIndex === -1) {
    if (str && str != '~not')
      nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/,
      );
    return extractCondition(
      nestedArrayConditions || [],
      aliasColObjMap,
      throwErrorIfInvalid,
    );
  }

  // iterate until finding right closing
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) != -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  if (closingIndex === -1)
    throw new Error(
      `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`,
    );

  // getting operand starting index
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex != -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  nestedArrayConditions.push(
    ...extractFilterFromXwhere(
      lhsOfNestedQuery,
      aliasColObjMap,
      throwErrorIfInvalid,
    ),
    // calling recursively for nested query
    new Filter({
      is_group: true,
      logical_op: operator,
      children: extractFilterFromXwhere(
        str.substring(openIndex + 1, closingIndex + 1),
        aliasColObjMap,
      ),
    }),
    // RHS of nested query(recursion)
    ...extractFilterFromXwhere(
      str.substring(closingIndex + 2),
      aliasColObjMap,
      throwErrorIfInvalid,
    ),
  );
  return nestedArrayConditions;
}

// mark `op` and `sub_op` any for being assignable to parameter of type
function validateFilterComparison(uidt: UITypes, op: any, sub_op?: any) {
  if (!COMPARISON_OPS.includes(op) && !GROUPBY_COMPARISON_OPS.includes(op)) {
    NcError.badRequest(`${op} is not supported.`);
  }

  if (sub_op) {
    if (
      ![
        UITypes.Date,
        UITypes.DateTime,
        UITypes.CreatedTime,
        UITypes.LastModifiedTime,
      ].includes(uidt)
    ) {
      NcError.badRequest(`'${sub_op}' is not supported for UI Type'${uidt}'.`);
    }
    if (!COMPARISON_SUB_OPS.includes(sub_op)) {
      NcError.badRequest(`'${sub_op}' is not supported.`);
    }
    if (
      (op === 'isWithin' && !IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op)) ||
      (op !== 'isWithin' && IS_WITHIN_COMPARISON_SUB_OPS.includes(sub_op))
    ) {
      NcError.badRequest(`'${sub_op}' is not supported for '${op}'`);
    }
  }
}

export function extractCondition(
  nestedArrayConditions,
  aliasColObjMap,
  throwErrorIfInvalid,
) {
  return nestedArrayConditions?.map((str) => {
    let [logicOp, alias, op, value] =
      str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];

    if (!alias && !op && !value) {
      // try match with blank filter format
      [logicOp, alias, op, value] =
        str.match(/(?:~(and|or|not))?\((.*?),(\w+)\)/)?.slice(1) || [];
    }

    // handle isblank and isnotblank filter format
    switch (op) {
      case 'is':
        if (value === 'blank') {
          op = 'blank';
          value = undefined;
        } else if (value === 'notblank') {
          op = 'notblank';
          value = undefined;
        }
        break;
      case 'isblank':
      case 'is_blank':
        op = 'blank';
        break;
      case 'isnotblank':
      case 'is_not_blank':
      case 'is_notblank':
        op = 'notblank';
        break;
    }

    let sub_op = null;

    if (aliasColObjMap[alias]) {
      if (
        [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ].includes(aliasColObjMap[alias].uidt)
      ) {
        value = value?.split(',');
        // the first element would be sub_op
        sub_op = value?.[0];
        // remove the first element which is sub_op
        value?.shift();
        value = value?.[0];
      } else if (op === 'in') {
        value = value.split(',');
      }

      validateFilterComparison(aliasColObjMap[alias].uidt, op, sub_op);
    } else if (throwErrorIfInvalid) {
      NcError.invalidFilter(str);
    }

    return new Filter({
      comparison_op: op,
      ...(sub_op && { comparison_sub_op: sub_op }),
      fk_column_id: aliasColObjMap[alias]?.id,
      logical_op: logicOp,
      value,
    });
  });
}

function applyPaginate(
  query,
  {
    limit = 25,
    offset = 0,
    ignoreLimit = false,
  }: XcFilter & { ignoreLimit?: boolean },
) {
  query.offset(offset);
  if (!ignoreLimit) query.limit(limit);
  return query;
}

export function _wherePk(
  primaryKeys: Column[],
  id: unknown | unknown[],
  skipPkValidation = false,
) {
  const where = {};

  // if id object is provided use as it is
  if (id && typeof id === 'object' && !Array.isArray(id)) {
    // verify all pk columns are present in id object
    for (const pk of primaryKeys) {
      let key: string;
      if (pk.id in id) {
        key = pk.id;
      } else if (pk.title in id) {
        key = pk.title;
      } else if (pk.column_name in id) {
        key = pk.column_name;
      } else {
        NcError.badRequest(
          `Primary key column ${pk.title} not found in id object`,
        );
      }
      where[pk.column_name] = id[key];
      // validate value if auto-increment column
      // todo: add more validation based on column constraints
      if (!skipPkValidation && pk.ai && !/^\d+$/.test(id[key])) {
        NcError.invalidPrimaryKey(id[key], pk.title);
      }
    }

    return where;
  }

  let ids = id;

  if (Array.isArray(id)) {
    ids = id;
  } else if (primaryKeys.length === 1) {
    ids = [id];
  } else {
    ids = (id + '').split('___').map((val) => val.replaceAll('\\_', '_'));
  }

  for (let i = 0; i < primaryKeys.length; ++i) {
    if (primaryKeys[i].dt === 'bytea') {
      // if column is bytea, then we need to encode the id to hex based on format
      // where[primaryKeys[i].column_name] =
      // (primaryKeys[i].meta?.format === 'hex' ? '\\x' : '') + ids[i];
      return (qb) => {
        qb.whereRaw(
          `?? = decode(?, '${
            primaryKeys[i].meta?.format === 'hex' ? 'hex' : 'escape'
          }')`,
          [primaryKeys[i].column_name, ids[i]],
        );
      };
    }

    // Cast the id to string.
    const idAsString = ids[i] + '';
    // Check if the id is a UUID and the column is binary(16)
    const isUUIDBinary16 =
      primaryKeys[i].ct === 'binary(16)' &&
      (idAsString.length === 36 || idAsString.length === 32);
    // If the id is a UUID and the column is binary(16), convert the id to a Buffer. Otherwise, return null to indicate that the id is not a UUID.
    const idAsUUID = isUUIDBinary16
      ? idAsString.length === 32
        ? idAsString.replace(
            /(.{8})(.{4})(.{4})(.{4})(.{12})/,
            '$1-$2-$3-$4-$5',
          )
        : idAsString
      : null;

    where[primaryKeys[i].column_name] = idAsUUID
      ? Buffer.from(idAsUUID.replace(/-/g, ''), 'hex')
      : ids[i];
  }
  return where;
}

export function getCompositePkValue(primaryKeys: Column[], row) {
  if (row === null || row === undefined) {
    NcError.requiredFieldMissing(primaryKeys.map((c) => c.title).join(','));
  }

  if (typeof row !== 'object') return row;

  if (primaryKeys.length > 1) {
    return primaryKeys.map((c) =>
      (row[c.title] ?? row[c.column_name])?.toString?.().replaceAll('_', '\\_'),
    ).join('___');
  }

  return (
    primaryKeys[0] &&
    (row[primaryKeys[0].title] ?? row[primaryKeys[0].column_name])
  );
}

export function haveFormulaColumn(columns: Column[]) {
  return columns.some((c) => c.uidt === UITypes.Formula);
}

function shouldSkipField(
  fieldsSet,
  viewOrTableColumn,
  view,
  column,
  extractPkAndPv,
) {
  if (fieldsSet) {
    return !fieldsSet.has(column.title);
  } else {
    if (column.system && isCreatedOrLastModifiedByCol(column)) return true;
    if (!extractPkAndPv) {
      if (!(viewOrTableColumn instanceof Column)) {
        if (
          !(viewOrTableColumn as GridViewColumn)?.show &&
          !(column.rqd && !column.cdf && !column.ai) &&
          !column.pk &&
          column.uidt !== UITypes.ForeignKey
        )
          return true;
        if (
          !view?.show_system_fields &&
          column.uidt !== UITypes.ForeignKey &&
          !column.pk &&
          isSystemColumn(column)
        )
          return true;
      }
    }
    return false;
  }
}

export function getListArgs(
  args: XcFilterWithAlias,
  model: Model,
  { ignoreAssigningWildcardSelect = false } = {},
): XcFilter {
  const obj: XcFilter = {};
  obj.where = args.where || args.filter || args.w || '';
  obj.having = args.having || args.h || '';
  obj.shuffle = args.shuffle || args.r || '';
  obj.condition = args.condition || args.c || {};
  obj.conditionGraph = args.conditionGraph || {};
  obj.limit = Math.max(
    Math.min(
      Math.max(+(args?.limit || args?.l), 0) ||
        BaseModelSqlv2.config.limitDefault,
      BaseModelSqlv2.config.limitMax,
    ),
    BaseModelSqlv2.config.limitMin,
  );
  obj.offset = Math.max(+(args?.offset || args?.o) || 0, 0);
  obj.fields =
    args?.fields || args?.f || (ignoreAssigningWildcardSelect ? null : '*');
  obj.sort = args?.sort || args?.s || model.primaryKey?.[0]?.column_name;
  obj.pks = args?.pks;
  return obj;
}

function extractIds(
  childIds: (string | number | Record<string, any>)[],
  isBt = false,
) {
  return (isBt ? childIds.slice(0, 1) : childIds).map((r) =>
    typeof r === 'object' ? JSON.stringify(r) : `${r}`,
  );
}

function getRelatedLinksColumn(
  column: Column<LinkToAnotherRecordColumn>,
  relatedModel: Model,
) {
  return relatedModel.columns.find((c: Column) => {
    if (column.colOptions?.type === RelationTypes.MANY_TO_MANY) {
      return (
        column.colOptions.fk_mm_child_column_id ===
          c.colOptions?.fk_mm_parent_column_id &&
        column.colOptions.fk_mm_parent_column_id ===
          c.colOptions?.fk_mm_child_column_id
      );
    } else {
      return (
        column.colOptions.fk_child_column_id ===
          c.colOptions?.fk_child_column_id &&
        column.colOptions.fk_parent_column_id ===
          c.colOptions?.fk_parent_column_id
      );
    }
  });
}

export { BaseModelSqlv2 };
