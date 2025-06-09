// eslint-disable-file no-fallthrough
import {
  ButtonActionsType,
  extractFilterFromXwhere,
  isOrderCol,
  NcDataErrorCodes,
  parseProp,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { NcApiVersion } from 'nocodb-sdk';
import {
  checkForCurrentUserFilters,
  checkForStaticDateValFilters,
  shouldSkipCache,
} from './common-helpers';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcContext } from '~/interface/config';
import type {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  Source,
} from '~/models';
import type CustomKnex from 'src/db/CustomKnex';
import { recursiveCTEFromLookupColumn } from '~/helpers/lookupHelpers';
import { Column, Filter, Model, Sort, View } from '~/models';
import {
  _wherePk,
  extractSortsObject,
  getAs,
  getColumnName,
  getListArgs,
} from '~/db/BaseModelSqlv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { sanitize } from '~/helpers/sqlSanitize';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import getAst from '~/helpers/getAst';
import { CacheGetType, CacheScope } from '~/utils/globals';
import NocoCache from '~/cache/NocoCache';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { singleQueryRead as mysqlSingleQueryRead } from '~/services/data-opt/mysql-helpers';

export function generateNestedRowSelectQuery({
  knex,
  alias,
  columns,
  isBtOrOo = false,
  title,
}: {
  knex: XKnex;
  alias: string;
  title: string;
  columns: Column[];
  isBtOrOo?: boolean;
}) {
  const paramsString = columns.map(() => `?,??.??`).join(',');
  const pramsValueArr = [...columns.flatMap((c) => [c.id, alias, c.id]), title];

  return knex.raw(
    isBtOrOo
      ? `json_build_object(${paramsString}) as ??`
      : `coalesce(json_agg(jsonb_build_object(${paramsString})),'[]'::json) as ??`,
    pramsValueArr,
  );
}

const SKIP_COUNT_CACHE_VALUE = '__nc_skip__';
const COUNT_QUERY_TIMEOUT = 3000;
const logger = new Logger('pg-single-query');

export async function extractColumns({
  columns,
  // allowedCols,
  knex,
  qb,
  getAlias,
  params,
  // dependencyFields,
  alias = ROOT_ALIAS,
  baseModel,
  ast,
  throwErrorIfInvalidParams,
  validateFormula,
  apiVersion,
}: {
  columns: Column[];
  // allowedCols?: Record<string, boolean>;
  knex: XKnex;
  qb;
  getAlias: () => string;
  params: any;
  alias?: string;
  baseModel: BaseModelSqlv2;
  // dependencyFields: DependantFields;
  ast: Record<string, any> | boolean | 0 | 1;
  throwErrorIfInvalidParams: boolean;
  validateFormula: boolean;
  apiVersion: NcApiVersion;
}) {
  const extractColumnPromises = [];
  for (const column of columns) {
    if (
      // if ast is `true` then extract primary key and primary value
      !((ast === true || ast === 1) && (column.pv || column.pk)) &&
      !ast?.[column.title]
    )
      continue;

    extractColumnPromises.push(
      extractColumn({
        column,
        knex,
        rootAlias: alias,
        qb,
        getAlias,
        params: params?.nested?.[column.title],
        baseModel,
        ast: ast?.[column.title],
        throwErrorIfInvalidParams,
        validateFormula,
        columns,
        apiVersion,
      }),
    );
  }
  await Promise.all(extractColumnPromises);
}

