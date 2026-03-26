import { NcApiVersion } from 'nocodb-sdk';
import { PGDBQueryClient as PGDBQueryClientCE } from 'src/dbQueryClient/pg';
import {
  ButtonActionsType,
  extractFilterFromXwhere,
  isBtLikeV2Junction,
  isMMOrMMLike,
  NcDataErrorCodes,
  parseProp,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk/build/main/lib';
import type { Knex } from 'knex';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { DBQueryClient, ExtractColumnsParam } from '~/dbQueryClient/types';
import type {
  BarcodeColumn,
  ButtonColumn,
  Filter,
  FormulaColumn,
  LinkToAnotherRecordColumn,
  LookupColumn,
  QrCodeColumn,
  Source,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import type { PagedResponseImpl } from 'src/helpers/PagedResponse';
import { singleQueryRead } from '~/dbQueryClient/cross-db-utils/single-query-read';
import { singleQueryList } from '~/dbQueryClient/cross-db-utils/single-query-list';
import {
  extractSortsObject,
  getAs,
  getColumnName,
  getListArgs,
} from '~/db/BaseModelSqlv2';
import conditionV2, { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import sortV2 from '~/db/sortV2';
import { recursiveCTEFromLookupColumn } from '~/helpers/lookupHelpers';
import { sanitize } from '~/helpers/sqlSanitize';
import { Column, Model, View } from '~/models';
import { NC_MAX_TEXT_LENGTH } from '~/constants';
import { extractColumns } from '~/dbQueryClient/cross-db-utils/extract-columns';

export class PGDBQueryClient
  extends PGDBQueryClientCE
  implements DBQueryClient
{
  logger = new Logger(PGDBQueryClient.name);

  generateNestedRowSelectQuery({
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
  }): Knex.Raw<any> {
    const paramsString = columns.map(() => `?,??.??`).join(',');
    const pramsValueArr = [
      ...columns.flatMap((c) => [c.id, alias, c.id]),
      title,
    ];

    return knex.raw(
      isBtOrOo
        ? `json_build_object(${paramsString}) as ??`
        : `coalesce(json_agg(jsonb_build_object(${paramsString})),'[]'::json) as ??`,
      pramsValueArr,
    );
  }

  async extractColumns(param: ExtractColumnsParam) {
    return extractColumns({ extractColumn: this.extractColumn.bind(this) })(
      param,
    );
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
    // dependencyFields,
    ast,
    throwErrorIfInvalidParams,
    validateFormula,
    columns,
    apiVersion = NcApiVersion.V2,
    model,
    aliasToColumn,
    columnIdToUidt,
    baseUsers,
  }: {
    column: Column;
    qb: Knex.QueryBuilder;
    rootAlias: string;
    knex: CustomKnex;
    isLookup?: boolean;
    params?: any;
    getAlias: () => string;
    baseModel: IBaseModelSqlV2;
    ast: Record<string, any>;
    throwErrorIfInvalidParams: boolean;
    validateFormula: boolean;
    columns?: Column[];
    apiVersion: NcApiVersion;
    model: Model;
    aliasToColumn: any;
    columnIdToUidt: Record<string, UITypes>;
    baseUsers: any;
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
          // Ensure colOptions is loaded before checking isMMOrMMLike
          if (!column.colOptions) {
            await column.getColOptions(context);
          }
          const isMMLike = isMMOrMMLike(column);
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

          const aliasColObjMap = await relatedModel.getAliasColObjMap(
            refContext,
            relatedModel.columns,
          );

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
            apiVersion,
          );
          const { filters: queryFilterObj } = extractFilterFromXwhere(
            refContext,
            listArgs?.where,
            aliasColObjMap,
            throwErrorIfInvalidParams,
          );

          const relType = isMMLike
            ? RelationTypes.MANY_TO_MANY
            : column.colOptions.type;

          switch (relType) {
            case RelationTypes.MANY_TO_MANY:
              {
                const isSingleTargetV2 = isBtLikeV2Junction(column);
                result.isArray = !isSingleTargetV2;
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
                  .limit(isSingleTargetV2 ? 1 : +listArgs.limit + 1)
                  .offset(isSingleTargetV2 ? 0 : +listArgs.offset);

                // apply filters on nested query
                await conditionV2(
                  parentBaseModel,
                  queryFilterObj,
                  mmQb,
                  alias2,
                );

                const view =
                  (relationColOpts.fk_target_view_id &&
                    (await View.get(
                      refContext,
                      relationColOpts.fk_target_view_id,
                    ))) ||
                  (await View.getFirstCollaborativeView(
                    refContext,
                    parentBaseModel.model.id,
                  ));
                const relatedSorts = await view.getSorts(refContext);
                // apply sorts on nested query
                if (sorts && sorts.length > 0) {
                  await sortV2(parentBaseModel, sorts, mmQb, alias2);
                } else if (relatedSorts && relatedSorts.length > 0)
                  await sortV2(parentBaseModel, relatedSorts, mmQb, alias2);

                const mmAggQb = knex(mmQb.as(alias5));
                await this.extractColumns({
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
                           this.generateNestedRowSelectQuery({
                             knex,
                             alias: alias3,
                             columns: fields,
                             title: getAs(column),
                             ...(isSingleTargetV2 ? { isBtOrOo: true } : {}),
                           }),
                         )
                         .toQuery()
                         .replaceAll('?', '\\?')}) as ?? ON true`,
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
                await this.extractColumns({
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
                      this.generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: getAs(column),
                        isBtOrOo: true,
                      }),
                    )
                    .toQuery()
                    .replaceAll('?', '\\?')}) as ?? ON true`,
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
                  await this.extractColumns({
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
                        this.generateNestedRowSelectQuery({
                          knex,
                          alias: alias2,
                          columns: fields,
                          title: getAs(column),
                          isBtOrOo: true,
                        }),
                      )
                      .toQuery()
                      .replaceAll('?', '\\?')}) as ?? ON true`,
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
                  await this.extractColumns({
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
                        this.generateNestedRowSelectQuery({
                          knex,
                          alias: alias2,
                          columns: fields,
                          title: getAs(column),
                          isBtOrOo: true,
                        }),
                      )
                      .toQuery()
                      .replaceAll('?', '\\?')}) as ?? ON true`,
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

                const childBaseModel = await Model.getBaseModelSQL(
                  childContext,
                  {
                    dbDriver: knex,
                    model: childModel,
                  },
                );

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
                  : await View.getFirstCollaborativeView(
                      childContext,
                      childModel.id,
                    );
                const childSorts = await view.getSorts(childContext);

                // apply sorts on nested query
                if (sorts && sorts.length > 0) {
                  await sortV2(childBaseModel, sorts, hmQb, alias2);
                } else if (childSorts && childSorts.length > 0)
                  await sortV2(childBaseModel, childSorts, hmQb);

                const hmAggQb = knex(hmQb.as(alias3));
                await this.extractColumns({
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
                      this.generateNestedRowSelectQuery({
                        knex,
                        alias: alias2,
                        columns: fields,
                        title: getAs(column),
                      }),
                    )
                    .toQuery()
                    .replaceAll('?', '\\?')}) as ?? ON true`,
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

          const lookupColOpt = await column.getColOptions<LookupColumn>(
            context,
          );

          const relationColumn = await lookupColOpt.getRelationColumn(context);
          const relationColOpts =
            await relationColumn.getColOptions<LinkToAnotherRecordColumn>(
              context,
            );

          const isMMLike = isMMOrMMLike(relationColumn);

          const { parentContext, childContext, refContext, mmContext } =
            await relationColOpts.getParentChildContext(context);

          const lookupColumn = await lookupColOpt.getLookupColumn(refContext);

          let relQb;
          const relTableAlias = getAlias();
          let refBaseModel: BaseModelSqlv2;

          const relType = isMMLike
            ? RelationTypes.MANY_TO_MANY
            : relationColumn.colOptions.type;

          const lookupIsSingleTargetV2 = isBtLikeV2Junction(relationColumn);

          switch (relType) {
            case RelationTypes.MANY_TO_MANY:
              {
                result.isArray = !lookupIsSingleTargetV2;

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

                relQb = knex(assocQb.as(alias4)).innerJoin(
                  knex.raw(`?? as ?? on ??.?? = ??.??`, [
                    parentBaseModel.getTnPath(parentModel),
                    relTableAlias,
                    relTableAlias,
                    sanitize(parentColumn.column_name),
                    alias4,
                    sanitize(mmParentColumn.column_name),
                  ]),
                );

                if (lookupIsSingleTargetV2) {
                  relQb.limit(1);
                }
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
                const childBaseModel = await Model.getBaseModelSQL(
                  childContext,
                  {
                    model: childModel,
                    dbDriver: knex,
                  },
                );

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

          await extractLinkRelFiltersAndApply({
            qb: relQb,
            column,
            alias: relTableAlias,
            table: refBaseModel.model,
            baseModel: refBaseModel,
            context: refBaseModel.context,
          });

          if (!refBaseModel.model.columns?.length) {
            await refBaseModel.model.getColumns(refBaseModel.context);
          }

          const { isArray } = await this.extractColumn({
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
            model: refBaseModel.model,
            aliasToColumn,
            columnIdToUidt,
            baseUsers,
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
                   .toQuery()
                   .replaceAll('?', '\\?')}) as ?? ON true`,
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
                .toQuery()
                .replaceAll(
                  '?',
                  '\\?',
                )},json_array_elements(??.??) as ?? ) as ?? ON true`,
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
                .toQuery()
                .replaceAll('?', '\\?')}) as ?? ON true`,
              [lookupTableAlias],
            );
          }
          qb.select(knex.raw('??.??', [lookupTableAlias, getAs(column)]));
        }
        break;
      case UITypes.Formula:
        {
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
              columns: model.columns,
              aliasToColumn,
              columnIdToUidt,
              baseUsers,
            });
            if ('toQuery' in selectQb.builder) {
              const selectQbQuery = selectQb.builder
                .toQuery()
                .replaceAll('?', '\\?');
              qb.select(knex.raw(`(${selectQbQuery}) as ??`, [getAs(column)]));
            } else {
              qb.select(
                knex.raw(`?? as ??`, [selectQb.builder, getAs(column)]),
              );
            }
          } catch (e) {
            this.logger.log(e);
            qb.select(knex.raw(`'ERR' as ??`, [getAs(column)]));
          }
        }
        break;
      case UITypes.Button:
        {
          const buttonColumn = await column.getColOptions<ButtonColumn>(
            context,
          );
          if (buttonColumn.type === ButtonActionsType.Url) {
            if (buttonColumn.error) return result;
            const selectQb = await formulaQueryBuilderv2({
              baseModel: baseModel,
              tree: buttonColumn.formula,
              model,
              column,
              tableAlias: rootAlias,
              validateFormula,
              columns: model.columns,
              aliasToColumn,
              columnIdToUidt,
              baseUsers,
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
      case UITypes.Links:
        if (
          (params?.linksAsLtar === 'true' && apiVersion === NcApiVersion.V3) ||
          isBtLikeV2Junction(column)
        ) {
          try {
            return await this.extractColumn({
              column: new Column({
                ...column,
                uidt: UITypes.LinkToAnotherRecord,
              }),
              qb,
              rootAlias,
              knex,
              params,
              isLookup,
              getAlias,
              baseModel,
              ast,
              throwErrorIfInvalidParams,
              validateFormula,
              columns,
              apiVersion,
              model,
              aliasToColumn,
              columnIdToUidt,
              baseUsers,
            });
          } finally {
            // No Op
          }
        }
      // eslint-disable-next-line no-fallthrough -- falls through to Rollup when linksAsLtar is not set
      case UITypes.Rollup:
        qb.select(
          knex.raw(
            `(${(
              await genRollupSelectv2({
                baseModelSqlv2: baseModel,
                knex,
                columnOptions: await column.getColOptions(context),
                alias: rootAlias,
              })
            ).builder
              .toQuery()
              .replaceAll('?', '\\?')}) as ??`,
            [getAs(column)],
          ),
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

          return this.extractColumn({
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
            model,
            aliasToColumn,
            columnIdToUidt,
            baseUsers,
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

          return this.extractColumn({
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
            model,
            aliasToColumn,
            columnIdToUidt,
            baseUsers,
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
      case UITypes.LongText: {
        if ((baseModel.dbDriver as any).isExternal) {
          qb.select(
            knex.raw(`SUBSTR(??.??::TEXT, 1, ?) as ??`, [
              rootAlias,
              sanitize(column.column_name),
              NC_MAX_TEXT_LENGTH,
              getAs(column),
            ]),
          );
          break;
        }
        // Else fall through
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

  singleQueryRead(
    context: NcContext,
    ctx: {
      model: Model;
      view: View;
      source: Source;
      params;
      id: string | Record<string, any>;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      apiVersion?: NcApiVersion;
    },
  ): Promise<PagedResponseImpl<Record<string, any>>> {
    return singleQueryRead(this).read(context, ctx);
  }

  singleQueryList(
    context: NcContext,
    ctx: {
      model: Model;
      view?: View;
      source: Source;
      params: any;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      baseModel?: BaseModelSqlv2;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      skipPaginateWrapper?: boolean;
      skipSortBasedOnOrderCol?: boolean; // dependencyFields,
      ignoreViewFilterAndSort?: boolean;
    },
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    return singleQueryList(this, this.logger).list(context, ctx);
  }
}
