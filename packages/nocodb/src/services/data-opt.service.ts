import { Injectable } from '@nestjs/common';
import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type {
  BarcodeColumn,
  Base,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Column, Filter, Model, Sort, View } from '~/models';
import { getAliasGenerator, ROOT_ALIAS } from '~/utils';
import {
  extractFilterFromXwhere,
  extractSortsObject,
  getListArgs,
} from '~/db/BaseModelSqlv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import { sanitize } from '~/helpers/sqlSanitize';
import genRollupSelectv2 from '~/db/genRollupSelectv2';

@Injectable()
export class DataOptService {
  async populateSingleQuery(ctx: {
    model: Model;
    view: View;
    base: Base;
    params;
    paramsHash: string;
  }): Promise<{ count?: number | string; data: any[] }> {
    // if (queryMap[ctx.view.id]) return await queryMap[ctx.view.id];

    if (ctx.base.type !== 'pg') {
      throw new Error('Single query only supported in postgres');
    }

    // const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${ctx.view.id}:${ctx.paramsHash}`;

    const cachedQuery = null; // await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);

    const baseModel = await Model.getBaseModelSQL({
      id: ctx.model.id,
      viewId: ctx.view?.id,
      dbDriver: await NcConnectionMgrv2.get(ctx.base),
    });

    // get knex connection
    const knex = await NcConnectionMgrv2.get(ctx.base);

    const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

    // todo: exclude nested offset and limit from cache key
    if (cachedQuery) {
      const res = await knex.raw(cachedQuery, [
        +listArgs.limit,
        +listArgs.offset,
        1,
      ]);
      return res.rows[0];
    }

    const getAlias = getAliasGenerator();

    // load columns list
    const columns = await ctx.model.getColumns();

    const rootQb = knex(ctx.model.table_name);

    const countQb = knex(ctx.model.table_name);
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
      new Filter({
        children:
          (await Filter.rootFilterList({
            viewId: ctx.view.id,
          })) || [],
        is_group: true,
      }),
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
    if (sorts) await sortV2(baseModel, sorts, rootQb);

    const qb = knex.from(rootQb.as(ROOT_ALIAS));

    let allowedCols = null;

    const tableColumns = await ctx.model.getColumns();

    if (ctx.view)
      allowedCols = (await View.getColumns(ctx.view.id)).reduce(
        (o, c) => ({
          ...o,
          [c.fk_column_id]:
            c.show &&
            !tableColumns.find((tc) => tc.id === c.fk_column_id)?.system,
        }),
        {},
      );
    await this.extractColumns({
      columns,
      allowedCols,
      knex,
      qb,
      getAlias,
      params: ctx.params,
      baseModel,
    });

    rootQb.limit(+listArgs.limit,);
    rootQb.offset(+listArgs.offset);

    const dataAlias = getAlias();

    const finalQb = knex
      .from(qb.as(dataAlias))
      .select(
        knex.raw(`coalesce(json_agg(??.*),'[]'::json) as ??`, [
          dataAlias,
          'data',
        ]),
      )
      .select(countQb.as('count'))
      .first();

    // const { sql } = finalQb.toSQL();

    // await NocoCache.set(cacheKey, sql);

    const res = await finalQb //knex.raw(sql, [+listArgs.limit, +listArgs.offset, 1]);

    return res//.rows[0];
  }

  generateNestedRowSelectQuery({
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
        ? `json_build_object(${paramsString}) as ??`
        : `coalesce(json_agg(jsonb_build_object(${paramsString})),'[]'::json) as ??`,
      pramsValueArr,
    );
  }

  async extractColumns({
    columns,
    allowedCols,
    knex,
    qb,
    getAlias,
    params,
    alias = ROOT_ALIAS,
    baseModel,
  }: {
    columns: Column[];
    allowedCols?: Record<string, boolean>;
    knex: XKnex;
    qb;
    getAlias: () => string;
    params: any;
    alias?: string;
    baseModel: BaseModelSqlv2;
  }) {
    for (const column of columns) {
      if (allowedCols && !allowedCols[column.id]) continue;
      await this.extractColumn({
        column,
        knex,
        rootAlias: alias,
        qb,
        getAlias,
        params: params?.nested?.[column.title],
        baseModel,
      });
    }
  }

