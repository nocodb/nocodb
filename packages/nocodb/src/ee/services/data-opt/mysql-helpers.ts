// eslint-disable-file no-fallthrough
import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type {
  BarcodeColumn,
  Base,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  View,
} from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Column, Filter, Model, Sort } from '~/models';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import {
  _wherePk,
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
} from '~/db/BaseModelSqlv2';
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

export function generateNestedRowSelectQuery({
  knex,
  alias,
  columns,
  isBt = false,
  title,
}: {
  knex: XKnex;
  alias: string;
  title: string;
  columns: Column[];
  isBt?: boolean;
}) {
  if (isBt) {
  }
  const paramsString = columns.map(() => `?,??.??`).join(',');
  const pramsValueArr = [
    ...columns.flatMap((c) => [c.title, alias, c.title]),
    title,
  ];

  return knex.raw(
    isBt
      ? `json_object(${paramsString}) as ??`
      : `json_arrayagg(json_object(${paramsString})) as ??`,
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
  ast: Record<string, any> | boolean;
}) {
  const extractColumnPromises = [];
  for (const column of columns) {
    if (
      // if ast is `true` then extract primary key and primary value
      !(ast === true && (column.pv || column.pk)) &&
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
        const pvColumn = relatedModel.displayValue;

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

        const sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
        const queryFilterObj = extractFilterFromXwhere(
          listArgs?.where,
          aliasColObjMap,
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

              const assocQb = knex(
                knex.raw('?? as ??', [baseModel.getTnPath(assocModel), alias1]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                mmChildColumn.column_name,
                rootAlias,
                childColumn.column_name,
              ]);

              const mmQb = knex(assocQb.as(alias4))
                .leftJoin(
                  knex.raw(`?? as ?? on ??.?? = ??.??`, [
                    baseModel.getTnPath(parentModel),
                    alias2,
                    alias2,
                    parentColumn.column_name,
                    alias4,
                    mmParentColumn.column_name,
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
                           title: column.title,
                         }),
                       )
                       .toQuery()}) as ?? ON true`,
                [alias1],
              );

              qb.select(knex.raw('??.??', [alias1, column.title]));
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
                  knex.raw('??.??', [rootAlias, childColumn.column_name]),
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
              });

              btAggQb
                .select('*')
                .where(
                  parentColumn.column_name,
                  knex.raw('??.??', [rootAlias, childColumn.column_name]),
                );
              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL
                     (${knex
                       .from(btQb.as(alias2))
                       .select(
                         knex.raw(`json_object(?,??.??, ?, ??.??) as ??`, [
                           pvColumn.title,
                           alias2,
                           pvColumn.column_name,
                           pkColumn.title,
                           alias2,
                           pkColumn.column_name,
                           column.title,
                         ]),
                       )
                       .toQuery()}) as ?? ON true`,
                [alias1],
              );
              qb.select(knex.raw('??.??', [alias1, column.title]));
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
              });

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(hmAggQb.as(alias2))
                  .select(
                    generateNestedRowSelectQuery({
                      knex,
                      alias: alias2,
                      columns: fields,
                      title: column.title,
                    }),
                  )
                  .toQuery()}) as ?? ON true`,
                [alias1],
              );
              qb.select(knex.raw('??.??', [alias1, column.title]));
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

              const assocQb = knex(
                knex.raw('?? as ??', [baseModel.getTnPath(assocModel), alias1]),
              ).whereRaw(`??.?? = ??.??`, [
                alias1,
                mmChildColumn.column_name,
                rootAlias,
                childColumn.column_name,
              ]);

              relQb = knex(assocQb.as(alias4)).leftJoin(
                knex.raw(`?? as ?? on ??.?? = ??.??`, [
                  baseModel.getTnPath(parentModel),
                  relTableAlias,
                  relTableAlias,
                  parentColumn.column_name,
                  alias4,
                  mmParentColumn.column_name,
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
                knex.raw('??.??', [rootAlias, childColumn.column_name]),
              );
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
                knex.raw('??.??', [rootAlias, parentColumn.column_name]),
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
        });

        if (!result.isArray) {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL
               (${knex
                 .from(relQb.as(alias2))
                 .select(
                   knex.raw(`??.?? as ??`, [
                     alias2,
                     lookupColumn.title,
                     column.title,
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
                knex.raw(`json_arrayagg(??) as ??`, [alias, column.title]),
              )
              .toQuery()},json_array_elements(??.??) as ?? ) as ?? ON true`,
            [alias2, lookupColumn.title, alias, lookupTableAlias],
          );
        } else {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL (${knex
              .from(relQb.as(alias2))
              .select(
                knex.raw(`json_arrayagg(??.??) as ??`, [
                  alias2,
                  lookupColumn.title,
                  column.title,
                ]),
              )
              .toQuery()}) as ?? ON true`,
            [lookupTableAlias],
          );
        }
        qb.select(knex.raw('??.??', [lookupTableAlias, column.title]));
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
        );
        qb.select(
          knex.raw(`?? as ??`, [selectQb.builder, sanitize(column.title)]),
        );
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
        ).builder.as(sanitize(column.title)),
      );
      break;
    case UITypes.Barcode:
      {
        const barcodeCol = await column.getColOptions<BarcodeColumn>();
        const barcodeValCol = await barcodeCol.getValueColumn();

        return extractColumn({
          column: new Column({ ...barcodeValCol, title: column.title }),
          qb,
          rootAlias,
          knex,
          params,
          isLookup,
          getAlias,
          baseModel,
          // dependencyFields,
          ast,
        });
      }
      break;
    case UITypes.QrCode:
      {
        const qrCol = await column.getColOptions<QrCodeColumn>();
        const qrValCol = await qrCol.getValueColumn();

        return extractColumn({
          column: new Column({ ...qrValCol, title: column.title }),
          qb,
          rootAlias,
          knex,
          params,
          isLookup,
          getAlias,
          baseModel,
          // dependencyFields,
          ast,
        });
      }
      break;

    case UITypes.Attachment:
      {
        qb.select(
          knex.raw(`CAST(??.?? as JSON) as ??`, [
            rootAlias,
            column.column_name,
            column.title,
          ]),
        );
      }
      break;
    case UITypes.DateTime:
      {
        // MySQL stores timestamp in UTC but display in timezone
        // To verify the timezone, run `SELECT @@global.time_zone, @@session.time_zone;`
        // If it's SYSTEM, then the timezone is read from the configuration file
        // if a timezone is set in a DB, the retrieved value would be converted to the corresponding timezone
        // for example, let's say the global timezone is +08:00 in DB
        // the value 2023-01-01 10:00:00 (UTC) would display as 2023-01-01 18:00:00 (UTC+8)
        // our existing logic is based on UTC, during the query, we need to take the UTC value
        // hence, we use CONVERT_TZ to convert back to UTC value
        qb.select(
          knex.raw(
            `DATE_FORMAT(CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00'), '%Y-%m-%d %H:%i:%s+00:00') as ??`,
            [
              `${sanitize(rootAlias)}.${column.column_name}`,
              sanitize(column.title),
            ],
          ),
        );
      }
      break;

    default:
      {
        if (column.dt === 'bytea') {
          qb.select(
            knex.raw(
              `encode(??.??, '${
                column.meta?.format === 'hex' ? 'hex' : 'escape'
              }') as ??`,
              [rootAlias, column.column_name, column.title],
            ),
          );
        } else {
          qb.select(
            knex.raw(`??.?? as ??`, [
              rootAlias,
              column.column_name,
              column.title,
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
  base: Base;
  params;
  id: string;
  getHiddenColumn?: boolean;
}): Promise<PagedResponseImpl<Record<string, any>>> {
  await ctx.model.getColumns();

  if (!['mysql', 'mysql2'].includes(ctx.base.type)) {
    throw new Error('Base is not mysql');
  }

  let skipCache = process.env.NC_DISABLE_CACHE === 'true';

  // skip using cached query if  filterArr is present since it will be different query
  if (
    'filterArr' in ctx.params ||
    'filter' in ctx.params ||
    'where' in ctx.params ||
    'fields' in ctx.params ||
    'f' in ctx.params ||
    'nested' in ctx.params
  ) {
    skipCache = true;
  }

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.base);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:read`;

  const baseModel = await Model.getBaseModelSQL({
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    if (cachedQuery) {
      const rawRes = await knex.raw(
        cachedQuery,
        ctx.model.primaryKeys.length === 1 ? [ctx.id] : ctx.id.split('___'),
      );

      const res = rawRes?.[0]?.[0];

      // update attachment fields
      // res = baseModel.convertAttachmentType(res, ctx.model);
      //
      // update date time fields
      // res = baseModel.convertDateFormat(res, ctx.model);

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
  });

  await extractColumns({
    columns,
    knex,
    qb,
    getAlias,
    params: ctx.params,
    baseModel,
    ast,
  });

  // const dataAlias = getAlias();

  const finalQb = qb.first();

  const { sql, bindings } = finalQb.toSQL();

  // get unique placeholder which is not present in the query
  const idPlaceholder = getUniquePlaceholders(sql);

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

  const rawRes = await knex.raw(
    query,
    ctx.model.primaryKeys.length === 1 ? [ctx.id] : ctx.id.split('___'),
  );

  const res = rawRes?.[0]?.[0];

  // update attachment fields
  // res = baseModel.convertAttachmentType(res, ctx.model);

  // update date time fields
  // res = baseModel.convertDateFormat(res, ctx.model);

  return res;
}

export async function singleQueryList(ctx: {
  model: Model;
  view: View;
  base: Base;
  params;
}): Promise<PagedResponseImpl<Record<string, any>>> {
  if (!['mysql', 'mysql2'].includes(ctx.base.type)) {
    throw new Error('Base is not mysql');
  }

  let skipCache = process.env.NC_DISABLE_CACHE === 'true';

  // skip using cached query if sortArr or filterArr is present since it will be different query
  if (
    'sortArr' in ctx.params ||
    'filterArr' in ctx.params ||
    'sort' in ctx.params ||
    'filter' in ctx.params ||
    'where' in ctx.params ||
    'w' in ctx.params ||
    'fields' in ctx.params ||
    'f' in ctx.params ||
    'nested' in ctx.params
  ) {
    skipCache = true;
  }

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.base);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;

  await ctx.model.getColumns();
  let dbQueryTime;

  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    if (cachedQuery) {
      const startTime = process.hrtime();
      const rawRes = await knex.raw(cachedQuery, [
        +listArgs.limit,
        +listArgs.offset,
      ]);
      dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));

      const res = rawRes[0];

      // update attachment fields
      // res = baseModel.convertAttachmentType(res, ctx.model);

      // update date time fields
      // res = baseModel.convertDateFormat(res, ctx.model);

      return new PagedResponseImpl(
        res.map(({ __nc_count, ...rest }) => rest),
        {
          count: +res[0]?.__nc_count || 0,
          limit: +listArgs.limit,
          offset: +listArgs.offset,
        },
        {
          stats: {
            dbQueryTime,
          },
        },
      );
    }
  }

  const baseModel = await Model.getBaseModelSQL({
    model: ctx.model,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });
  // load columns list
  const columns = await ctx.model.getColumns();

  const rootQb = knex(baseModel.getTnPath(ctx.model));

  const countQb = knex(baseModel.getTnPath(ctx.model));
  countQb.count({ count: ctx.model.primaryKey?.column_name || '*' });

  const aliasColObjMap = await ctx.model.getAliasColObjMap();
  let sorts = extractSortsObject(listArgs?.sort, aliasColObjMap);
  const queryFilterObj = extractFilterFromXwhere(
    listArgs?.where,
    aliasColObjMap,
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
  } else if (ctx.model.columns.find((c) => c.column_name === 'created_at')) {
    rootQb.orderBy('created_at');
  }

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst({
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
  });

  await extractColumns({
    columns,
    knex,
    qb,
    getAlias,
    params: ctx.params,
    baseModel,
    ast,
  });

  if (skipCache) {
    rootQb.limit(+listArgs.limit);
    rootQb.offset(+listArgs.offset);
  } else {
    // provide some dummy non-zero value to limit and offset to populate bindings,
    // if offset is 0 then it will ignore bindings
    rootQb.limit(9999);
    rootQb.offset(9999);
  }

  // apply the sort on final query to get the result in correct order
  if (sorts?.length) await sortV2(baseModel, sorts, qb, ROOT_ALIAS);
  else if (ctx.model.primaryKey && ctx.model.primaryKey.ai) {
    qb.orderBy(`${ROOT_ALIAS}.${ctx.model.primaryKey.column_name}`);
  } else if (ctx.model.columns.find((c) => c.column_name === 'created_at')) {
    qb.orderBy(`${ROOT_ALIAS}.created_at`);
  }

  const finalQb = qb.select(countQb.as('__nc_count'));

  let res: any;
  if (skipCache) {
    const startTime = process.hrtime();
    res = await finalQb;
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

    // cache query for later use
    await NocoCache.set(cacheKey, query);

    const startTime = process.hrtime();
    // run the query with actual limit and offset
    res = (await knex.raw(query, [+listArgs.limit, +listArgs.offset]))[0];
    dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
  }

  // update attachment fields
  // res = baseModel.convertAttachmentType(res, ctx.model);

  // update date time fields
  // res = baseModel.convertDateFormat(res, ctx.model);

  return new PagedResponseImpl(
    res.map(({ __nc_count, ...rest }) => rest),
    {
      count: +res[0]?.__nc_count || 0,
      limit: +listArgs.limit,
      offset: +listArgs.offset,
    },
    {
      stats: {
        dbQueryTime,
      },
    },
  );
}
