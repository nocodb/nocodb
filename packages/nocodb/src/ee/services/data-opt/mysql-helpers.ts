// eslint-disable-file no-fallthrough
import {
  ButtonActionsType,
  extractFilterFromXwhere,
  isOrderCol,
  NcDataErrorCodes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import {
  checkForStaticDateValFilters,
  shouldSkipCache,
} from './common-helpers';
import type { NcApiVersion } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { XKnex } from '~/db/CustomKnex';
import type {
  BarcodeColumn,
  ButtonColumn,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  View,
} from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { NcContext } from '~/interface/config';
import { Column, Filter, Model, Sort, Source } from '~/models';
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

const logger = new Logger('mysql-helpers');

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
  if (isBtOrOo) {
  }
  const paramsString = columns.map(() => `?,??.??`).join(',');
  const pramsValueArr = [
    ...columns.flatMap((c) => [c.id, sanitize(alias), c.id]),
    title,
  ];

  return knex.raw(
    isBtOrOo
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
  apiVersion,
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
  apiVersion?: NcApiVersion;
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
        const { refContext, mmContext } = (
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

              const parentModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getRelatedTable(context);
              const mmChildColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getMMChildColumn(context);
              const mmParentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getMMParentColumn(context);
              const assocModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getMMModel(context);
              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(context);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(context);

              // if mm table is not present then return
              if (!assocModel) {
                qb.select(
                  knex.raw('? as ??', [
                    NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                    getAs(column),
                  ]),
                );
              }

              const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
                model: assocModel,
                dbDriver: knex,
              });

              const parentBaseModel = await Model.getBaseModelSQL(refContext, {
                model: parentModel,
                dbDriver: knex,
              });

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
                .limit(+listArgs.limit)
                .offset(+listArgs.offset);

              // apply filters on nested query
              await conditionV2(parentBaseModel, queryFilterObj, mmQb, alias2);

              // apply sorts on nested query
              if (sorts) await sortV2(parentBaseModel, sorts, mmQb, alias2);

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

              const parentModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getRelatedTable(context);
              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(context);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(context);

              const parentBaseModel = await Model.getBaseModelSQL(refContext, {
                model: parentModel,
                dbDriver: knex,
              });

              const btQb = knex(parentBaseModel.getTnPath(parentModel))
                .select('*')
                .where(
                  sanitize(parentColumn.column_name),
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
                // dependencyFields,
                ast,
                throwErrorIfInvalidParams,
                validateFormula,
                apiVersion,
              });

              btAggQb
                .select('*')
                .where(
                  sanitize(parentColumn.column_name),
                  knex.raw('??.??', [
                    rootAlias,
                    sanitize(childColumn.column_name),
                  ]),
                );
              qb.joinRaw(
                `LEFT OUTER JOIN LATERAL
                     (${knex
                       .from(btQb.as(alias2))
                       .select(
                         knex.raw(`json_object(?,??.??, ?, ??.??) as ??`, [
                           pvColumn.id,
                           alias2,
                           sanitize(pvColumn.column_name),
                           pkColumn.id,
                           alias2,
                           sanitize(pkColumn.column_name),
                           getAs(column),
                         ]),
                       )
                       .toQuery()}) as ?? ON true`,
                [alias1],
              );
              qb.select(knex.raw('??.??', [alias1, getAs(column)]));
            }
            break;
          case RelationTypes.ONE_TO_ONE:
            {
              const alias1 = getAlias();
              const alias2 = getAlias();
              const alias3 = getAlias();

              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(context);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(context);

              const isBt = column.meta?.bt;

              if (isBt) {
                const parentModel = await (
                  column.colOptions as LinkToAnotherRecordColumn
                ).getRelatedTable(context);

                const parentBaseModel = await Model.getBaseModelSQL(
                  refContext,
                  {
                    model: parentModel,
                    dbDriver: knex,
                  },
                );

                const btQb = knex(parentBaseModel.getTnPath(parentModel))
                  .select('*')
                  .where(
                    sanitize(parentColumn.column_name),
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
                  // dependencyFields,
                  ast,
                  throwErrorIfInvalidParams,
                  validateFormula,
                  apiVersion,
                });

                btAggQb
                  .select('*')
                  .where(
                    sanitize(parentColumn.column_name),
                    knex.raw('??.??', [
                      rootAlias,
                      sanitize(childColumn.column_name),
                    ]),
                  );
                qb.joinRaw(
                  `LEFT OUTER JOIN LATERAL
                     (${knex
                       .from(btQb.as(alias2))
                       .select(
                         knex.raw(`json_object(?,??.??, ?, ??.??) as ??`, [
                           pvColumn.id,
                           alias2,
                           sanitize(pvColumn.column_name),
                           pkColumn.id,
                           alias2,
                           sanitize(pkColumn.column_name),
                           getAs(column),
                         ]),
                       )
                       .toQuery()}) as ?? ON true`,
                  [alias1],
                );
                qb.select(knex.raw('??.??', [alias1, getAs(column)]));
              } else {
                const childModel = await (
                  column.colOptions as LinkToAnotherRecordColumn
                ).getRelatedTable(context);
                const hmQb = knex(baseModel.getTnPath(childModel))
                  .select('*')
                  .where(
                    childColumn.column_name,
                    knex.raw('??.??', [rootAlias, parentColumn.column_name]),
                  )
                  .first();

                const childBaseModel = await Model.getBaseModelSQL(refContext, {
                  model: childModel,
                  dbDriver: knex,
                });

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

              const childModel = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getRelatedTable(context);
              const childColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getChildColumn(context);
              const parentColumn = await (
                column.colOptions as LinkToAnotherRecordColumn
              ).getParentColumn(context);

              const childBaseModel = await Model.getBaseModelSQL(refContext, {
                model: childModel,
                dbDriver: knex,
              });

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
        const lookupColumn = await lookupColOpt.getLookupColumn(context);

        const relationColumn = await lookupColOpt.getRelationColumn(context);
        const relationColOpts =
          await relationColumn.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );
        let relQb;
        const relTableAlias = getAlias();

        switch (relationColOpts.type) {
          case RelationTypes.MANY_TO_MANY:
            {
              result.isArray = true;

              const alias1 = getAlias();
              const alias4 = getAlias();

              const parentModel = await relationColOpts.getRelatedTable(
                context,
              );
              const mmChildColumn = await relationColOpts.getMMChildColumn(
                context,
              );
              const mmParentColumn = await relationColOpts.getMMParentColumn(
                context,
              );
              const assocModel = await relationColOpts.getMMModel(context);
              const childColumn = await relationColOpts.getChildColumn(context);
              const parentColumn = await relationColOpts.getParentColumn(
                context,
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

              const parentModel = await relationColOpts.getRelatedTable(
                context,
              );
              const childColumn = await relationColOpts.getChildColumn(context);
              const parentColumn = await relationColOpts.getParentColumn(
                context,
              );
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
              const childModel = await relationColOpts.getRelatedTable(context);
              const childColumn = await relationColOpts.getChildColumn(context);
              const parentColumn = await relationColOpts.getParentColumn(
                context,
              );
              relQb = knex(
                knex.raw('?? as ??', [
                  baseModel.getTnPath(childModel),
                  relTableAlias,
                ]),
              ).where(
                sanitize(childColumn.column_name),
                knex.raw('??.??', [
                  rootAlias,
                  sanitize(parentColumn.column_name),
                ]),
              );
            }

            break;
          case RelationTypes.ONE_TO_ONE: {
            const isBt = relationColumn.meta?.bt;

            if (isBt) {
              const parentModel = await relationColOpts.getRelatedTable(
                context,
              );
              const childColumn = await relationColOpts.getChildColumn(context);
              const parentColumn = await relationColOpts.getParentColumn(
                context,
              );
              relQb = knex(
                knex.raw('?? as ??', [
                  baseModel.getTnPath(parentModel),
                  relTableAlias,
                ]),
              ).where(
                parentColumn.column_name,
                knex.raw('??.??', [rootAlias, childColumn.column_name]),
              );
            } else {
              const childModel = await relationColOpts.getRelatedTable(context);
              const childColumn = await relationColOpts.getChildColumn(context);
              const parentColumn = await relationColOpts.getParentColumn(
                context,
              );
              relQb = knex(
                knex.raw('?? as ??', [
                  baseModel.getTnPath(childModel),
                  relTableAlias,
                ]),
              ).where(
                sanitize(childColumn.column_name),
                knex.raw('??.??', [
                  rootAlias,
                  sanitize(parentColumn.column_name),
                ]),
              );
            }
          }
        }

        const { isArray } = await extractColumn({
          qb: relQb,
          rootAlias: relTableAlias,
          knex,
          getAlias,
          column: lookupColumn,
          baseModel,
          isLookup: true,
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
                knex.raw(`json_arrayagg(??) as ??`, [alias, getAs(column)]),
              )
              .toQuery()},json_array_elements(??.??) as ?? ) as ?? ON true`,
            [alias2, getAs(lookupColumn), alias, lookupTableAlias],
          );
        } else {
          qb.joinRaw(
            `LEFT OUTER JOIN LATERAL (${knex
              .from(relQb.as(alias2))
              .select(
                knex.raw(`json_arrayagg(??.??) as ??`, [
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
        const buttonCol = await column.getColOptions<ButtonColumn>(context);
        if (buttonCol.type === ButtonActionsType.Url) {
          if (buttonCol.error) return result;
          const selectQb = await formulaQueryBuilderv2({
            baseModel: baseModel,
            tree: buttonCol.formula,
            model,
            column,
            tableAlias: rootAlias,
            validateFormula,
          });

          qb.select(
            knex.raw(`JSON_OBJECT('type', ?, 'label', ?, 'url', ??) as ??`, [
              buttonCol.type,
              `${buttonCol.label}`,
              selectQb.builder,
              getAs(column),
            ]),
          );
        } else if (
          [ButtonActionsType.Webhook, ButtonActionsType.Script].includes(
            buttonCol.type,
          )
        ) {
          const key =
            buttonCol.type === ButtonActionsType.Webhook
              ? 'fk_webhook_id'
              : 'fk_script_id';
          qb.select(
            knex.raw(`JSON_OBJECT('type', ?, 'label', ?, '${key}', ?) as ??`, [
              buttonCol.type,
              `${buttonCol.label}`,
              buttonCol[key],
              getAs(column),
            ]),
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
        });
      }
      break;

    case UITypes.Attachment:
      {
        qb.select(
          knex.raw(`CAST(??.?? as JSON) as ??`, [
            rootAlias,
            sanitize(column.column_name),
            getAs(column),
          ]),
        );
      }
      break;
    case UITypes.CreatedTime:
    case UITypes.LastModifiedTime:
    case UITypes.DateTime:
      {
        const columnName = await getColumnName(context, column, columns);
        // MySQL stores timestamp in UTC but display in timezone
        // To verify the timezone, run `SELECT @@global.time_zone, @@session.time_zone;`
        // If it's SYSTEM, then the timezone is read from the configuration file
        // if a timezone is set in a DB, the retrieved value would be converted to the corresponding timezone
        // for example, let's say the global timezone is +08:00 in DB
        // the value 2023-01-01 10:00:00 (UTC) would display as 2023-01-01 18:00:00 (UTC+8)
        // our existing logic is based on UTC, during the query, we need to take the UTC value
        // hence, we use CONVERT_TZ to convert back to UTC value
        if (isLookup) {
          qb.select(
            knex.raw(
              `(SELECT CONCAT(DATE_FORMAT(CONVERT_TZ(??, @@session.time_zone, '+00:00'), '%Y-%m-%d %H:%i:%s'), '+00:00') LIMIT 1) as ??`,
              [`${sanitize(rootAlias)}.${columnName}`, getAs(column)],
            ),
          );
        } else {
          qb.select(
            knex.raw(`CONVERT_TZ(??, @@GLOBAL.time_zone, '+00:00') as ??`, [
              `${sanitize(rootAlias)}.${columnName}`,
              getAs(column),
            ]),
          );
        }
      }
      break;

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

    case UITypes.SingleSelect: {
      qb.select(
        knex.raw(`COALESCE(NULLIF(??.??, ''), NULL) as ??`, [
          rootAlias,
          sanitize(column.column_name),
          getAs(column),
        ]),
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

  if (!['mysql', 'mysql2'].includes(ctx.source.type)) {
    throw new Error('Source is not mysql');
  }

  let skipCache = shouldSkipCache(ctx, false);

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:read`;

  const baseModel = await Model.getBaseModelSQL(context, {
    id: ctx.model.id,
    viewId: ctx.view?.id,
    dbDriver: knex,
  });

  // get the key value pair condition
  const pkCondition = _wherePk(ctx.model.primaryKeys, ctx.id);

  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    if (cachedQuery) {
      const res = await baseModel.execAndParse(
        knex
          .raw(
            cachedQuery,
            ctx.model.primaryKeys.map(
              (pkCol) => pkCondition[pkCol.column_name],
            ),
          )
          .toQuery(),
        null,
        { first: true },
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
    ctx.throwErrorIfInvalidParams,
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

  // apply filters on root query and count query
  await conditionV2(baseModel, aggrConditionObj, rootQb);
  // await conditionV2(baseModel, aggrConditionObj, countQb);

  // apply sort on root query
  // if (sorts) await sortV2(baseModel, sorts, rootQb);

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

  const res = await baseModel.execAndParse(
    knex
      .raw(
        query,
        ctx.model.primaryKeys.map((pkCol) => pkCondition[pkCol.column_name]),
      )
      .toQuery(),
    null,
    { first: true },
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
  if (!['mysql', 'mysql2'].includes(ctx.source.type)) {
    throw new Error('Source is not mysql');
  }

  let skipCache = shouldSkipCache(ctx);

  const listArgs = getListArgs(ctx.params ?? {}, ctx.model);

  const getAlias = getAliasGenerator();

  // get knex connection
  const knex = await NcConnectionMgrv2.get(ctx.source);

  const cacheKey = `${CacheScope.SINGLE_QUERY}:${ctx.model.id}:${
    ctx.view?.id ?? 'default'
  }:queries`;

  await ctx.model.getColumns(context);
  let dbQueryTime;

  const baseModel =
    ctx.baseModel ||
    (await Model.getBaseModelSQL(context, {
      model: ctx.model,
      viewId: ctx.view?.id,
      dbDriver: knex,
    }));
  if (!skipCache) {
    const cachedQuery = await NocoCache.get(cacheKey, CacheGetType.TYPE_STRING);
    if (cachedQuery) {
      const startTime = process.hrtime();
      const res = await baseModel.execAndParse(
        knex.raw(cachedQuery, [+listArgs.limit, +listArgs.offset]).toQuery(),
      );
      dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));

      return new PagedResponseImpl(
        res.map(({ __nc_count, ...rest }) => rest),
        {
          count: +res[0]?.__nc_count || 0,
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
    } else if (ctx.model.primaryKey) {
      rootQb.orderBy(ctx.model.primaryKey.column_name);
    }
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

  const qb = knex.from(rootQb.as(ROOT_ALIAS));

  const { ast } = await getAst(context, {
    query: ctx.params,
    model: ctx.model,
    view: ctx.view,
    getHiddenColumn: ctx.getHiddenColumns,
    throwErrorIfInvalidParams: ctx.throwErrorIfInvalidParams,
    apiVersion: ctx.apiVersion,
    includeSortAndFilterColumns: ctx.includeSortAndFilterColumns,
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
  } else if (ctx.model.columns.find((c) => c.column_name === 'created_at')) {
    qb.orderBy(`${ROOT_ALIAS}.created_at`);
  }

  const finalQb = qb.select(countQb.as('__nc_count'));

  let res: any;
  if (skipCache) {
    const startTime = process.hrtime();
    res = await baseModel.execAndParse(finalQb, undefined, {
      apiVersion: ctx.apiVersion,
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

    // cache query for later use
    await NocoCache.set(cacheKey, query);

    const startTime = process.hrtime();
    // run the query with actual limit and offset
    res = await baseModel.execAndParse(
      knex.raw(query, [+listArgs.limit, +listArgs.offset]).toQuery(),
      undefined,
      {
        apiVersion: ctx.apiVersion,
      },
    );
    dbQueryTime = parseHrtimeToMilliSeconds(process.hrtime(startTime));
  }

  return new PagedResponseImpl(
    res.map(({ __nc_count, ...rest }) => rest),
    {
      count: +res[0]?.__nc_count || 0,
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

// allow if MySQL version is >= 8.0.0 and not MariaDB
// const version = await base.getDbVersion();
export async function isMysqlVersionSupported(
  context: NcContext,
  source: Source,
) {
  // if version is not present in meta then get it from db
  // and store it in base meta for later use
  let meta;
  if (!source.meta || !('dbVersion' in source.meta)) {
    try {
      const sqlClient = await NcConnectionMgrv2.getSqlClient(source);
      meta = source.meta || {};
      meta.dbVersion = await sqlClient
        .raw('select version() as version')
        .then((res) => res[0][0].version);

      Source.update(context, source.id, {
        meta,
      })
        .then(() => {
          // do nothing, it's just to update the base meta and not wait for it
        })
        .catch((err) => {
          logger.error(err);
        });
    } catch {
      // disable if the version extraction fails
      return false;
    }
  } else {
    meta = source.meta;
  }

  if (!meta || !meta.dbVersion || /Maria/i.test(meta.dbVersion)) {
    return false;
  }

  // check if version is >= 8.0.0
  return +meta.dbVersion.split('.')[0] >= 8;
}