export async function extractColumn({
  column,
  qb,
  rootAlias,
  knex,
  params,
  // @ts-ignore
  isLookup,
  getAlias,
  baseModel,
  // dependencyFields,
  ast,
  throwErrorIfInvalidParams,
  validateFormula,
  columns,
  apiVersion = NcApiVersion.V2,
}: {
  column: Column;
  qb: Knex.QueryBuilder;
  rootAlias: string;
  knex: XKnex;
  isLookup?: boolean;
  params?: any;
  getAlias: () => string;
  baseModel: BaseModelSqlv2;
  // dependencyFields: DependantFields;
  ast: Record<string, any>;
  throwErrorIfInvalidParams: boolean;
  validateFormula: boolean;
  columns?: Column[];
  apiVersion: NcApiVersion;
}) {
  const context = baseModel.context;

  const result = { isArray: false };
  // todo: check system field enabled / not
  //      filter on nested list
  //      sort on nested list

  // if (isSystemColumn(column)) return result;
  // const model = await column.getModel(context);
  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
      {
        const relatedModel = await (
          column.colOptions as LinkToAnotherRecordColumn
        ).getRelatedTable(context);

        const { refContext } = (
          column.colOptions as LinkToAnotherRecordColumn
        ).getRelContext(context);

        await relatedModel.getColumns(refContext);
        // @ts-ignore
        const pkColumn = relatedModel.primaryKey;
        // if mm table then only extract primary keys
        const pvColumn = relatedModel.mm
          ? relatedModel.primaryKeys[1]
          : relatedModel.displayValue;

        // extract nested query params

        const listArgs = getListArgs(params ?? {}, relatedModel, {
          ignoreAssigningWildcardSelect: true,
          apiVersion,
          nested: true,
        });

        const aliasColObjMap = await relatedModel.getAliasColObjMap(refContext);

        // todo: check if fields are allowed
        let fields = [
          pkColumn,
          ...(pvColumn && pvColumn !== pkColumn ? [pvColumn] : []),
        ];

        if (listArgs?.fields === '*') {
          fields = relatedModel.columns;
        } else if (listArgs?.fields?.length) {
          fields = listArgs.fields
            ?.split(',')
            .map((f) => aliasColObjMap[f])
            .filter(Boolean);
        }

        const sorts = extractSortsObject(
          context,
          listArgs?.sort,
          aliasColObjMap,
          throwErrorIfInvalidParams,
        );
        const { filters: queryFilterObj } = extractFilterFromXwhere(
          refContext,
          listArgs?.where,
          aliasColObjMap,
          throwErrorIfInvalidParams,
        );

        switch (column.colOptions.type) {
          case RelationTypes.MANY_TO_MANY:
            {
              result.isArray = true;
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();
              const alias4 = getAlias();
              const alias5 = getAlias();

              const relationColOpts =
                column.colOptions as LinkToAnotherRecordColumn;

              const { parentContext, childContext, mmContext, refContext } =
                await relationColOpts.getParentChildContext(context);

              const parentModel = await relationColOpts.getRelatedTable(
                refContext,
              );
              const mmChildColumn = await relationColOpts.getMMChildColumn(
                mmContext,
              );
              const mmParentColumn = await relationColOpts.getMMParentColumn(
                mmContext,
              );
              const assocModel = await relationColOpts.getMMModel(mmContext);
              const childColumn = await relationColOpts.getChildColumn(
                childContext,
              );
              const parentColumn = await relationColOpts.getParentColumn(
                parentContext,
              );

              const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
                id: assocModel.id,
                dbDriver: knex,
              });

              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  id: parentColumn.fk_model_id,
                  dbDriver: knex,
                },
              );

              // if mm table is not present then return
              if (!assocModel) {
                return qb.select(
                  knex.raw('? as ??', [
                    NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                    getAs(column),
                  ]),
                );
              }

              const assocQb = knex(
                knex.raw('?? as ??', [
                  assocBaseModel.getTnPath(assocModel),
                  alias1,
                ]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

              const mmQb = knex(assocQb.as(alias4))
                .leftJoin(
                  knex.raw(`?? as ?? on ??.?? = ??.??`, [
                    parentBaseModel.getTnPath(parentModel),
                    alias2,
                    alias2,
                    sanitize(parentColumn.column_name),
                    alias4,
                    sanitize(mmParentColumn.column_name),
                  ]),
                )
                .select(knex.raw('??.*', [alias2]))
                .limit(+listArgs.limit + 1)
                .offset(+listArgs.offset);

              // apply filters on nested query
              await conditionV2(parentBaseModel, queryFilterObj, mmQb, alias2);

              const view = relationColOpts.fk_target_view_id
                ? await View.get(refContext, relationColOpts.fk_target_view_id)
                : await View.getDefaultView(
                    refContext,
                    parentBaseModel.model.id,
                  );
              const relatedSorts = await view.getSorts(refContext);
              // apply sorts on nested query
              if (sorts && sorts.length > 0) {
                await sortV2(parentBaseModel, sorts, mmQb, alias2);
              } else if (relatedSorts && relatedSorts.length > 0)
                await sortV2(parentBaseModel, relatedSorts, mmQb, alias2);

              const mmAggQb = knex(mmQb.as(alias5));
              await extractColumns({
                columns: fields,
                knex,
                qb: mmAggQb,
                params,
                getAlias,
                alias: alias5,
                baseModel: parentBaseModel,
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
                apiVersion,
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL
                     (${knex
                       .from(mmAggQb.as(alias3))
                       .select(
                         generateNestedRowSelectQuery({
                           knex,
                           alias: alias3,
                           columns: fields,
                           title: getAs(column),
                         }),
                       )
                       .toQuery()}) as ?? ON true`,
                [alias1],
              );

              qb.select(knex.raw('??.??', [alias1, getAs(column)]));
            }
            break;
          case RelationTypes.BELONGS_TO:
            {
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const { refContext, parentContext, childContext } = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentChildContext(context);

              const parentModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getRelatedTable(refContext);
              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(childContext);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(parentContext);

              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  model: parentModel,
                  dbDriver: knex,
                },
              );

              const btQb = knex(parentBaseModel.getTnPath(parentModel))
                .select('*')
                .where(
                  parentColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(childColumn.column_name),
                  ]),
                )
                .first();

              // apply filters on nested query
              await conditionV2(parentBaseModel, queryFilterObj, btQb);

              const btAggQb = knex(btQb.as(alias3));
              await extractColumns({
                columns: fields,
                knex,
                qb: btAggQb,
                params,
                getAlias,
                alias: alias3,
                baseModel: parentBaseModel,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
                apiVersion: apiVersion,
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(btAggQb.as(alias2))
                  .select(
                    generateNestedRowSelectQuery({
                      knex,
                      alias: alias2,
                      columns: fields,
                      title: getAs(column),
                      isBtOrOo: true,
                    }),
                  )
                  .toQuery()}) as ?? ON true`,
                [alias1],
              );

              qb.select(knex.raw('??.??', [alias1, getAs(column)]));
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = column.meta?.bt;
              const relationColOpts =
                column.colOptions as LinkToAnotherRecordColumn;

              const { childContext, parentContext, refContext } =
                await relationColOpts.getParentChildContext(context);

              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const refModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getRelatedTable(refContext);
              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(childContext);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(parentContext);

              const refBaseModel = await Model.getBaseModelSQL(refContext, {
                model: refModel,
                dbDriver: knex,
              });

              if (isBt) {
                const btQb = knex(refBaseModel.getTnPath(refModel))
                  .select('*')
                  .where(
                    parentColumn.column_name,
                    knex.raw('??.??', [
                      rootAlias,
                      sanitize(childColumn.column_name),
                    ]),
                  )
                  .first();

                // apply filters on nested query
                await conditionV2(refBaseModel, queryFilterObj, btQb);

                const btAggQb = knex(btQb.as(alias3));
                await extractColumns({
                  columns: fields,
                  knex,
                  qb: btAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel: refBaseModel,
                  // dependencyFields,
                  ast,
                  throwErrorIfInvalidParams,
                  validateFormula,
                  apiVersion,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(btAggQb.as(alias2))
                    .select(
                      generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: getAs(column),
                        isBtOrOo: true,
                      }),
                    )
                    .toQuery()}) as ?? ON true`,
                  [alias1],
                );

                qb.select(knex.raw('??.??', [alias1, getAs(column)]));
              } else {
                const hmQb = knex(refBaseModel.getTnPath(refModel))
                  .select('*')
                  .where(
                    childColumn.column_name,
                    knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                  )
                  .first();

                // apply filters on nested query
                await conditionV2(refBaseModel, queryFilterObj, hmQb);

                // apply sorts on nested query
                // if (sorts) await sortV2(refBaseModel, sorts, hmQb);

                const hmAggQb = knex(hmQb.as(alias3));
                await extractColumns({
                  columns: fields,
                  knex,
                  qb: hmAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel: refBaseModel,
                  // dependencyFields,
                  ast,
                  throwErrorIfInvalidParams,
                  validateFormula,
                  apiVersion,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(hmAggQb.as(alias2))
                    .select(
                      generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: getAs(column),
                        isBtOrOo: true,
                      }),
                    )
                    .toQuery()}) as ?? ON true`,
                  [alias1],
                );
                qb.select(knex.raw('??.??', [alias1, getAs(column)]));
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              result.isArray = true;
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();
              const relationColOpts =
                column.colOptions as LinkToAnotherRecordColumn;

              const { childContext, parentContext, refContext } =
                await relationColOpts.getParentChildContext(context);

              const childModel = await relationColOpts.getRelatedTable(
                refContext,
              );
              const childColumn = await relationColOpts.getChildColumn(
                childContext,
              );
              const parentColumn = await relationColOpts.getParentColumn(
                parentContext,
              );

              const childBaseModel = await Model.getBaseModelSQL(childContext, {
                dbDriver: knex,
                model: childModel,
              });

              const hmQb = knex(childBaseModel.getTnPath(childModel))
                .select('*')
                .where(
                  childColumn.column_name,
                  knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                )

                .limit(+listArgs.limit + 1)
                .offset(+listArgs.offset);

              // apply filters on nested query
              await conditionV2(childBaseModel, queryFilterObj, hmQb);

              const view = relationColOpts.fk_target_view_id
                ? await View.get(
                    childContext,
                    relationColOpts.fk_target_view_id,
                  )
                : await View.getDefaultView(childContext, childModel.id);
              const childSorts = await view.getSorts(childContext);

              // apply sorts on nested query
              if (sorts && sorts.length > 0) {
                await sortV2(childBaseModel, sorts, hmQb, alias2);
              } else if (childSorts && childSorts.length > 0)
                await sortV2(childBaseModel, childSorts, hmQb);

              const hmAggQb = knex(hmQb.as(alias3));
              await extractColumns({
                columns: fields,
                knex,
                qb: hmAggQb,
                params,
                getAlias,
                alias: alias3,
                baseModel: childBaseModel,
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
                apiVersion,
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(hmAggQb.as(alias2))
                  .select(
                    generateNestedRowSelectQuery({
                      knex,
                      alias: alias2,
                      columns: fields,
                      title: getAs(column),
                    }),
                  )
                  .toQuery()}) as ?? ON true`,
                [alias1],
              );
              qb.select(knex.raw('??.??', [alias1, getAs(column)]));
            }
            break;
        }
      }
      break;
    case UITypes.Lookup:
      {
        const alias2 = getAlias();
        const lookupTableAlias = getAlias();

        const lookupColOpt = await column.getColOptions<LookupColumn>(context);

        const relationColumn = await lookupColOpt.getRelationColumn(context);
        const relationColOpts =
          await relationColumn.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );

        const { parentContext, childContext, refContext, mmContext } =
          await relationColOpts.getParentChildContext(context);

        const lookupColumn = await lookupColOpt.getLookupColumn(refContext);

        let relQb;
        const relTableAlias = getAlias();
        let refBaseModel: BaseModelSqlv2;

        switch (relationColOpts.type) {
          case RelationTypes.MANY_TO_MANY:
            {
              result.isArray = true;

              const alias1 = getAlias();
              const alias4 = getAlias();

              const parentModel = await relationColOpts.getRelatedTable(
                refContext,
              );
              const mmChildColumn = await relationColOpts.getMMChildColumn(
                mmContext,
              );
              const mmParentColumn = await relationColOpts.getMMParentColumn(
                mmContext,
              );
              const assocModel = await relationColOpts.getMMModel(mmContext);
              const childColumn = await relationColOpts.getChildColumn(
                childContext,
              );
              const parentColumn = await relationColOpts.getParentColumn(
                parentContext,
              );

              const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
                model: assocModel,
                dbDriver: knex,
              });
              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  model: parentModel,
                  dbDriver: knex,
                },
              );
              refBaseModel = parentBaseModel;

              // if mm table is not present then return
              if (!assocModel) {
                return qb.select(
                  knex.raw('? as ??', [
                    NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                    getAs(column),
                  ]),
                );
              }

              const assocQb = knex(
                knex.raw('?? as ??', [
                  assocBaseModel.getTnPath(assocModel),
                  alias1,
                ]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

              relQb = knex(assocQb.as(alias4)).leftJoin(
                knex.raw(`?? as ?? on ??.?? = ??.??`, [
                  parentBaseModel.getTnPath(parentModel),
                  relTableAlias,
                  relTableAlias,
                  sanitize(parentColumn.column_name),
                  alias4,
                  sanitize(mmParentColumn.column_name),
                ]),
              );
            }
            break;
          case RelationTypes.BELONGS_TO:
            {
              const parentModel = await relationColOpts.getRelatedTable(
                refContext,
              );
              const childColumn = await relationColOpts.getChildColumn(
                childContext,
              );
              const parentColumn = await relationColOpts.getParentColumn(
                parentContext,
              );

              const parentBaseModel = await Model.getBaseModelSQL(
                parentContext,
                {
                  model: parentModel,
                  dbDriver: knex,
                },
              );

              refBaseModel = parentBaseModel;
              const useRecursiveEvaluation = parseProp(
                column.meta,
              )?.useRecursiveEvaluation;
              // TODO: [recursive lookup]
              // eslint-disable-next-line no-constant-condition
              if (false && useRecursiveEvaluation) {
                result.isArray = true;
                const cteQB = await recursiveCTEFromLookupColumn({
                  baseModelSqlV2: parentBaseModel,
                  lookupColumn: column,
                  tableAlias: relTableAlias,
                });
                // applying CTE
                cteQB(qb);

                relQb = knex(
                  knex.raw('?? as ??', [relTableAlias, relTableAlias]),
                )
                  .where(
                    `${relTableAlias}.root_id`,
                    '<>',
                    knex.raw('??.??', [relTableAlias, 'id']),
                  )
                  .andWhere(
                    `${relTableAlias}.root_id`,
                    knex.raw('??.??', [
                      rootAlias,
                      sanitize(parentColumn.column_name),
                    ]),
                  );
              } else {
                relQb = knex(
                  knex.raw('?? as ??', [
                    parentBaseModel.getTnPath(parentModel),
                    relTableAlias,
                  ]),
                ).where(
                  parentColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(childColumn.column_name),
                  ]),
                );
              }
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = relationColumn.meta?.bt;
              if (isBt) {
                const parentModel = await relationColOpts.getRelatedTable(
                  refContext,
                );
                const childColumn = await relationColOpts.getChildColumn(
                  childContext,
                );
                const parentColumn = await relationColOpts.getParentColumn(
                  parentContext,
                );
                const parentBaseModel = await Model.getBaseModelSQL(
                  refContext,
                  {
                    model: parentModel,
                    dbDriver: knex,
                  },
                );

                refBaseModel = parentBaseModel;
                relQb = knex(
                  knex.raw('?? as ??', [
                    parentBaseModel.getTnPath(parentModel),
                    relTableAlias,
                  ]),
                ).where(
                  parentColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(childColumn.column_name),
                  ]),
                );
              } else {
                const childModel = await relationColOpts.getRelatedTable(
                  refContext,
                );
                const childColumn = await relationColOpts.getChildColumn(
                  childContext,
                );
                const parentColumn = await relationColOpts.getParentColumn(
                  parentContext,
                );
                const childBaseModel = await Model.getBaseModelSQL(
                  childContext,
                  {
                    model: childModel,
                    dbDriver: knex,
                  },
                );

                refBaseModel = childBaseModel;
                relQb = knex(
                  knex.raw('?? as ??', [
                    childBaseModel.getTnPath(childModel),
                    relTableAlias,
                  ]),
                ).where(
                  childColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(parentColumn.column_name),
                  ]),
                );
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              result.isArray = true;
              const childModel = await relationColOpts.getRelatedTable(
                refContext,
              );
              const childColumn = await relationColOpts.getChildColumn(
                childContext,
              );
              const parentColumn = await relationColOpts.getParentColumn(
                parentContext,
              );
              const childBaseModel = await Model.getBaseModelSQL(childContext, {
                model: childModel,
                dbDriver: knex,
              });

              const useRecursiveEvaluation = parseProp(
                column.meta,
              )?.useRecursiveEvaluation;
              // TODO: [recursive lookup]
              // eslint-disable-next-line no-constant-condition
              if (false && useRecursiveEvaluation) {
                const cteQB = await recursiveCTEFromLookupColumn({
                  baseModelSqlV2: childBaseModel,
                  lookupColumn: column,
                  tableAlias: relTableAlias,
                });
                // applying CTE
                cteQB(qb);

                refBaseModel = childBaseModel;
                relQb = knex(
                  knex.raw('?? as ??', [relTableAlias, relTableAlias]),
                )
                  .where(
                    `${relTableAlias}.root_id`,
                    '<>',
                    knex.raw('??.??', [relTableAlias, 'id']),
                  )
                  .andWhere(
                    `${relTableAlias}.root_id`,
                    knex.raw('??.??', [
                      rootAlias,
                      sanitize(parentColumn.column_name),
                    ]),
                  );
              } else {
                refBaseModel = childBaseModel;
                relQb = knex(
                  knex.raw('?? as ??', [
                    childBaseModel.getTnPath(childModel),
                    relTableAlias,
                  ]),
                ).where(
                  childColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(parentColumn.column_name),
                  ]),
                );
              }
            }

            break;
        }

        const { isArray } = await extractColumn({
          qb: relQb,
          rootAlias: relTableAlias,
          knex,
          getAlias,
          column: lookupColumn,
          baseModel: refBaseModel!,
          ast,
          throwErrorIfInvalidParams,
          validateFormula,
          apiVersion,
        });

        if (!result.isArray) {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL
               (${knex
                 .from(relQb.as(alias2))
                 .select(
                   knex.raw(`??.?? as ??`, [
                     alias2,
                     getAs(lookupColumn),
                     getAs(column),
                   ]),
                 )
                 .toQuery()}) as ?? ON true`,
            [lookupTableAlias],
          );
        } else if (isArray) {
          const alias = getAlias();
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL (${knex
              .from(relQb.as(alias2))
              .select(
                knex.raw(`coalesce(json_agg(??),'[]'::json) as ??`, [
                  alias,
                  getAs(column),
                ]),
              )
              .toQuery()},json_array_elements(??.??) as ?? ) as ?? ON true`,
            [alias2, getAs(lookupColumn), alias, lookupTableAlias],
          );
        } else {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL (${knex
              .from(relQb.as(alias2))
              .select(
                knex.raw(`coalesce(json_agg(??.??),'[]'::json) as ??`, [
                  alias2,
                  getAs(lookupColumn),
                  getAs(column),
                ]),
              )
              .toQuery()}) as ?? ON true`,
            [lookupTableAlias],
          );
        }
        qb.select(knex.raw('??.??', [lookupTableAlias, getAs(column)]));
      }
      break;
    case UITypes.Formula:
      {
        const model: Model = await column.getModel(context);
        const formula = await column.getColOptions<FormulaColumn>(context);
        if (formula.error) {
          qb.select(knex.raw(`'ERR' as ??`, [getAs(column)]));
          return result;
        }
        try {
          const selectQb = await formulaQueryBuilderv2({
            baseModel: baseModel,
            tree: formula.formula,
            model,
            column,
            tableAlias: rootAlias,
            validateFormula,
          });
          qb.select(knex.raw(`?? as ??`, [selectQb.builder, getAs(column)]));
        } catch (e) {
          logger.log(e);
          qb.select(knex.raw(`'ERR' as ??`, [getAs(column)]));
        }
      }
      break;
    case UITypes.Button:
      {
        const model: Model = await column.getModel(context);
        const buttonColumn = await column.getColOptions<ButtonColumn>(context);
        if (buttonColumn.type === ButtonActionsType.Url) {
          if (buttonColumn.error) return result;
          const selectQb = await formulaQueryBuilderv2({
            baseModel: baseModel,
            tree: buttonColumn.formula,
            model,
            column,
            tableAlias: rootAlias,
            validateFormula,
          });
          qb.select(
            knex.raw(
              `json_build_object('type', ?, 'label', ?, 'url', ??) as ??`,
              [
                buttonColumn.type,
                `${buttonColumn.label}`,
                selectQb.builder,
                getAs(column),
              ],
            ),
          );
        } else if (
          [ButtonActionsType.Webhook, ButtonActionsType.Script].includes(
            buttonColumn.type,
          )
        ) {
          const key =
            buttonColumn.type === ButtonActionsType.Webhook
              ? 'fk_webhook_id'
              : 'fk_script_id';

          qb.select(
            knex.raw(
              `json_build_object('type', ?, 'label', ?, '${key}', ?) as ??`,
              [
                buttonColumn.type,
                `${buttonColumn.label}`,
                buttonColumn[key],
                getAs(column),
              ],
            ),
          );
        }
      }
      break;
    case UITypes.Rollup:
    case UITypes.Links:
      qb.select(
        (
          await genRollupSelectv2({
            baseModelSqlv2: baseModel,
            knex,
            columnOptions: await column.getColOptions(context),
            alias: rootAlias,
          })
        ).builder.as(getAs(column)),
      );
      break;
    case UITypes.Barcode:
      {
        const barcodeCol = await column.getColOptions<BarcodeColumn>(context);

        if (!barcodeCol.fk_barcode_value_column_id) {
          qb.select(knex.raw(`? as ??`, ['ERR!', getAs(column)]));
          break;
        }

        const barcodeValCol = await barcodeCol.getValueColumn(context);

        return extractColumn({
          column: new Column({
            ...barcodeValCol,
            asId: column.id,
          }),
          qb,
          rootAlias,
          knex,
          params,
          isLookup,
          getAlias,
          baseModel,
          // dependencyFields,
          ast,
          throwErrorIfInvalidParams,
          validateFormula,
          apiVersion,
        });
      }
      break;
    case UITypes.QrCode:
      {
        const qrCol = await column.getColOptions<QrCodeColumn>(context);

        if (!qrCol.fk_qr_value_column_id) {
          qb.select(knex.raw(`? as ??`, ['ERR!', getAs(column)]));
          break;
        }

        const qrValCol = await qrCol.getValueColumn(context);

        return extractColumn({
          column: new Column({
            ...qrValCol,
            asId: column.id,
          }),
          qb,
          rootAlias,
          knex,
          params,
          isLookup,
          getAlias,
          baseModel,
          // dependencyFields,
          ast,
          throwErrorIfInvalidParams,
          validateFormula,
          apiVersion,
        });
      }
      break;

    case UITypes.Attachment:
      {
        qb.select(
          knex.raw(`to_json(??.??) as ??`, [
            rootAlias,
            sanitize(column.column_name),
            getAs(column),
          ]),
        );
      }
      break;
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
    case UITypes.DateTime: {
      const columnName = await getColumnName(context, column, columns);

      // if there is no timezone info,
      // convert to database timezone,
      // then convert to UTC
      if (
        column.dt !== 'timestamp with time zone' &&
        column.dt !== 'timestamptz'
      ) {
        qb.select(
          knex.raw(
            `TO_CHAR((??.?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SSTZH:TZM') as ??`,
            [rootAlias, sanitize(columnName), getAs(column)],
          ),
        );
      } else {
        qb.select(
          knex.raw(`??.?? as ??`, [
            rootAlias,
            sanitize(column.column_name),
            getAs(column),
          ]),
        );
      }
      break;
    }
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      const columnName = await getColumnName(context, column, columns);

      qb.select(
        knex.raw(`??.?? as ??`, [
          rootAlias,
          sanitize(columnName),
          getAs(column),
        ]),
      );
      break;
    }
    default:
      {
        // if v3 api then return as array by splitting
        if (
          column.uidt === UITypes.MultiSelect &&
          apiVersion === NcApiVersion.V3
        ) {
          const columnName = await getColumnName(context, column, columns);

          qb.select(
            knex.raw(`string_to_array(??.??, ',') as ??`, [
              rootAlias,
              sanitize(columnName),
              getAs(column),
            ]),
          );
        } else if (column.dt === 'bytea') {
          qb.select(
            knex.raw(
              `encode(??.??, '${
                column.meta?.format === 'hex' ? 'hex' : 'escape'
              }') as ??`,
              [rootAlias, sanitize(column.column_name), getAs(column)],
            ),
          );
        } else {
          qb.select(
            knex.raw(`??.?? as ??`, [
              rootAlias,
              sanitize(column.column_name),
              getAs(column),
            ]),
          );
        }
      }
      break;
  }
  return result;
}

