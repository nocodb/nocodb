import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type {
  BarcodeColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
  QrCodeColumn,
} from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import { Column } from '~/models';
import { ROOT_ALIAS } from '~/utils';
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
  ast: Record<string, any>;
}) {
  for (const column of columns) {
    if (!ast?.[column.title]) continue;
    await extractColumn({
      column,
      knex,
      rootAlias: alias,
      qb,
      getAlias,
      params: params?.nested?.[column.title],
      baseModel,
      // dependencyFields: dependencyFields?.nested?.[column.title],
      ast: ast?.[column.title],
    });
  }
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

              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL (${knex
                  .from(btAggQb.as(alias2))
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

    case UITypes.DateTime:
      {
        // if there is no timezone info,
        // convert to database timezone,
        // then convert to UTC
        if (
          column.dt !== 'timestamp with time zone' &&
          column.dt !== 'timestamptz'
        ) {
          qb.select(
            knex.raw(
              `(??.?? AT TIME ZONE CURRENT_SETTING('timezone') AT TIME ZONE 'UTC') as ??`,
              [rootAlias, column.column_name, column.title],
            ),
          );
          break;
        }
        qb.select(
          knex.raw(`??.?? as ??`, [
            rootAlias,
            column.column_name,
            column.title,
          ]),
        );
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
