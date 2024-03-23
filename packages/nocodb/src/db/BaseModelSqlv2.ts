import autoBind from 'auto-bind';
import groupBy from 'lodash/groupBy';
import DataLoader from 'dataloader';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone';
import { nocoExecute } from 'nc-help';
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
import type {
  BarcodeColumn,
  FormulaColumn,
  GridViewColumn,
  LinkToAnotherRecordColumn,
  QrCodeColumn,
  RollupColumn,
  SelectOption,
  User,
} from '~/models';
import {
  Audit,
  BaseUser,
  Column,
  Filter,
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

dayjs.extend(utc);

dayjs.extend(timezone);

const logger = new Logger('BaseModelSqlv2');

const GROUP_COL = '__nc_group_id';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);

export async function populatePk(model: Model, insertObj: any) {
  await model.getColumns();
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

export async function getColumnName(column: Column<any>, columns?: Column[]) {
  if (
    !isCreatedOrLastModifiedTimeCol(column) &&
    !isCreatedOrLastModifiedByCol(column)
  )
    return column.column_name;
  columns = columns || (await Column.list({ fk_model_id: column.fk_model_id }));

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

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 {
  protected _dbDriver: XKnex;
  protected model: Model;
  protected viewId: string;
  protected _proto: any;
  protected _columns = {};

  public static config: any = defaultLimitConfig;

  public get dbDriver() {
    return this._dbDriver;
  }

  constructor({
    dbDriver,
    model,
    viewId,
  }: {
    [key: string]: any;
    model: Model;
  }) {
    this._dbDriver = dbDriver;
    this.model = model;
    this.viewId = viewId;
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
    }: {
      ignoreView?: boolean;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
    } = {},
  ): Promise<any> {
    const qb = this.dbDriver(this.tnPath);

    const { ast, dependencyFields, parsedQuery } = await getAst({
      query,
      model: this.model,
      view: ignoreView ? null : this.viewId && (await View.get(this.viewId)),
      getHiddenColumn,
      throwErrorIfInvalidParams,
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
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
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

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.tnPath);
    await this.model.getColumns();
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
    const { where, ...rest } = this._getListArgs(args as any);
    const qb = this.dbDriver(this.tnPath);
    await this.selectObject({ ...args, qb, validateFormula });

    const aliasColObjMap = await this.model.getAliasColObjMap();
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
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
        throw e;
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

    const { where, fields, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.tnPath);

    await this.selectObject({
      qb,
      fieldsSet: args.fieldsSet,
      viewId: this.viewId,
      validateFormula,
    });
    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    const aliasColObjMap = await this.model.getAliasColObjMap();
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
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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
          : await Sort.list({ viewId: this.viewId });

      await sortV2(this, sorts, qb, undefined, throwErrorIfInvalidParams);
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
      if (validateFormula || !haveFormulaColumn(await this.model.getColumns()))
        throw e;
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
    args: { where?: string; limit?; filterArr?: Filter[] } = {},
    ignoreViewFilterAndSort = false,
    throwErrorIfInvalidParams = false,
  ): Promise<any> {
    await this.model.getColumns();
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.tnPath);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(
      where,
      aliasColObjMap,
      throwErrorIfInvalidParams,
    );

    if (!ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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

    let sql = sanitize(qb.toQuery());
    if (!this.isPg && !this.isMssql && !this.isSnowflake) {
      sql = unsanitize(qb.toQuery());
    }

    return (await this.execAndParse(sql, null, { raw: true, first: true }))
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

    const aliasColObjMap = await this.model.getAliasColObjMap();

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

    const cols = await this.model.getColumns();
    const groupByColumns: Record<string, Column> = {};

    const selectors = [];
    const groupBySelectors = [];
    const getAlias = getAliasGenerator('__nc_gb');

    await Promise.all(
      args.column_name.split(',').map(async (col) => {
        let column = cols.find((c) => c.column_name === col || c.title === col);
        if (!column) {
          throw NcError.fieldNotFound(col);
        }

        // if qrCode or Barcode replace it with value column nd keep the alias
        if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
          column = new Column({
            ...(await column
              .getColOptions<BarcodeColumn | QrCodeColumn>()
              .then((col) => col.getValueColumn())),
            title: column.title,
            id: column.id,
          });

        groupByColumns[column.id] = column;

        switch (column.uidt) {
          case UITypes.Attachment:
            NcError.badRequest(
              'Group by using attachment column is not supported',
            );
            break;
          case UITypes.Links:
          case UITypes.Rollup:
            selectors.push(
              (
                await genRollupSelectv2({
                  baseModelSqlv2: this,
                  knex: this.dbDriver,
                  columnOptions: (await column.getColOptions()) as RollupColumn,
                })
              ).builder.as(sanitize(column.id)),
            );
            groupBySelectors.push(sanitize(column.id));
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
                  sanitize(column.id),
                ]);
              } catch (e) {
                logger.log(e);
                // return dummy select
                selectQb = this.dbDriver.raw(`'ERR' as ??`, [
                  sanitize(column.id),
                ]);
              }

              selectors.push(selectQb);
              groupBySelectors.push(column.id);
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
                sanitize(column.id),
              ]);

              selectors.push(selectQb);
              groupBySelectors.push(sanitize(column.id));
            }
            break;
          default:
            {
              const columnName = await getColumnName(column, cols);
              selectors.push(
                this.dbDriver.raw('?? as ??', [columnName, column.id]),
              );
              groupBySelectors.push(sanitize(column.id));
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

    const aliasColObjMap = await this.model.getAliasColObjMap();

    let sorts = extractSortsObject(rest?.sort, aliasColObjMap);

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(
      this,
      [
        ...(this.viewId
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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
        sorts = await Sort.list({ viewId: this.viewId });
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
        const columnName = await getColumnName(
          column,
          await this.model.getColumns(),
        );

        const baseUsers = await BaseUser.getUsersList({
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

        qb.orderBy(
          sanitize(this.dbDriver.raw(finalStatement)),
          sort.direction,
          sort.direction === 'desc' ? 'LAST' : 'FIRST',
        );
      } else {
        qb.orderBy(
          column.id,
          sort.direction,
          sort.direction === 'desc' ? 'LAST' : 'FIRST',
        );
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

    // todo: refactor and avoid duplicate code
    await this.model.getColumns().then((cols) =>
      Promise.all(
        args.column_name.split(',').map(async (col) => {
          let column = cols.find(
            (c) => c.column_name === col || c.title === col,
          );
          if (!column) {
            throw NcError.fieldNotFound(col);
          }

          // if qrCode or Barcode replace it with value column nd keep the alias
          if ([UITypes.QrCode, UITypes.Barcode].includes(column.uidt))
            column = new Column({
              ...(await column
                .getColOptions<BarcodeColumn | QrCodeColumn>()
                .then((col) => col.getValueColumn())),
              title: column.title,
              id: column.id,
            });

          switch (column.uidt) {
            case UITypes.Attachment:
              NcError.badRequest(
                'Group by using attachment column is not supported',
              );
              break;
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
                    columnOptions:
                      (await column.getColOptions()) as RollupColumn,
                  })
                ).builder.as(sanitize(column.id)),
              );
              groupBySelectors.push(sanitize(column.id));
              break;
            case UITypes.Formula: {
              let selectQb;
              try {
                const _selectQb = await this.getSelectQueryBuilderForFormula(
                  column,
                );

                selectQb = this.dbDriver.raw(`?? as ??`, [
                  _selectQb.builder,
                  sanitize(column.id),
                ]);
              } catch (e) {
                logger.log(e);
                // return dummy select
                selectQb = this.dbDriver.raw(`'ERR' as ??`, [
                  sanitize(column.id),
                ]);
              }

              selectors.push(selectQb);
              groupBySelectors.push(column.id);
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
                  sanitize(column.id),
                ]);

                selectors.push(selectQb);
                groupBySelectors.push(sanitize(column.id));
              }
              break;
            default:
              {
                const columnName = await getColumnName(column, cols);
                selectors.push(
                  this.dbDriver.raw('?? as ??', [columnName, column.id]),
                );
                groupBySelectors.push(sanitize(column.id));
              }
              break;
          }
        }),
      ),
    );

    const qb = this.dbDriver(this.tnPath);
    qb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
    qb.select(...selectors);

    const aliasColObjMap = await this.model.getAliasColObjMap();

    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(
      this,
      [
        ...(this.viewId
          ? [
              new Filter({
                children:
                  (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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

      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns();

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

      // console.log(childQb.toQuery())

      const children = await this.execAndParse(
        childQb,
        await childTable.getColumns(),
      );
      const proto = await (
        await Model.getBaseModelSQL({
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

  protected async applySortAndFilter({
    table,
    where,
    qb,
    sort,
  }: {
    table: Model;
    where: string;
    qb;
    sort: string;
  }) {
    const childAliasColMap = await table.getAliasColObjMap();

    const filter = extractFilterFromXwhere(where, childAliasColMap);
    await conditionV2(this, filter, qb);
    if (!sort) return;
    const sortObj = extractSortsObject(sort, childAliasColMap);
    if (sortObj) await sortV2(this, sortObj, qb);
  }

  async multipleHmListCount({ colId, ids }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

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

      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );

      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver,
      });
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
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

      await childModel.selectObject({ qb, fieldsSet: args.fieldSet });

      const children = await this.execAndParse(
        qb,
        await childTable.getColumns(),
      );

      const proto = await (
        await Model.getBaseModelSQL({
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
      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );
      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

      const childTn = this.getTnPath(childTable);
      const parentTn = this.getTnPath(parentTable);

      const query = this.dbDriver(childTn)
        .count(`${chilCol?.column_name} as count`)
        .whereIn(
          chilCol.column_name,
          this.dbDriver(parentTn)
            .select(parentCol.column_name)
            .where(_wherePk(parentTable.primaryKeys, id)),
        );
      const aliasColObjMap = await childTable.getAliasColObjMap();
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

      await conditionV2(this, filterObj, query);

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
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const mmTable = await relColOptions.getMMModel();

    // if mm table is not present then return
    if (!mmTable) {
      return;
    }

    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = childTn;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn).join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`);

    await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

    await this.applySortAndFilter({ table: childTable, where, qb, sort });

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
      await childTable.getColumns(),
    );

    const proto = await (
      await Model.getBaseModelSQL({
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

  public async mmList(
    { colId, parentId },
    args: { limit?; offset?; fieldsSet?: Set<string> } = {},
    selectAllRecords = false,
  ) {
    const { where, sort, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
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

    await childModel.selectObject({ qb, fieldsSet: args.fieldsSet });

    await this.applySortAndFilter({ table: childTable, where, qb, sort });

    // todo: sanitize
    if (!selectAllRecords) {
      qb.limit(+rest?.limit || 25);
    }
    qb.offset(selectAllRecords ? 0 : +rest?.offset || 0);

    const children = await this.execAndParse(qb, await childTable.getColumns());
    const proto = await (
      await Model.getBaseModelSQL({ id: rtnId, dbDriver: this.dbDriver })
    ).getProto();

    return children.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  public async multipleMmListCount({ colId, parentIds }) {
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

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

    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
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
    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(this, filterObj, qb);
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

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

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(this, filterObj, qb);
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const mmTable = await relColOptions.getMMModel();
    const vtn = this.getTnPath(mmTable);
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

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

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(this, filterObj, qb);

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childModel.getProto();
    const data = await this.execAndParse(qb, await childTable.getColumns());
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
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const tn = childTn;
    const rtn = parentTn;
    await parentTable.getColumns();

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

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(this, filterObj, qb);

    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

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

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(this, filterObj, qb);

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (childTable.primaryKey && childTable.primaryKey.ai) {
      qb.orderBy(childTable.primaryKey.column_name);
    } else if (childTable.columns.find((c) => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    applyPaginate(qb, rest);

    const proto = await childModel.getProto();
    const data = await this.execAndParse(qb, await childTable.getColumns());

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
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns();

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

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(this, filterObj, qb);
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async countExcludedOneToOneChildren(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns();

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

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    await conditionV2(this, filterObj, qb);
    return (await this.execAndParse(qb, null, { raw: true, first: true }))
      ?.count;
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: parentTable,
    });

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const rtn = parentTn;
    const tn = childTn;
    await childTable.getColumns();

    const qb = this.dbDriver(rtn).where((qb) => {
      qb.whereNotIn(
        rcn,
        this.dbDriver(tn)
          .select(cn)
          // .where(childTable.primaryKey.cn, cid)
          .where(_wherePk(childTable.primaryKeys, cid))
          .whereNotNull(cn),
      ).orWhereNull(rcn);
    });

    if (+rest?.shuffle) {
      await this.shuffle({ qb });
    }

    await parentModel.selectObject({ qb });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(this, filterObj, qb);

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

    const proto = await parentModel.getProto();
    const data = await this.execAndParse(qb, await parentTable.getColumns());

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getExcludedOneToOneChildrenList(
    { colId, cid = null },
    args,
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);
    const relColumn = (await this.model.getColumns()).find(
      (c) => c.id === colId,
    );
    const relColOptions =
      (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: parentTable,
    });
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable,
    });

    const rtn = this.getTnPath(parentTable);
    const tn = this.getTnPath(childTable);
    await childTable.getColumns();

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

    await (isBt ? parentModel : childModel).selectObject({ qb });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
    await conditionV2(this, filterObj, qb);

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
      await (isBt ? parentTable : childTable).getColumns(),
    );

    return data.map((c) => {
      c.__proto__ = proto;
      return c;
    });
  }

  protected async getSelectQueryBuilderForFormula(
    column: Column<any>,
    tableAlias?: string,
    validateFormula = false,
    aliasToColumnBuilder = {},
  ) {
    const formula = await column.getColOptions<FormulaColumn>();
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
    const columns = await this.model.getColumns();
    await Promise.all(
      columns.map(async (column) => {
        switch (column.uidt) {
          case UITypes.Lookup:
            {
              // @ts-ignore
              const colOptions: LookupColumn = await column.getColOptions();
              const relCol = await Column.get({
                colId: colOptions.fk_relation_column_id,
              });
              const relColTitle =
                relCol.uidt === UITypes.Links
                  ? `_nc_lk_${relCol.title}`
                  : relCol.title;
              proto.__columnAliases[column.title] = {
                path: [
                  relColTitle,
                  (await Column.get({ colId: colOptions.fk_lookup_column_id }))
                    ?.title,
                ],
              };
            }
            break;
          case UITypes.Links:
          case UITypes.LinkToAnotherRecord:
            {
              this._columns[column.title] = column;
              const colOptions =
                (await column.getColOptions()) as LinkToAnotherRecordColumn;

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
                    getCompositePk(self.model.primaryKeys, this),
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
                    getCompositePk(self.model.primaryKeys, this),
                  );
                };
              } else if (colOptions.type === 'bt') {
                // @ts-ignore
                const colOptions =
                  (await column.getColOptions()) as LinkToAnotherRecordColumn;
                const pCol = await Column.get({
                  colId: colOptions.fk_parent_column_id,
                });
                const cCol = await Column.get({
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
                      await Model.getBaseModelSQL({
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
                  const colOptions =
                    (await column.getColOptions()) as LinkToAnotherRecordColumn;
                  const pCol = await Column.get({
                    colId: colOptions.fk_parent_column_id,
                  });
                  const cCol = await Column.get({
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
                        await Model.getBaseModelSQL({
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
                      getCompositePk(self.model.primaryKeys, this),
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
      viewOrTableColumns = _columns || (await this.model.getColumns());
    } else {
      view = await View.get(viewId);
      const viewColumns = viewId && (await View.getColumns(viewId));
      fields = Array.isArray(_fields) ? _fields : _fields?.split(',');

      // const columns = _columns ?? (await this.model.getColumns());
      // for (const column of columns) {
      viewOrTableColumns =
        _columns || viewColumns || (await this.model.getColumns());
    }
    for (const viewOrTableColumn of viewOrTableColumns) {
      const column =
        viewOrTableColumn instanceof Column
          ? viewOrTableColumn
          : await Column.get({
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
              column,
              await this.model.getColumns(),
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
              res[sanitize(column.id || columnName)] = this.dbDriver.raw(
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
                res[sanitize(column.id || columnName)] = this.dbDriver
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
                res[sanitize(column.id || columnName)] = this.dbDriver.raw(
                  `CONVERT(DATETIMEOFFSET, ?? AT TIME ZONE 'UTC')`,
                  [`${sanitize(alias || this.tnPath)}.${columnName}`],
                );
                break;
              }
            }
            res[sanitize(column.id || columnName)] = sanitize(
              `${alias || this.tnPath}.${columnName}`,
            );
          }
          break;
        case UITypes.LinkToAnotherRecord:
        case UITypes.Lookup:
          break;
        case UITypes.QrCode: {
          const qrCodeColumn = await column.getColOptions<QrCodeColumn>();
          const qrValueColumn = await Column.get({
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
          const barcodeColumn = await column.getColOptions<BarcodeColumn>();
          const barcodeValueColumn = await Column.get({
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
                  [column.id]: selectQb.builder,
                });
              } catch {
                continue;
              }
              break;
            default: {
              qb.select({
                [column.id]: barcodeValueColumn.column_name,
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
                  sanitize(column.id),
                ]),
              );
            } catch (e) {
              logger.log(e);
              // return dummy select
              qb.select(
                this.dbDriver.raw(`'ERR' as ??`, [sanitize(column.id)]),
              );
            }
          }
          break;
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
                columnOptions: (await column.getColOptions()) as RollupColumn,
              })
            ).builder.as(sanitize(column.id)),
          );
          break;
        case UITypes.CreatedBy:
        case UITypes.LastModifiedBy: {
          const columnName = await getColumnName(
            column,
            await this.model.getColumns(),
          );

          res[sanitize(column.id || columnName)] = sanitize(
            `${alias || this.tnPath}.${columnName}`,
          );
          break;
        }
        default:
          if (this.isPg) {
            if (column.dt === 'bytea') {
              res[sanitize(column.id || column.column_name)] =
                this.dbDriver.raw(
                  `encode(??.??, '${
                    column.meta?.format === 'hex' ? 'hex' : 'escape'
                  }')`,
                  [alias || this.model.table_name, column.column_name],
                );
              break;
            }
          }

          res[sanitize(column.id || column.column_name)] = sanitize(
            `${alias || this.tnPath}.${column.column_name}`,
          );
          break;
      }
    }
    qb.select(res);
  }

  async insert(data, trx?, cookie?, _disableOptimization = false) {
    try {
      const columns = await this.model.getColumns();

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

      await populatePk(this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );

      await this.validate(insertObj);

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
          } else if (this.isSnowflake) {
            id = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: 'id',
                }),
                null,
                { raw: true, first: true },
              )
            ).id;
          }
          response = await this.readByPk(
            this.extractCompositePK({ rowId: id, insertObj, ag }),
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
          this.extractCompositePK({ rowId: id, insertObj, ag }),
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
      const source = await Source.get(this.model.source_id);
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
          await column.getColOptions<LinkToAnotherRecordColumn>();

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(colOptions.fk_mm_model_id);
              const mmParentColumn = await Column.get({
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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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
    const LTARColumns = (await model.getColumns()).filter(
      (c) => c.uidt === UITypes.LinkToAnotherRecord,
    );
    let i = 0;
    for (const column of LTARColumns) {
      const colOptions =
        (await column.getColOptions()) as LinkToAnotherRecordColumn;
      const childColumn = await colOptions.getChildColumn();
      const parentColumn = await colOptions.getParentColumn();
      const childModel = await childColumn.getModel();
      await childModel.getColumns();
      const parentModel = await parentColumn.getModel();
      await parentModel.getColumns();
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
        const mmModel = await colOptions.getMMModel();
        const mmChildColumn = await colOptions.getMMChildColumn();
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
      const updateObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );

      await this.validate(data);

      await this.beforeUpdate(data, trx, cookie);

      await this.prepareNocoData(updateObj, false, cookie);

      const prevData = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );

      const query = this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id));

      await this.execAndParse(query, null, { raw: true });

      // const newData = await this.readByPk(id, false, {}, { ignoreView: true , getHiddenColumn: true});

      // const prevData = await this.readByPk(id);

      const newData = await this.readByPk(
        id,
        false,
        {},
        { ignoreView: true, getHiddenColumn: true },
      );
      await this.afterUpdate(prevData, newData, trx, cookie, updateObj);
      return newData;
    } catch (e) {
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async _wherePk(id) {
    await this.model.getColumns();
    return _wherePk(this.model.primaryKeys, id);
  }

  public getTnPath(tb: { table_name: string } | string, alias?: string) {
    const tn = typeof tb === 'string' ? tb : tb.table_name;
    const schema = (this.dbDriver as any).searchPath?.();
    if (this.isMssql && schema) {
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
      const source = await Source.get(this.model.source_id);
      await populatePk(this.model, data);
      const insertObj = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );
      let rowId = null;

      const nestedCols = (await this.model.getColumns()).filter((c) =>
        isLinksOrLTAR(c),
      );
      const { postInsertOps, preInsertOps } = await this.prepareNestedLinkQb({
        nestedCols,
        data,
        insertObj,
      });

      await this.validate(insertObj);

      await this.beforeInsert(insertObj, this.dbDriver, cookie);

      await this.prepareNocoData(insertObj, true, cookie);

      await Promise.all(preInsertOps.map((f) => f(this.dbDriver)));

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
          } else if (this.isSnowflake) {
            rowId = (
              await this.execAndParse(
                this.dbDriver(this.tnPath).max(ai.column_name, {
                  as: 'id',
                }),
                null,
                { raw: true, first: true },
              )
            )?.id;
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

      await Promise.all(postInsertOps.map((f) => f(rowId)));

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
    ai?: Column<any>;
    ag?: Column<any>;
    rowId;
    insertObj: Record<string, any>;
    force?: boolean;
  }) {
    // handle if composite primary key is used along with ai or ag
    if ((ai || ag) && (force || this.model.primaryKeys?.length > 1)) {
      // generate object with ai column and rest of the primary keys
      const pkObj = {};
      for (const pk of this.model.primaryKeys) {
        const key = pk.title;
        if (ai && pk.id === ai.id) {
          pkObj[key] = rowId;
        } else if (ag && pk.id === ag.id) {
          pkObj[key] = rowId;
        } else {
          pkObj[key] = insertObj[pk.column_name] ?? null;
        }
      }
      rowId = pkObj;
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
    const postInsertOps: ((rowId: any, trx?: any) => Promise<void>)[] = [];
    const preInsertOps: ((trx?: any) => Promise<void>)[] = [];
    for (const col of nestedCols) {
      if (col.title in data) {
        const colOptions = await col.getColOptions<LinkToAnotherRecordColumn>();

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
              const childCol = await colOptions.getChildColumn();
              const parentCol = await colOptions.getParentColumn();
              insertObj[childCol.column_name] = nestedData?.[parentCol.title];
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = col.meta?.bt;

              const childCol = await colOptions.getChildColumn();
              const childModel = await childCol.getModel();
              await childModel.getColumns();

              if (isBt) {
                // todo: unlink the ref record
                preInsertOps.push(async (trx: any = this.dbDriver) => {
                  await trx(this.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: null,
                    })
                    .where(
                      childCol.column_name,
                      nestedData[childModel.primaryKey.title],
                    );
                });

                if (typeof nestedData !== 'object') continue;
                const childCol = await colOptions.getChildColumn();
                const parentCol = await colOptions.getParentColumn();
                insertObj[childCol.column_name] = nestedData?.[parentCol.title];
              } else {
                postInsertOps.push(async (rowId, trx: any = this.dbDriver) => {
                  await trx(this.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: rowId,
                    })
                    .where(
                      childModel.primaryKey.column_name,
                      nestedData[childModel.primaryKey.title],
                    );
                });
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              if (!Array.isArray(nestedData)) continue;
              const childCol = await colOptions.getChildColumn();
              const childModel = await childCol.getModel();
              await childModel.getColumns();

              postInsertOps.push(
                async (
                  rowId,
                  // todo: use transaction type
                  trx: any = this.dbDriver,
                ) => {
                  await trx(this.getTnPath(childModel.table_name))
                    .update({
                      [childCol.column_name]: rowId,
                    })
                    .whereIn(
                      childModel.primaryKey.column_name,
                      nestedData?.map((r) => r[childModel.primaryKey.title]),
                    );
                },
              );
            }
            break;
          case RelationTypes.MANY_TO_MANY: {
            if (!Array.isArray(nestedData)) continue;
            postInsertOps.push(
              async (
                rowId,
                // todo: use transaction type
                trx: any = this.dbDriver,
              ) => {
                const parentModel = await colOptions
                  .getParentColumn()
                  .then((c) => c.getModel());
                await parentModel.getColumns();
                const parentMMCol = await colOptions.getMMParentColumn();
                const childMMCol = await colOptions.getMMChildColumn();
                const mmModel = await colOptions.getMMModel();

                const rows = nestedData.map((r) => ({
                  [parentMMCol.column_name]: r[parentModel.primaryKey.title],
                  [childMMCol.column_name]: rowId,
                }));
                await trx(this.getTnPath(mmModel.table_name)).insert(rows);
              },
            );
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
    }: {
      chunkSize?: number;
      cookie?: any;
      foreign_key_checks?: boolean;
      skip_hooks?: boolean;
      raw?: boolean;
      insertOneByOneAsFallback?: boolean;
      isSingleRecordInsertion?: boolean;
    } = {},
  ) {
    let trx;
    try {
      // TODO: ag column handling for raw bulk insert
      const insertDatas = raw ? datas : [];
      let postInsertOps: ((rowId: any, trx?: any) => Promise<void>)[] = [];
      let preInsertOps: ((trx?: any) => Promise<void>)[] = [];
      let aiPkCol: Column;
      let agPkCol: Column;

      if (!raw) {
        const nestedCols = (await this.model.getColumns()).filter((c) =>
          isLinksOrLTAR(c),
        );

        await this.model.getColumns();

        for (const d of datas) {
          const insertObj = {};

          // populate pk, map alias to column, validate data
          for (let i = 0; i < this.model.columns.length; ++i) {
            const col = this.model.columns[i];

            if (
              col.title in d &&
              (isCreatedOrLastModifiedTimeCol(col) ||
                isCreatedOrLastModifiedByCol(col))
            ) {
              NcError.badRequest(
                `Column "${col.title}" is auto generated and cannot be updated`,
              );
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

      await Promise.all(preInsertOps.map((f) => f(trx)));

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

        if (!raw) {
          for (const col of this.model.primaryKeys) {
            returningObj[col.title] = col.column_name;
          }
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

        await Promise.all(postInsertOps.map((f) => f(rowId, trx)));
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
      if (raw) await this.model.getColumns();

      // validate update data
      if (!raw) {
        for (const d of datas) {
          await this.validate(d);
        }
      }

      const updateDatas = raw
        ? datas
        : await Promise.all(
            datas.map((d) =>
              this.model.mapAliasToColumn(d, this.clientMeta, this.dbDriver),
            ),
          );

      const prevData = [];
      const newData = [];
      const updatePkValues = [];
      const toBeUpdated = [];
      for (const d of updateDatas) {
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(JSON.stringify(pkValues));
          }
          continue;
        }
        if (!raw) {
          await this.prepareNocoData(d, false, cookie);

          const oldRecord = await this.readByPk(pkValues);
          if (!oldRecord) {
            // throw or skip if no record found
            if (throwExceptionIfNotExist) {
              NcError.recordNotFound(JSON.stringify(pkValues));
            }
            continue;
          }
          prevData.push(oldRecord);
        }
        const wherePk = await this._wherePk(pkValues);
        toBeUpdated.push({ d, wherePk });
        updatePkValues.push(pkValues);
      }

      transaction = await this.dbDriver.transaction();

      for (const o of toBeUpdated) {
        await transaction(this.tnPath).update(o.d).where(o.wherePk);
      }

      await transaction.commit();

      if (!raw) {
        for (const pkValues of updatePkValues) {
          const updatedRecord = await this.readByPk(pkValues);
          newData.push(updatedRecord);
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
      const updateData = await this.model.mapAliasToColumn(
        data,
        this.clientMeta,
        this.dbDriver,
      );
      if (!args.skipValidationAndHooks) await this.validate(updateData);

      await this.prepareNocoData(updateData, false, cookie);

      const pkValues = await this._extractPksValues(updateData);
      if (pkValues) {
        // pk is specified - by pass
      } else {
        await this.model.getColumns();
        const { where } = this._getListArgs(args);
        const qb = this.dbDriver(this.tnPath);
        const aliasColObjMap = await this.model.getAliasColObjMap();
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
                (await Filter.rootFilterList({ viewId: args.viewId })) || [],
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
    let transaction;
    try {
      const deleteIds = await Promise.all(
        ids.map((d) =>
          this.model.mapAliasToColumn(d, this.clientMeta, this.dbDriver),
        ),
      );

      const deleted = [];
      const res = [];
      for (const d of deleteIds) {
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // throw or skip if no pk provided
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(JSON.stringify(pkValues));
          }
          continue;
        }

        const deletedRecord = await this.readByPk(pkValues);
        if (!deletedRecord) {
          // throw or skip if no record found
          if (throwExceptionIfNotExist) {
            NcError.recordNotFound(JSON.stringify(pkValues));
          }
          continue;
        }
        deleted.push(deletedRecord);

        res.push(d);
      }

      const execQueries: ((
        trx: Knex.Transaction,
        ids: any[],
      ) => Promise<any>)[] = [];

      const base = await Source.get(this.model.source_id);

      for (const column of this.model.columns) {
        if (column.uidt !== UITypes.LinkToAnotherRecord) continue;

        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>();

        switch (colOptions.type) {
          case 'mm':
            {
              const mmTable = await Model.get(colOptions.fk_mm_model_id);
              const mmParentColumn = await Column.get({
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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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
      await this.model.getColumns();
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.tnPath);
      const aliasColObjMap = await this.model.getAliasColObjMap();
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
          await column.getColOptions<LinkToAnotherRecordColumn>();

        if (colOptions.type === 'bt') {
          continue;
        }

        const childColumn = await colOptions.getChildColumn();
        const parentColumn = await colOptions.getParentColumn();
        const parentTable = await parentColumn.getModel();
        const childTable = await childColumn.getModel();
        await childTable.getColumns();
        await parentTable.getColumns();

        const childTn = this.getTnPath(childTable);

        switch (colOptions.type) {
          case 'mm':
            {
              const vChildCol = await colOptions.getMMChildColumn();
              const vTable = await colOptions.getMMModel();

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
              const relatedTable = await colOptions.getRelatedTable();
              if (relatedTable.mm) {
                break;
              }

              const childColumn = await Column.get({
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

      const source = await Source.get(this.model.source_id);

      trx = await this.dbDriver.transaction();

      // unlink LTAR data
      if (source.isMeta()) {
        for (const execQuery of execQueries) {
          await execQuery(trx, qb.clone());
        }
      }

      const deleteQb = qb.clone().transacting(trx).del();

      const count = (await deleteQb) as any;

      await trx.commit();

      await this.afterBulkDelete(count, this.dbDriver, cookie, true);

      return count;
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
    const id = this._extractPksValues(data);
    await Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.INSERT,
      description: DOMPurify.sanitize(
        `Record with ID ${id} has been inserted into Table ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
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
    const id = this._extractPksValues(newData);
    let desc = `Record with ID ${id} has been updated in Table ${this.model.title}.`;
    let details = '';
    if (updateObj) {
      updateObj = await this.model.mapColumnToAlias(updateObj);
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
    const id = this._extractPksValues(data);
    await Audit.insert({
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
  protected _extractPksValues(data: any) {
    // data can be still inserted without PK

    // if composite primary key return an object with all the primary keys
    if (this.model.primaryKeys.length > 1) {
      const pkValues = {};
      for (const pk of this.model.primaryKeys) {
        pkValues[pk.title] = data[pk.title] || data[pk.column_name];
      }
      return pkValues;
    } else if (this.model.primaryKey) {
      return (
        data[this.model.primaryKey.title] ||
        data[this.model.primaryKey.column_name]
      );
    } else {
      return 'N/A';
    }
  }

  protected async errorDelete(_e, _id, _trx, _cookie) {}

  async validate(data: Record<string, any>): Promise<boolean> {
    await this.model.getColumns();
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < this.model.columns.length; ++i) {
      const column = this.model.columns[i];

      if (
        column.title in data &&
        (isCreatedOrLastModifiedTimeCol(column) ||
          isCreatedOrLastModifiedByCol(column))
      ) {
        NcError.badRequest(
          `Column "${column.title}" is auto generated and cannot be updated`,
        );
      }
      await this.validateOptions(column, data);

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
      .getColOptions<{ options: SelectOption[] }>()
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
  }: {
    colId: string;
    rowId: string;
    childId: string;
    cookie?: any;
  }) {
    const columns = await this.model.getColumns();
    const column = columns.find((c) => c.id === colId);

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);
    const prevData = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const vTn = this.getTnPath(vTable);

          if (this.isSnowflake) {
            const parentPK = this.dbDriver(parentTn)
              .select(parentColumn.column_name)
              .where(_wherePk(parentTable.primaryKeys, childId))
              .first();

            const childPK = this.dbDriver(childTn)
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
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
          await this.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.HAS_MANY:
        {
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

          await this.updateLastModified({
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
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

          await this.updateLastModified({
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          const isBt = column.meta?.bt;
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
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
    }

    const response = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );
    await this.afterUpdate(prevData, response, this.dbDriver, cookie);
    await this.afterAddChild(rowId, childId, cookie);
  }

  public async afterAddChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.LINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been linked with record [id:${rowId}] in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
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
    const columns = await this.model.getColumns();
    const column = columns.find((c) => c.id === colId);

    if (
      !column ||
      ![UITypes.LinkToAnotherRecord, UITypes.Links].includes(column.uidt)
    )
      NcError.fieldNotFound(colId);

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    const prevData = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const vTn = this.getTnPath(vTable);

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
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
          await this.updateLastModified({
            model: childTable,
            rowIds: [rowId],
            cookie,
          });
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
            model: parentTable,
            rowIds: [rowId],
            cookie,
          });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
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
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
      case RelationTypes.ONE_TO_ONE:
        {
          const isBt = column.meta?.bt;
          await this.execAndParse(
            this.dbDriver(childTn)
              .where(_wherePk(childTable.primaryKeys, isBt ? rowId : childId))
              .update({ [childColumn.column_name]: null }),
            null,
            { raw: true },
          );

          await this.updateLastModified({
            model: parentTable,
            rowIds: [childId],
            cookie,
          });
        }
        break;
    }

    const newData = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );
    await this.afterUpdate(prevData, newData, this.dbDriver, cookie);
    await this.afterRemoveChild(rowId, childId, cookie);
  }

  public async afterRemoveChild(rowId, childId, req): Promise<void> {
    await Audit.insert({
      fk_model_id: this.model.id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.UNLINK_RECORD,
      row_id: rowId,
      description: DOMPurify.sanitize(
        `Record [id:${childId}] has been unlinked with record [id:${rowId}] in ${this.model.title}`,
      ),
      // details: JSON.stringify(data),
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
      const column = await this.model
        .getColumns()
        .then((cols) => cols?.find((col) => col.id === args.groupColumnId));

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
        }>();
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
      const aliasColObjMap = await this.model.getAliasColObjMap();
      let sorts = extractSortsObject(args?.sort, aliasColObjMap);
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);
      // todo: replace with view id
      if (!args.ignoreViewFilterAndSort && this.viewId) {
        await conditionV2(
          this,
          [
            new Filter({
              children:
                (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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
            : await Sort.list({ viewId: this.viewId });

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
    const column = await this.model
      .getColumns()
      .then((cols) => cols?.find((col) => col.id === args.groupColumnId));

    if (!column) NcError.fieldNotFound(args.groupColumnId);
    if (isVirtualCol(column))
      NcError.notImplemented('Grouping for virtual columns');

    const qb = this.dbDriver(this.tnPath)
      .count('*', { as: 'count' })
      .groupBy(column.column_name);

    // todo: refactor and move to a common method (applyFilterAndSort)
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    // todo: replace with view id

    if (!args.ignoreViewFilterAndSort && this.viewId) {
      await conditionV2(
        this,
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
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

  public async execAndParse(
    qb: Knex.QueryBuilder | string,
    dependencyColumns?: Column[],
    options: {
      skipDateConversion?: boolean;
      skipAttachmentConversion?: boolean;
      skipSubstitutingColumnIds?: boolean;
      skipUserConversion?: boolean;
      raw?: boolean; // alias for skipDateConversion and skipAttachmentConversion
      first?: boolean;
    } = {
      skipDateConversion: false,
      skipAttachmentConversion: false,
      skipSubstitutingColumnIds: false,
      skipUserConversion: false,
      raw: false,
      first: false,
    },
  ) {
    if (options.raw) {
      options.skipDateConversion = true;
      options.skipAttachmentConversion = true;
      options.skipSubstitutingColumnIds = true;
      options.skipUserConversion = true;
    }

    if (options.first && typeof qb !== 'string') {
      qb = qb.limit(1);
    }

    let query = typeof qb === 'string' ? qb : qb.toQuery();
    if (!this.isPg && !this.isMssql && !this.isSnowflake) {
      query = unsanitize(query);
    } else {
      query = sanitize(query);
    }

    let data =
      this.isPg || this.isSnowflake
        ? (await this.dbDriver.raw(query))?.rows
        : /^(\(|)select/.test(query) && !this.isMssql
        ? await this.dbDriver.from(
            this.dbDriver.raw(query).wrap('(', ') __nc_alias'),
          )
        : await this.dbDriver.raw(query);

    if (!this.model?.columns) {
      await this.model.getColumns();
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
    const btMap: Record<string, boolean> = {};

    modelColumns.forEach((col) => {
      if (aliasColumns && col.id in aliasColumns) {
        aliasColumns[col.id].id = col.id;
        aliasColumns[col.id].title = col.title;
        col = aliasColumns[col.id];
      }

      idToAliasMap[col.id] = col.title;
      if (
        [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(
          col.colOptions?.type,
        )
      ) {
        btMap[col.id] = true;
        const btData = Object.values(data).find(
          (d) => d[col.id] && Object.keys(d[col.id]),
        );
        if (btData) {
          if (typeof btData[col.id] === 'object') {
            for (const k of Object.keys(btData[col.id])) {
              const btAlias = idToAliasMap[k];
              if (!btAlias) {
                idToAliasPromiseMap[k] = Column.get({ colId: k }).then(
                  (col) => {
                    return col.title;
                  },
                );
              }
            }
          } else {
            // Has Many BT
            const btAlias = idToAliasMap[col.id];
            if (!btAlias) {
              idToAliasPromiseMap[col.id] = Column.get({
                colId: col.id,
              }).then((col) => {
                return col.title;
              });
            }
          }
        }
      } else {
        btMap[col.id] = false;
      }
    });

    for (const k of Object.keys(idToAliasPromiseMap)) {
      idToAliasMap[k] = await idToAliasPromiseMap[k];
    }

    data.forEach((item) => {
      Object.entries(item).forEach(([key, value]) => {
        const alias = idToAliasMap[key];
        if (alias) {
          if (btMap[key]) {
            if (value && typeof value === 'object') {
              const tempObj = {};
              Object.entries(value).forEach(([k, v]) => {
                const btAlias = idToAliasMap[k];
                if (btAlias) {
                  tempObj[btAlias] = v;
                }
              });
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
        const baseUsers = await BaseUser.getUsersList({
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
            for (const attachment of d[col.id]) {
              // we expect array of array of attachments in case of lookup
              if (Array.isArray(attachment)) {
                for (const lookedUpAttachment of attachment) {
                  if (lookedUpAttachment?.path) {
                    promises.push(
                      PresignedUrl.getSignedUrl({
                        path: lookedUpAttachment.path.replace(
                          /^download\//,
                          '',
                        ),
                      }).then((r) => (lookedUpAttachment.signedPath = r)),
                    );
                  } else if (lookedUpAttachment?.url) {
                    if (lookedUpAttachment.url.includes('.amazonaws.com/')) {
                      const relativePath = decodeURI(
                        lookedUpAttachment.url.split('.amazonaws.com/')[1],
                      );
                      promises.push(
                        PresignedUrl.getSignedUrl({
                          path: relativePath,
                          s3: true,
                        }).then((r) => (lookedUpAttachment.signedUrl = r)),
                      );
                    }
                  }
                }
              } else {
                if (attachment?.path) {
                  promises.push(
                    PresignedUrl.getSignedUrl({
                      path: attachment.path.replace(/^download\//, ''),
                    }).then((r) => (attachment.signedPath = r)),
                  );
                } else if (attachment?.url) {
                  if (attachment.url.includes('.amazonaws.com/')) {
                    const relativePath = decodeURI(
                      attachment.url.split('.amazonaws.com/')[1],
                    );
                    promises.push(
                      PresignedUrl.getSignedUrl({
                        path: relativePath,
                        s3: true,
                      }).then((r) => (attachment.signedUrl = r)),
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

  public async getNestedColumn(column: Column) {
    if (column.uidt !== UITypes.Lookup) {
      return column;
    }
    const colOptions = await column.getColOptions<LookupColumn>();
    return this.getNestedColumn(await colOptions?.getLookupColumn());
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
    const columns = await this.model.getColumns();
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

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    let relationType = colOptions.type;
    let childIds = _childIds;

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
    }

    switch (relationType) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          const vTn = this.getTnPath(vTable);

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
                        c[parentTable.primaryKey.title] ||
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
                        c[parentTable.primaryKey.title] ||
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
                      c[childTable.primaryKey.title] ||
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

    const updatedRow = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );
    await this.afterUpdate(row, updatedRow, this.dbDriver, cookie);
    for (const childId of childIds) {
      await this.afterAddChild(rowId, childId, cookie);
    }
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
    const columns = await this.model.getColumns();
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

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    const childTn = this.getTnPath(childTable);
    const parentTn = this.getTnPath(parentTable);

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

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
                        ? id[parentTable.primaryKey.title] ||
                          id[parentTable.primaryKey.column_name]
                        : id),
                  ),
              );

              NcError.recordNotFound(extractIds(missingIds));
            }
          }

          const vTn = this.getTnPath(vTable);

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
                    c[parentTable.primaryKey.title] ||
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
                    c[parentTable.primaryKey.title] ||
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
                        ? id[parentTable.primaryKey.title] ||
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
                      c[parentTable.primaryKey.title] ||
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

    const updatedRow = await this.readByPk(
      rowId,
      false,
      {},
      { ignoreView: true, getHiddenColumn: true },
    );
    await this.afterUpdate(row, updatedRow, this.dbDriver, cookie);
    for (const childId of childIds) {
      await this.afterRemoveChild(rowId, childId, cookie);
    }
  }

  async btRead(
    { colId, id }: { colId; id },
    args: { limit?; offset?; fieldSet?: Set<string> } = {},
  ) {
    try {
      const { where, sort } = this._getListArgs(args as any);
      // todo: get only required fields

      const relColumn = (await this.model.getColumns()).find(
        (c) => c.id === colId,
      );

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
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getParentColumn();
      const parentTable = await parentCol.getModel();
      const chilCol = await (
        (await relColumn.getColOptions()) as LinkToAnotherRecordColumn
      ).getChildColumn();
      const childTable = await chilCol.getModel();

      const parentModel = await Model.getBaseModelSQL({
        model: parentTable,
        dbDriver: this.dbDriver,
      });
      await childTable.getColumns();

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
        await parentTable.getColumns(),
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
  }: {
    rowIds: any | any[];
    cookie?: { user?: any };
    model?: Model;
    knex?: XKnex;
  }) {
    const columns = await model.getColumns();

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

    const qb = knex(this.getTnPath(model.table_name)).update(updateObject);

    for (const rowId of Array.isArray(rowIds) ? rowIds : [rowIds]) {
      qb.orWhere(_wherePk(model.primaryKeys, rowId));
    }

    await this.execAndParse(qb, null, { raw: true });
  }

  async prepareNocoData(data, isInsertData = false, cookie?: { user?: any }) {
    for (const column of this.model.columns) {
      if (
        ![
          UITypes.Attachment,
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
        if (data[column.column_name]) {
          if (Array.isArray(data[column.column_name])) {
            for (let attachment of data[column.column_name]) {
              attachment = extractProps(attachment, [
                'url',
                'path',
                'title',
                'mimetype',
                'size',
                'icon',
              ]);
            }
          }
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
            /^\s*[{[]$/.test(data[column.column_name])
          ) {
            try {
              data[column.column_name] = JSON.parse(data[column.column_name]);
            } catch (e) {}
          }

          const baseUsers = await BaseUser.getUsersList({
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
      }
    }
  }

  public now() {
    return dayjs()
      .utc()
      .format(this.isMySQL ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ');
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
    }
    // replace + at the beginning if present
    else sort.fk_column_id = aliasColObjMap[s.replace(/^\+/, '')]?.id;

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

export function _wherePk(primaryKeys: Column[], id: unknown | unknown[]) {
  const where = {};

  // if id object is provided use as it is
  if (id && typeof id === 'object' && !Array.isArray(id)) {
    // verify all pk columns are present in id object
    for (const pk of primaryKeys) {
      if (pk.id in id) {
        where[pk.column_name] = id[pk.id];
      } else if (pk.title in id) {
        where[pk.column_name] = id[pk.title];
      } else if (pk.column_name in id) {
        where[pk.column_name] = id[pk.column_name];
      } else {
        NcError.badRequest(
          `Primary key column ${pk.title} not found in id object`,
        );
      }
    }

    return where;
  }

  const ids = Array.isArray(id) ? id : (id + '').split('___');
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

function getCompositePk(primaryKeys: Column[], row) {
  return primaryKeys.map((c) => row[c.title]).join('___');
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

export { BaseModelSqlv2 };