// generate a unique placeholder which is not present in the string
function getUniquePlaceholders(
  searchWithin: string,
  initialVal = '__nc_placeholder__',
) {
  let placeholder = initialVal;
  let i = 0;
  while (searchWithin.includes(placeholder)) {
    placeholder = initialVal + ++i;
  }
  return placeholder;
}

export async function singleQueryRead(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    id: string;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    apiVersion?: NcApiVersion;
  },
): Promise<PagedResponseImpl<Record<string, any>>> {
  await ctx.model.getColumns(context);

  if (ctx.source.type !== 'pg') {
    throw new Error('Single query only supported in postgres');
  }

  let skipCache = shouldSkipCache(ctx, false);

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const baseModel = await Model.getBaseModelSQL(context, {
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:read`;
  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    if (cachedQuery) {
      const res = await baseModel.execAndParse(
        knex
          .raw(
            cachedQuery,
            ctx.model.primaryKeys.length === 1
              ? [ctx.id]
              : ctx.id.split('___').map((id) => id.replaceAll('\\_', '_')),
          )
          .toQuery(),
        null,
        { skipDateConversion: true, first: true },
      );

      return res;
    }
  }

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // load columns list
  const columns = await ctx.model.getColumns(context);

  const rootQb = knex(baseModel.getTnPath(ctx.model));

  // dummy id placeholder to be replaced later
  const idSym = Symbol('__dummy_id_placeholder');

  // use ids as a unique value to replace raw in the query later
  rootQb.where(
    ctx.model.primaryKeys.reduce((acc, pk) => {
      acc[pk.column_name] = idSym;
      return acc;
    }, {}),
  );

  const aliasColObjMap = await ctx.model.getAliasColObjMap(context);
  // let sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
  const { filters: queryFilterObj } = extractFilterFromXwhere(
    context,
    listArgs?.where,
    aliasColObjMap,
  );

  const viewFilters = ctx.view?.id
    ? await Filter.rootFilterList(context, {
        viewId: ctx.view?.id,
      })
    : [];

  if (viewFilters?.length && checkForStaticDateValFilters(viewFilters)) {
    skipCache = true;
  }

  const aggrConditionObj = [
    ...(ctx.view?.id
      ? [
          new Filter({
            children: viewFilters,
            is_group: true,
          }),
        ]
      : []),
    new Filter({
      children: ctx.params.filterArr || [],
      is_group: true,
      logical_op: 'and',
    }),
    new Filter({
      children: queryFilterObj,
      is_group: true,
      logical_op: 'and',
    }),
  ];

  if (
    await checkForCurrentUserFilters({ context, filters: aggrConditionObj })
  ) {
    skipCache = true;
  }
  // apply filters on root query
  await conditionV2(baseModel, aggrConditionObj, rootQb);

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    getHiddenColumn: ctx.getHiddenColumn,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
  });

  await extractColumns({
    columns,
    knex,
    qb,
    getAlias,
    params: ctx.params,
    baseModel,
    ast,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    validateFormula: ctx.validateFormula,
    apiVersion: ctx.apiVersion,
  });

  // const dataAlias = getAlias();

  const finalQb = qb.first();

  const { sql, bindings } = finalQb.toSQL();

  // get unique placeholder which is not present in the query
  const idPlaceholder = getUniquePlaceholders(finalQb.toQuery());

  // // take care of composite primary key
  // const idPlaceholders = ctx.model.primaryKeys.map(() => idPlaceholder);

  // bind all params and replace id  with placeholders
  // and in generated sql replace placeholders with bindings
  const query = knex
    .raw(
      sql,
      bindings.map((v: unknown) => (v === idSym ? idPlaceholder : v)),
    )
    .toQuery()
    // escape any `?` in the query to avoid replacing them with bindings
    .replace(/\?/g, '\\?')
    .replaceAll(`'${idPlaceholder}'`, '?');

  if (!skipCache) {
    // cache query for later use
    await NocoCache.set(cacheKey, query);
  }

  // const res = await finalQb;

  const res = await baseModel.execAndParse(
    knex
      .raw(
        query,
        ctx.model.primaryKeys.length === 1
          ? [ctx.id]
          : ctx.id.split('___').map((id) => id.replaceAll('\\_', '_')),
      )
      .toQuery(),
    null,
    { skipDateConversion: true, first: true },
  );

  return res;
}

export async function singleQueryList(
  context: NcContext,
  ctx: {
    model: Model;
    view: View;
    source: Source;
    params;
    throwErrorIfInvalidParams?: boolean;
    validateFormula?: boolean;
    ignorePagination?: boolean;
    limitOverride?: number;
    baseModel?: BaseModelSqlv2;
    customConditions?: Filter[];
    getHiddenColumns?: boolean;
    apiVersion?: NcApiVersion;
    includeSortAndFilterColumns?: boolean;
  },
): Promise<PagedResponseImpl<Record<string, any>>> {
  const excludeCount = ctx.params?.excludeCount;

  if (ctx.source.type !== 'pg') {
    throw new Error('Source is not postgres');
  }

  let dbQueryTime;
  let skipCache = shouldSkipCache(ctx);

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const baseModel =
    ctx.baseModel ||
    (await Model.getBaseModelSQL(context, {
      id: ctx.model.id,
      viewId: ctx.view?.id,
      dbDriver: knex,
    }));

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;
  const countCacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:count`;

  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    const cachedCountQuery = await NocoCache.get(
      countCacheKey,
      CacheGetType.TYPE_STRING,
    );
    if (cachedQuery && cachedCountQuery) {
      const [countRes, res] = await getDataWithCountCache({
        query: cachedQuery,
        countQuery: cachedCountQuery,
        limit: +listArgs.limit,
        offset: +listArgs.offset,
        knex,
        countCacheKey,
        skipCache,
        excludeCount,
        recordQueryTime: (time: string) => {
          dbQueryTime = time;
        },
        apiVersion: ctx.apiVersion,
        baseModel,
      });

      // if count is less than the actual result length then reset the count cache
      if (
        countRes !== undefined &&
        countRes !== null &&
        countRes < res.length
      ) {
        await NocoCache.del(countCacheKey);
        logger.warn(
          'Invalid count query cache deleted. Query: ' + cachedCountQuery,
        );
      }

      return new PagedResponseImpl(
        res.map(({ __nc_count, ...rest }) => rest),
        {
          count: countRes,
          limit: +listArgs.limit,
          offset: +listArgs.offset,
          limitOverride: +ctx.limitOverride,
        },
        {
          stats: {
            dbQueryTime,
          },
        },
      );
    }
  }

  // load columns list
  const columns = await ctx.model.getColumns(context);

  const rootQb = knex(baseModel.getTnPath(ctx.model));

  const countQb = knex(baseModel.getTnPath(ctx.model));
  countQb.count({ count: ctx.model.primaryKey?.column_name || '*' });

  // handle shuffle if query param preset
  if (+listArgs?.shuffle) {
    await baseModel.shuffle({ qb: rootQb });
  }

  if (listArgs.pks) {
    const pks = listArgs.pks.split(',');
    rootQb.where((qb) => {
      pks.forEach((pk) => {
        qb.orWhere(_wherePk(ctx.model.primaryKeys, pk));
      });
      return qb;
    });
  }

  const aliasColObjMap = await ctx.model.getAliasColObjMap(context);
  let sorts = extractSortsObject(
    context,
    listArgs?.sort,
    aliasColObjMap,
    ctx.throwErrorIfInvalidParams,
  );
  const { filters: queryFilterObj } = extractFilterFromXwhere(
    context,
    listArgs?.where,
    aliasColObjMap,
    ctx.throwErrorIfInvalidParams,
  );

  if (!sorts?.['length'] && ctx.params.sortArr?.length) {
    sorts = ctx.params.sortArr;
  } else if (ctx.view) {
    sorts = await Sort.list(context, { viewId: ctx.view.id });
  }

  const viewFilters = ctx.view?.id
    ? await Filter.rootFilterList(context, {
        viewId: ctx.view?.id,
      })
    : [];

  if (viewFilters?.length && checkForStaticDateValFilters(viewFilters)) {
    skipCache = true;
  }

  const aggrConditionObj = [
    ...(ctx.view
      ? [
          new Filter({
            children: viewFilters,
            is_group: true,
          }),
        ]
      : []),
    ...(ctx.customConditions
      ? [
          new Filter({
            children: ctx.customConditions,
            is_group: true,
          }),
        ]
      : []),
    new Filter({
      children: ctx.params.filterArr || [],
      is_group: true,
      logical_op: 'and',
    }),
    new Filter({
      children: queryFilterObj,
      is_group: true,
      logical_op: 'and',
    }),
  ];

  if (
    await checkForCurrentUserFilters({ context, filters: aggrConditionObj })
  ) {
    skipCache = true;
  }

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  await conditionV2(baseModel, aggrConditionObj, countQb);
  const orderColumn = columns.find((c) => isOrderCol(c));

  // apply sort on root query
  if (sorts?.length) await sortV2(baseModel, sorts, rootQb);
  if (orderColumn) {
    rootQb.orderBy(orderColumn.column_name);
  }
  // sort by primary key if not autogenerated string
  // if autogenerated string sort by created_at column if present
  else if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
    rootQb.orderBy(ctx.model.primaryKey.column_name);
  } else {
    const createdAtColumn = ctx.model.columns.find(
      (c) => c.uidt === UITypes.CreatedTime && c.system,
    );
    if (createdAtColumn) {
      rootQb.orderBy(createdAtColumn.column_name);
    } /*else if (ctx.model.primaryKey) {
      rootQb.orderBy(ctx.model.primaryKey.column_name);
    }*/
  }

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
    includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
    getHiddenColumn: ctx.getHiddenColumns,
  });

  await extractColumns({
    columns,
    knex,
    qb,
    getAlias,
    params: ctx.params,
    baseModel,
    ast,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    validateFormula: ctx.validateFormula,
    alias: ROOT_ALIAS,
    apiVersion: ctx.apiVersion,
  });

  if (!ctx.ignorePagination) {
    if (ctx.limitOverride) {
      rootQb.limit(ctx.limitOverride);
      rootQb.offset(+listArgs.offset);
    } else if (skipCache) {
      rootQb.limit(+listArgs.limit);
      rootQb.offset(+listArgs.offset);
    } else {
      // provide some dummy non-zero value to limit and offset to populate bindings,
      // if offset is 0 then it will ignore bindings
      rootQb.limit(9999);
      rootQb.offset(9999);
    }
  }
  // apply the sort on final query to get the result in correct order
  if (sorts?.length) await sortV2(baseModel, sorts, qb, ROOT_ALIAS);
  if (orderColumn) {
    qb.orderBy(orderColumn.column_name);
  } else if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
    qb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
  } else {
    const createdAtColumn = ctx.model.columns.find(
      (c) => c.uidt === UITypes.CreatedTime && c.system,
    );
    if (createdAtColumn) {
      qb.orderBy(`${ROOT_ALIAS}.${createdAtColumn.column_name}`);
    }
    /*else if (ctx.model.primaryKey) {
      rootQb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
    }*/
  }

  // const finalQb = qb.select(countQb.as('__nc_count'));
  const finalQb = qb;
  let dataQuery = finalQb.toQuery();
  if (!skipCache) {
    const { sql, bindings } = finalQb.toSQL();

    // get unique placeholder for limit and offset which is not present in query
    const placeholder = getUniquePlaceholders(finalQb.toQuery());

    // bind all params and replace limit and offset with placeholders
    // and in generated sql replace placeholders with bindings
    dataQuery = knex
      .raw(sql, [...bindings.slice(0, -2), placeholder, placeholder])
      .toQuery()
      // escape any `?` in the query to avoid replacing them with bindings
      .replace(/\?/g, '\\?')
      .replace(
        `limit '${placeholder}' offset '${placeholder}'`,
        'limit ? offset ?',
      );

    // cache query for later use
    await NocoCache.set(cacheKey, dataQuery);
  }

  const [count, res] = await getDataWithCountCache({
    query: dataQuery,
    countQuery: countQb.toQuery(),
    limit: +listArgs.limit,
    offset: +listArgs.offset,
    knex,
    countCacheKey,
    skipCache,
    excludeCount,
    recordQueryTime: (time: string) => {
      dbQueryTime = time;
    },
    apiVersion: ctx.apiVersion,
    baseModel,
  });

  return new PagedResponseImpl(
    res.map(({ __nc_count, ...rest }) => rest),
    {
      // count: +res[0]?.__nc_count || 0,
      count,
      limit: +listArgs.limit,
      offset: +listArgs.offset,
      limitOverride: +ctx.limitOverride,
    },
    {
      stats: {
        dbQueryTime: dbQueryTime,
      },
    },
  );
}
const getDataWithCountCache = async (params: {
  query: string;
  countQuery: string;
  baseModel: IBaseModelSqlV2;
  apiVersion: NcApiVersion;
  limit: number;
  offset: number;
  knex: CustomKnex;
  recordQueryTime?: (queryTime: string) => void;
  excludeCount?: boolean;
  skipCache?: boolean;
  countCacheKey?: string;
}): Promise<[count: number | undefined, data: any[]]> => {
  const countHandler = async (): Promise<number | undefined> => {
    if (params.excludeCount) {
      return undefined;
    }

    if (!params.skipCache) {
      await NocoCache.set(params.countCacheKey, params.countQuery);
    }

    let resolved = false;
    return await Promise.race<number | undefined>([
      new Promise<undefined>((resolve) => {
        // if count query takes more than 3 seconds then skip it
        setTimeout(() => {
          if (resolved) return;
          resolve(undefined);
          NocoCache.set(params.countCacheKey, SKIP_COUNT_CACHE_VALUE).catch(
            (e) => {
              // ignore
              logger.error(e);
            },
          );
        }, COUNT_QUERY_TIMEOUT);
      }),
      (async (): Promise<number> => {
        const r = await params.baseModel.execAndParse(params.countQuery, null, {
          skipDateConversion: true,
          first: true,
        });
        resolved = true;
        return +r?.count || 0;
      })(),
    ]);
  };
  const dataHandler = async () => {
    if (params.skipCache) {
      const startTime = process.hrtime();
      const result = await params.baseModel.execAndParse(params.query, null, {
        skipDateConversion: true,
      });
      params?.recordQueryTime(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return result;
    } else {
      const startTime = process.hrtime();
      const res = await params.baseModel.execAndParse(
        params.knex.raw(params.query, [params.limit, params.offset]).toQuery(),
        null,
        // unsure why params.apiVersion only used when fetching from cache
        { skipDateConversion: true, apiVersion: params.apiVersion },
      );
      params?.recordQueryTime(
        parseHrtimeToMilliSeconds(process.hrtime(startTime)),
      );
      return res;
    }
  };
  return await Promise.all([countHandler(), dataHandler()]);
};
export function getSingleQueryReadFn(source: Source) {
  if (['mysql', 'mysql2'].includes(source.type)) {
    return mysqlSingleQueryRead;
  }
  return singleQueryRead;
}
