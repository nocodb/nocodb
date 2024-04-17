// eslint-disable-file no-fallthrough
import { NcDataErrorCodes, RelationTypes, UITypes } from 'nocodb-sdk';
import { shouldSkipCache } from './common-helpers';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type {
  BarcodeColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  Source,
  View,
} from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { Column, Filter, Model, Sort } from '~/models';
import {
  _wherePk,
  extractFilterFromXwhere,
  extractSortsObject,
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
}) {
  const result = { isArray: false };
  // todo: check system field enabled / not
  //      filter on nested list
  //      sort on nested list

  // if (isSystemColumn(column)) return result;
  // const model = await column.getModel();
  switch (column.uidt) {
    case UITypes.LinkToAnotherRecord:
      {
        const relatedModel = await column.colOptions.getRelatedTable();
        await relatedModel.getColumns();
        // @ts-ignore
        const pkColumn = relatedModel.primaryKey;
        // if mm table then only extract primary keys
        const pvColumn = relatedModel.mm
          ? relatedModel.primaryKeys[1]
          : relatedModel.displayValue;

        // extract nested query params

        const listArgs = getListArgs(params ?? {}, relatedModel, {
          ignoreAssigningWildcardSelect: true,
        });

        const aliasColObjMap = await relatedModel.getAliasColObjMap();

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
          listArgs?.sort,
          aliasColObjMap,
          throwErrorIfInvalidParams,
        );
        const queryFilterObj = extractFilterFromXwhere(
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

              const parentModel = await column.colOptions.getRelatedTable();
              const mmChildColumn = await column.colOptions.getMMChildColumn();
              const mmParentColumn =
                await column.colOptions.getMMParentColumn();
              const assocModel = await column.colOptions.getMMModel();
              const childColumn = await column.colOptions.getChildColumn();
              const parentColumn = await column.colOptions.getParentColumn();

              // if mm table is not present then return
              if (!assocModel) {
                return qb.select(
                  knex.raw('? as ??', [
                    NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                    sanitize(column.id),
                  ]),
                );
              }

              const assocQb = knex(
                knex.raw('?? as ??', [baseModel.getTnPath(assocModel), alias1]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

              const mmQb = knex(assocQb.as(alias4))
                .leftJoin(
                  knex.raw(`?? as ?? on ??.?? = ??.??`, [
                    baseModel.getTnPath(parentModel),
                    alias2,
                    alias2,
                    sanitize(parentColumn.column_name),
                    alias4,
                    sanitize(mmParentColumn.column_name),
                  ]),
                )
                .select(knex.raw('??.*', [alias2]))
                .limit(+listArgs.limit)
                .offset(+listArgs.offset);

              // apply filters on nested query
              await conditionV2(baseModel, queryFilterObj, mmQb, alias2);

              // apply sorts on nested query
              if (sorts) await sortV2(baseModel, sorts, mmQb, alias2);

              const mmAggQb = knex(mmQb.as(alias5));
              await extractColumns({
                columns: fields,
                knex,
                qb: mmAggQb,
                params,
                getAlias,
                alias: alias5,
                baseModel,
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
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
                           title: sanitize(column.id),
                         }),
                       )
                       .toQuery()}) as ?? ON true`,
                [alias1],
              );

              qb.select(knex.raw('??.??', [alias1, column.id]));
            }
            break;
          case RelationTypes.BELONGS_TO:
            {
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const parentModel = await column.colOptions.getRelatedTable();
              const childColumn = await column.colOptions.getChildColumn();
              const parentColumn = await column.colOptions.getParentColumn();
              const btQb = knex(baseModel.getTnPath(parentModel))
                .select('*')
                .where(
                  parentColumn.column_name,
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(childColumn.column_name),
                  ]),
                );

              // apply filters on nested query
              await conditionV2(baseModel, queryFilterObj, btQb);

              const btAggQb = knex(btQb.as(alias3));
              await extractColumns({
                columns: fields,
                knex,
                qb: btAggQb,
                params,
                getAlias,
                alias: alias3,
                baseModel,
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(btAggQb.as(alias2))
                  .select(
                    generateNestedRowSelectQuery({
                      knex,
                      alias: alias2,
                      columns: fields,
                      title: column.id,
                      isBtOrOo: true,
                    }),
                  )
                  .toQuery()}) as ?? ON true`,
                [alias1],
              );

              qb.select(knex.raw('??.??', [alias1, column.id]));
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = column.meta?.bt;

              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const parentModel = await column.colOptions.getRelatedTable();
              const childColumn = await column.colOptions.getChildColumn();
              const parentColumn = await column.colOptions.getParentColumn();

              if (isBt) {
                const btQb = knex(baseModel.getTnPath(parentModel))
                  .select('*')
                  .where(
                    parentColumn.column_name,
                    knex.raw('??.??', [
                      rootAlias,
                      sanitize(childColumn.column_name),
                    ]),
                  );

                // apply filters on nested query
                await conditionV2(baseModel, queryFilterObj, btQb);

                const btAggQb = knex(btQb.as(alias3));
                await extractColumns({
                  columns: fields,
                  knex,
                  qb: btAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel,
                  // dependencyFields,
                  ast,
                  throwErrorIfInvalidParams,
                  validateFormula,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(btAggQb.as(alias2))
                    .select(
                      generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: column.id,
                        isBtOrOo: true,
                      }),
                    )
                    .toQuery()}) as ?? ON true`,
                  [alias1],
                );

                qb.select(knex.raw('??.??', [alias1, column.id]));
              } else {
                const hmQb = knex(baseModel.getTnPath(parentModel))
                  .select('*')
                  .where(
                    childColumn.column_name,
                    knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                  )
                  .first();

                // apply filters on nested query
                await conditionV2(baseModel, queryFilterObj, hmQb);

                // apply sorts on nested query
                if (sorts) await sortV2(baseModel, sorts, hmQb);

                const hmAggQb = knex(hmQb.as(alias3));
                await extractColumns({
                  columns: fields,
                  knex,
                  qb: hmAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel,
                  // dependencyFields,
                  ast,
                  throwErrorIfInvalidParams,
                  validateFormula,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(hmAggQb.as(alias2))
                    .select(
                      generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: column.id,
                        isBtOrOo: true,
                      }),
                    )
                    .toQuery()}) as ?? ON true`,
                  [alias1],
                );
                qb.select(knex.raw('??.??', [alias1, column.id]));
              }
            }
            break;
          case RelationTypes.HAS_MANY:
            {
              result.isArray = true;
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const childModel = await column.colOptions.getRelatedTable();
              const childColumn = await column.colOptions.getChildColumn();
              const parentColumn = await column.colOptions.getParentColumn();

              const hmQb = knex(baseModel.getTnPath(childModel))
                .select('*')
                .where(
                  childColumn.column_name,
                  knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                )

                .limit(+listArgs.limit)
                .offset(+listArgs.offset);

              // apply filters on nested query
              await conditionV2(baseModel, queryFilterObj, hmQb);

              // apply sorts on nested query
              if (sorts) await sortV2(baseModel, sorts, hmQb);

              const hmAggQb = knex(hmQb.as(alias3));
              await extractColumns({
                columns: fields,
                knex,
                qb: hmAggQb,
                params,
                getAlias,
                alias: alias3,
                baseModel,
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(hmAggQb.as(alias2))
                  .select(
                    generateNestedRowSelectQuery({
                      knex,
                      alias: alias2,
                      columns: fields,
                      title: column.id,
                    }),
                  )
                  .toQuery()}) as ?? ON true`,
                [alias1],
              );
              qb.select(knex.raw('??.??', [alias1, column.id]));
            }
            break;
        }
      }
      break;
    case UITypes.Lookup:
      {
        const alias2 = getAlias();
        const lookupTableAlias = getAlias();

        const lookupColOpt = await column.getColOptions<LookupColumn>();
        const lookupColumn = await lookupColOpt.getLookupColumn();

        const relationColumn = await lookupColOpt.getRelationColumn();
        const relationColOpts =
          await relationColumn.getColOptions<LinkToAnotherRecordColumn>();
        let relQb;
        const relTableAlias = getAlias();

        switch (relationColOpts.type) {
          case RelationTypes.MANY_TO_MANY:
            {
              result.isArray = true;

              const alias1 = getAlias();
              const alias4 = getAlias();

              const parentModel = await relationColOpts.getRelatedTable();
              const mmChildColumn = await relationColOpts.getMMChildColumn();
              const mmParentColumn = await relationColOpts.getMMParentColumn();
              const assocModel = await relationColOpts.getMMModel();
              const childColumn = await relationColOpts.getChildColumn();
              const parentColumn = await relationColOpts.getParentColumn();

              // if mm table is not present then return
              if (!assocModel) {
                return qb.select(
                  knex.raw('? as ??', [
                    NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                    sanitize(column.id),
                  ]),
                );
              }

              const assocQb = knex(
                knex.raw('?? as ??', [baseModel.getTnPath(assocModel), alias1]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

              relQb = knex(assocQb.as(alias4)).leftJoin(
                knex.raw(`?? as ?? on ??.?? = ??.??`, [
                  baseModel.getTnPath(parentModel),
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
              // if (aliasC) break
              // const alias2 = getAlias();

              const parentModel = await relationColOpts.getRelatedTable();
              const childColumn = await relationColOpts.getChildColumn();
              const parentColumn = await relationColOpts.getParentColumn();
              relQb = knex(
                knex.raw('?? as ??', [
                  baseModel.getTnPath(parentModel),
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
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const isBt = relationColumn.meta?.bt;
              if (isBt) {
                const parentModel = await relationColOpts.getRelatedTable();
                const childColumn = await relationColOpts.getChildColumn();
                const parentColumn = await relationColOpts.getParentColumn();
                relQb = knex(
                  knex.raw('?? as ??', [
                    baseModel.getTnPath(parentModel),
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
                const childModel = await relationColOpts.getRelatedTable();
                const childColumn = await relationColOpts.getChildColumn();
                const parentColumn = await relationColOpts.getParentColumn();
                relQb = knex(
                  knex.raw('?? as ??', [
                    baseModel.getTnPath(childModel),
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
              const childModel = await relationColOpts.getRelatedTable();
              const childColumn = await relationColOpts.getChildColumn();
              const parentColumn = await relationColOpts.getParentColumn();
              relQb = knex(
                knex.raw('?? as ??', [
                  baseModel.getTnPath(childModel),
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

            break;
        }

        const { isArray } = await extractColumn({
          qb: relQb,
          rootAlias: relTableAlias,
          knex,
          getAlias,
          column: lookupColumn,
          baseModel,
          // dependencyFields,
          ast,
          throwErrorIfInvalidParams,
          validateFormula,
        });

        if (!result.isArray) {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL
               (${knex
                 .from(relQb.as(alias2))
                 .select(
                   knex.raw(`??.?? as ??`, [
                     alias2,
                     lookupColumn.id,
                     column.id,
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
                  column.id,
                ]),
              )
              .toQuery()},json_array_elements(??.??) as ?? ) as ?? ON true`,
            [alias2, lookupColumn.id, alias, lookupTableAlias],
          );
        } else {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL (${knex
              .from(relQb.as(alias2))
              .select(
                knex.raw(`coalesce(json_agg(??.??),'[]'::json) as ??`, [
                  alias2,
                  lookupColumn.id,
                  column.id,
                ]),
              )
              .toQuery()}) as ?? ON true`,
            [lookupTableAlias],
          );
        }
        qb.select(knex.raw('??.??', [lookupTableAlias, column.id]));
      }
      break;
    case UITypes.Formula:
      {
        const model: Model = await column.getModel();
        const formula = await column.getColOptions<FormulaColumn>();
        if (formula.error) return result;
        const selectQb = await formulaQueryBuilderv2(
          baseModel,
          formula.formula,
          null,
          model,
          column,
          {},
          rootAlias,
          validateFormula,
        );
        qb.select(knex.raw(`?? as ??`, [selectQb.builder, column.id]));
      }
      break;
    case UITypes.Rollup:
    case UITypes.Links:
      qb.select(
        (
          await genRollupSelectv2({
            baseModelSqlv2: baseModel,
            knex,
            columnOptions: await column.getColOptions(),
            alias: rootAlias,
          })
        ).builder.as(sanitize(column.id)),
      );
      break;
    case UITypes.Barcode:
      {
        const barcodeCol = await column.getColOptions<BarcodeColumn>();
        const barcodeValCol = await barcodeCol.getValueColumn();

        return extractColumn({
          column: new Column({
            ...barcodeValCol,
            title: column.title,
            id: column.id,
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
        });
      }
      break;
    case UITypes.QrCode:
      {
        const qrCol = await column.getColOptions<QrCodeColumn>();
        const qrValCol = await qrCol.getValueColumn();

        return extractColumn({
          column: new Column({
            ...qrValCol,
            title: column.title,
            id: column.id,
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
        });
      }
      break;

    case UITypes.Attachment:
      {
        qb.select(
          knex.raw(`to_json(??.??) as ??`, [
            rootAlias,
            sanitize(column.column_name),
            column.id,
          ]),
        );
      }
      break;
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
    case UITypes.DateTime: {
      const columnName = await getColumnName(column, columns);

      // if there is no timezone info,
      // convert to database timezone,
      // then convert to UTC
      if (
        column.dt !== 'timestamp with time zone' &&
        column.dt !== 'timestamptz'
      ) {
        qb.select(
          knex.raw(
            `??.?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC' as ??`,
            [rootAlias, sanitize(columnName), column.id],
          ),
        );
      } else {
        qb.select(
          knex.raw(`??.?? as ??`, [
            rootAlias,
            sanitize(column.column_name),
            column.id,
          ]),
        );
      }
      break;
    }
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      const columnName = await getColumnName(column, columns);

      qb.select(
        knex.raw(`??.?? as ??`, [rootAlias, sanitize(columnName), column.id]),
      );
      break;
    }
    default:
      {
        if (column.dt === 'bytea') {
          qb.select(
            knex.raw(
              `encode(??.??, '${
                column.meta?.format === 'hex' ? 'hex' : 'escape'
              }') as ??`,
              [rootAlias, sanitize(column.column_name), column.id],
            ),
          );
        } else {
          qb.select(
            knex.raw(`??.?? as ??`, [
              rootAlias,
              sanitize(column.column_name),
              column.id,
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

export async function singleQueryRead(ctx: {
  model: Model;
  view: View;
  source: Source;
  params;
  id: string;
  getHiddenColumn?: boolean;
  throwErrorIfInvalidParams?: boolean;
  validateFormula?: boolean;
}): Promise<PagedResponseImpl<Record<string, any>>> {
  await ctx.model.getColumns();

  if (ctx.source.type !== 'pg') {
    throw new Error('Single query only supported in postgres');
  }

  const skipCache = shouldSkipCache(ctx, false);

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const baseModel = await Model.getBaseModelSQL({
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
            ctx.model.primaryKeys.length === 1 ? [ctx.id] : ctx.id.split('___'),
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
  const columns = await ctx.model.getColumns();

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

  const aliasColObjMap = await ctx.model.getAliasColObjMap();
  // let sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
  const queryFilterObj = extractFilterFromXwhere(
    listArgs?.where,
    aliasColObjMap,
  );

  const aggrConditionObj = [
    ...(ctx.view?.id
      ? [
          new Filter({
            children:
              (await Filter.rootFilterList({
                viewId: ctx.view.id,
              })) || [],
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

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  // await conditionV2(baseModel, aggrConditionObj, countQb);

  // apply sort on root query
  // if (sorts) await sortV2(baseModel, sorts, rootQb);

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst({
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    getHiddenColumn: ctx.getHiddenColumn,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
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
        ctx.model.primaryKeys.length === 1 ? [ctx.id] : ctx.id.split('___'),
      )
      .toQuery(),
    null,
    { skipDateConversion: true, first: true },
  );

  return res;
}

export async function singleQueryList(ctx: {
  model: Model;
  view: View;
  source: Source;
  params;
  throwErrorIfInvalidParams?: boolean;
  validateFormula?: boolean;
  ignorePagination?: boolean;
  limitOverride?: number;
}): Promise<PagedResponseImpl<Record<string, any>>> {
  const excludeCount = ctx.params?.excludeCount;

  if (ctx.source.type !== 'pg') {
    throw new Error('Source is not postgres');
  }

  let dbQueryTime;
  const skipCache = shouldSkipCache(ctx);

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const baseModel = await Model.getBaseModelSQL({
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;
  const countCacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries:count`;

  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    const cachedCountQuery = await NocoCache.get(
      countCacheKey,
      CacheGetType.TYPE_STRING,
    );
    if (cachedQuery && cachedCountQuery) {
      let res, countRes;
      await Promise.all([
        new Promise((resolve, reject) => {
          if (excludeCount) {
            return resolve(null);
          }

          let resolved = false;

          // if count query takes more than 3 seconds then skip it
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            resolve(null);
          }, 3000);

          baseModel
            .execAndParse(knex.raw(cachedCountQuery).toQuery(), null, {
              skipDateConversion: true,
            })
            .then(
              (count) => {
                if (resolved) return;
                resolved = true;
                countRes = +count?.[0]?.count || 0;
                resolve(null);
              },
              (err) => {
                if (resolved) return;
                resolved = true;
                reject(err);
              },
            );
        }),
        (async () => {
          const startTime = process.hrtime();
          res = await baseModel.execAndParse(
            knex
              .raw(cachedQuery, [+listArgs.limit, +listArgs.offset])
              .toQuery(),
            null,
            { skipDateConversion: true },
          );
          dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
        })(),
      ]);
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
  const columns = await ctx.model.getColumns();

  const rootQb = knex(baseModel.getTnPath(ctx.model));

  const countQb = knex(baseModel.getTnPath(ctx.model));
  countQb.count({ count: ctx.model.primaryKey?.column_name || '*' });

  // handle shuffle if query param preset
  if (+listArgs?.shuffle) {
    await baseModel.shuffle({ qb: rootQb });
  }

  const aliasColObjMap = await ctx.model.getAliasColObjMap();
  let sorts = extractSortsObject(
    listArgs?.sort,
    aliasColObjMap,
    ctx.throwErrorIfInvalidParams,
  );
  const queryFilterObj = extractFilterFromXwhere(
    listArgs?.where,
    aliasColObjMap,
    ctx.throwErrorIfInvalidParams,
  );

  if (!sorts?.['length'] && ctx.params.sortArr?.length) {
    sorts = ctx.params.sortArr;
  } else if (ctx.view) {
    sorts = await Sort.list({ viewId: ctx.view.id });
  }

  const aggrConditionObj = [
    ...(ctx.view
      ? [
          new Filter({
            children:
              (await Filter.rootFilterList({
                viewId: ctx.view.id,
              })) || [],
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

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  await conditionV2(baseModel, aggrConditionObj, countQb);

  // apply sort on root query
  if (sorts?.length) await sortV2(baseModel, sorts, rootQb);
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

  const { ast } = await getAst({
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
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
  else if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
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
  let res: any;
  let count: number;
  await Promise.all([
    new Promise((resolve, reject) => {
      if (excludeCount) {
        return resolve(null);
      }

      let resolved = false;

      // if count query takes more than 3 seconds then skip it
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        resolve(null);
      }, 3000);
      baseModel
        .execAndParse(countQb.toQuery(), null, {
          skipDateConversion: true,
          first: true,
        })
        .then(
          (r) => {
            resolved = true;
            count = +r?.count || 0;
            resolve(null);
          },
          (e) => {
            resolved = true;
            reject(e);
          },
        );
    }),
    (async () => {
      if (skipCache) {
        const startTime = process.hrtime();
        res = await baseModel.execAndParse(finalQb, null, {
          skipDateConversion: true,
        });
        dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
      } else {
        const { sql, bindings } = finalQb.toSQL();

        // get unique placeholder for limit and offset which is not present in query
        const placeholder = getUniquePlaceholders(finalQb.toQuery());

        // bind all params and replace limit and offset with placeholders
        // and in generated sql replace placeholders with bindings
        const query = knex
          .raw(sql, [...bindings.slice(0, -2), placeholder, placeholder])
          .toQuery()
          // escape any `?` in the query to avoid replacing them with bindings
          .replace(/\?/g, '\\?')
          .replace(
            `limit '${placeholder}' offset '${placeholder}'`,
            'limit ? offset ?',
          );

        const countQuery = countQb.toQuery();

        // cache query for later use
        await NocoCache.set(cacheKey, query);
        await NocoCache.set(countCacheKey, countQuery);

        const startTime = process.hrtime();

        // run the query with actual limit and offset
        res = await baseModel.execAndParse(
          knex.raw(query, [+listArgs.limit, +listArgs.offset]).toQuery(),
          null,
          { skipDateConversion: true },
        );
        dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
      }
    })(),
  ]);

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

export function getSingleQueryReadFn(source: Source) {
  if (['mysql', 'mysql2'].includes(source.type)) {
    return mysqlSingleQueryRead;
  }
  return singleQueryRead;
}