  async extractColumn({
    column,
    qb,
    rootAlias,
    knex,
    params,
    // @ts-ignore
    isLookup,
    getAlias,
    baseModel,
  }: {
    column: Column;
    qb: Knex.QueryBuilder;
    rootAlias: string;
    knex: XKnex;
    isLookup?: boolean;
    params?: any;
    getAlias: () => string;
    baseModel: BaseModelSqlv2;
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
          const pvColumn = relatedModel.primaryValue;

          // extract nested query params

          const listArgs = getListArgs(params ?? {}, relatedModel, {
            ignoreAssigningWildcardSelect: true,
          });

          const aliasColObjMap = await relatedModel.getAliasColObjMap();

          // todo: check if fields are allowed
          let fields = [pkColumn, pvColumn];

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
                const mmChildColumn =
                  await column.colOptions.getMMChildColumn();
                const mmParentColumn =
                  await column.colOptions.getMMParentColumn();
                const assocModel = await column.colOptions.getMMModel();
                const childColumn = await column.colOptions.getChildColumn();
                const parentColumn = await column.colOptions.getParentColumn();

                const assocQb = knex(
                  knex.raw('?? as ??', [assocModel.table_name, alias1]),
                ).whereRaw(`??.?? = ??.??`, [
                  alias1,
                  mmChildColumn.column_name,
                  rootAlias,
                  childColumn.column_name,
                ]);

                const mmQb = knex(assocQb.as(alias4))
                  .leftJoin(
                    knex.raw(`?? as ?? on ??.?? = ??.??`, [
                      parentModel.table_name,
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
                await this.extractColumns({
                  columns: fields,
                  knex,
                  qb: mmAggQb,
                  params,
                  getAlias,
                  alias: alias5,
                  baseModel,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL
                     (${knex
                       .from(mmAggQb.as(alias3))
                       .select(
                         this.generateNestedRowSelectQuery({
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
                const btQb = knex(parentModel.table_name)
                  .select('*')
                  .where(
                    parentColumn.column_name,
                    knex.raw('??.??', [rootAlias, childColumn.column_name]),
                  );

                // apply filters on nested query
                await conditionV2(baseModel, queryFilterObj, btQb);

                const btAggQb = knex(btQb.as(alias3));
                await this.extractColumns({
                  columns: fields,
                  knex,
                  qb: btAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(btAggQb.as(alias2))
                    .select(
                      this.generateNestedRowSelectQuery({
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
            case RelationTypes.HAS_MANY:
              {
                result.isArray = true;
                const alias1 = getAlias();
                const alias2 = getAlias();
                const alias3 = getAlias();

                const childModel = await column.colOptions.getRelatedTable();
                const childColumn = await column.colOptions.getChildColumn();
                const parentColumn = await column.colOptions.getParentColumn();

                const hmQb = knex(childModel.table_name)
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
                await this.extractColumns({
                  columns: fields,
                  knex,
                  qb: hmAggQb,
                  params,
                  getAlias,
                  alias: alias3,
                  baseModel,
                });

                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL (${knex
                    .from(hmAggQb.as(alias2))
                    .select(
                      this.generateNestedRowSelectQuery({
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
                const mmParentColumn =
                  await relationColOpts.getMMParentColumn();
                const assocModel = await relationColOpts.getMMModel();
                const childColumn = await relationColOpts.getChildColumn();
                const parentColumn = await relationColOpts.getParentColumn();

                const assocQb = knex(
                  knex.raw('?? as ??', [assocModel.table_name, alias1]),
                ).whereRaw(`??.?? = ??.??`, [
                  alias1,
                  mmChildColumn.column_name,
                  rootAlias,
                  childColumn.column_name,
                ]);

                relQb = knex(assocQb.as(alias4)).leftJoin(
                  knex.raw(`?? as ?? on ??.?? = ??.??`, [
                    parentModel.table_name,
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
                  knex.raw('?? as ??', [parentModel.table_name, relTableAlias]),
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
                  knex.raw('?? as ??', [childModel.table_name, relTableAlias]),
                ).where(
                  childColumn.column_name,
                  knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                );
              }

              break;
          }

          const { isArray } = await this.extractColumn({
            qb: relQb,
            rootAlias: relTableAlias,
            knex,
            getAlias,
            column: lookupColumn,
            baseModel,
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
                  knex.raw(`coalesce(json_agg(??),'[]'::json) as ??`, [
                    alias,
                    column.title,
                  ]),
                )
                .toQuery()},json_array_elements(??.??) as ?? ) as ?? ON true`,
              [alias2, lookupColumn.title, alias, lookupTableAlias],
            );
          } else {
            qb.joinRaw(
              `LEFT OUTER JOIN LATERAL (${knex
                .from(relQb.as(alias2))
                .select(
                  knex.raw(`coalesce(json_agg(??.??),'[]'::json) as ??`, [
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

          return this.extractColumn({
            column: new Column({ ...barcodeValCol, title: column.title }),
            qb,
            rootAlias,
            knex,
            params,
            isLookup,
            getAlias,
            baseModel,
          });
        }
        break;
      case UITypes.QrCode:
        {
          const qrCol = await column.getColOptions<QrCodeColumn>();
          const qrValCol = await qrCol.getValueColumn();

          return this.extractColumn({
            column: new Column({ ...qrValCol, title: column.title }),
            qb,
            rootAlias,
            knex,
            params,
            isLookup,
            getAlias,
            baseModel,
          });
        }
        break;

      default:
        {
          qb.select(
            knex.raw(`??.?? as ??`, [
              rootAlias,
              column.column_name,
              column.title,
            ]),
          );
        }
        break;
    }
    return result;
  }
}
