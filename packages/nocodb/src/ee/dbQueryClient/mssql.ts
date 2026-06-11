// EE single-query MSSQL nested-read client.
//
// Architecture — Option A (correlated FOR JSON PATH subqueries):
//   • Root query stays tabular: scalar columns aliased by col-id.
//   • Each relation / lookup / rollup / formula becomes a single expression
//     (or correlated scalar subquery) injected via `qb.select(rawExpr)`.
//     LTAR/Lookup arrays use `(… FOR JSON PATH, INCLUDE_NULL_VALUES) AS [colId]`;
//     BT/OO singles add `WITHOUT_ARRAY_WRAPPER`. No OUTER APPLY / LATERAL — the
//     SQL Server optimizer folds APPLY around a scalar FOR JSON into the same
//     plan as a direct correlated subquery (empirically verified on 2M rows;
//     see .claude/branches/mssql-server-work/perf/RESULTS.md).
//   • Nested relations recurse: the child query gets its own `qb.select(raw)`
//     entries from a recursive extractColumns call, then the whole child SQL
//     is wrapped with `( … FOR JSON PATH … )` as a scalar in the outer SELECT.
//
// Result-shape contract — the JSON payloads returned by FOR JSON arrive as
// `nvarchar` strings (not parsed JS values like pg's `json_agg`). The EE
// execAndParse path JSON.parses LTAR/Lookup/Links columns for mssql before
// running substituteColumnIdsWithColumnTitles. INCLUDE_NULL_VALUES keeps null
// keys so downstream sees the same shape pg's json_build_object produces.
//
// Mirrors the pg/mysql structural template (mysql.ts is the closest port).
// Where divergences exist they are called out inline.

import { Logger } from '@nestjs/common';
import {
  ButtonActionsType,
  ClientType,
  extractFilterFromXwhere,
  isBtLikeV2Junction,
  isMMOrMMLike,
  NC_ERROR_SENTINEL,
  NcApiVersion,
  NcDataErrorCodes,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import { MssqlDBQueryClient as MssqlDBQueryClientCE } from 'src/dbQueryClient/mssql';
import type { Knex } from 'knex';
import type { NcContext } from 'nocodb-sdk';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
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
import {
  extractSortsObject,
  getAs,
  getColumnName,
  getListArgs,
} from '~/helpers/dbHelpers';
import conditionV2, { extractLinkRelFiltersAndApply } from '~/db/conditionV2';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import sortV2 from '~/db/sortV2';
import { NC_MAX_TEXT_LENGTH } from '~/constants';
import { genMssqlAggregateQuery } from '~/dbQueryClient/aggregations/mssql';
import { extractColumns } from '~/dbQueryClient/cross-db-utils/extract-columns';
import { sanitize } from '~/helpers/sqlSanitize';
import { Column, Model, View } from '~/models';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { singleQueryRead } from '~/dbQueryClient/cross-db-utils/single-query-read';
import { singleQueryList } from '~/dbQueryClient/cross-db-utils/single-query-list';

export class MssqlDBQueryClient
  extends MssqlDBQueryClientCE
  implements DBQueryClient
{
  logger = new Logger(MssqlDBQueryClient.name);

  get clientType(): ClientType {
    return ClientType.MSSQL;
  }

  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }

  simpleCast(field: string, asType: string) {
    const useAsType =
      asType.toUpperCase() === 'TEXT' ? 'NVARCHAR(MAX)' : asType;
    return `CAST(${field} AS ${useAsType})`;
  }

  generateAggregateQuery(params: AggregationGeneratorParams) {
    return genMssqlAggregateQuery(params);
  }

  /**
   * T-SQL `OFFSET … FETCH NEXT …` requires an ORDER BY in the same query.
   * The generic list pipeline already attaches one for the common cases
   * (user sorts, view sorts, NocoDB Order column, ai-PK, system
   * CreatedTime) — but external sources that miss every branch (e.g. a
   * view with no PK) leave the subquery sortless and T-SQL rejects it.
   *
   * Appending `(SELECT NULL)` as a *trailing* sort key handles both
   * shapes with the same one-liner — no introspection of knex internals
   * required:
   *
   *   1. ORDER BY already present (`pk` or user sort): the query becomes
   *      `ORDER BY pk, (SELECT NULL)`. `(SELECT NULL)` returns the same
   *      constant for every row, so it never reorders rows — purely
   *      cosmetic noise on the existing order.
   *   2. No ORDER BY: the query becomes `ORDER BY (SELECT NULL)`, the
   *      canonical T-SQL no-op order that just satisfies the syntax
   *      rule. Pagination is non-deterministic in this case — the same
   *      silent behavior pg/mysql/sqlite already exhibit on PK-less
   *      views.
   *
   */
  ensurePaginationOrderBy(qb: Knex.QueryBuilder, _model: Model): void {
    qb.orderByRaw('(SELECT NULL)');
  }

  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw {
    const knex = baseModel.dbDriver;
    // T-SQL has no JSON_OBJECT — select each aggregate as a named column and
    // wrap with `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER` to produce a single
    // `{...}` string. TOP 1 collapses non-aggregating projections (median,
    // attachment_size) that would otherwise yield N rows and concatenated
    // garbage JSON.
    tQb.select(
      knex.raw(
        Object.keys(expressions)
          .map((k) => `${expressions[k]} as [${k}]`)
          .join(', '),
      ),
    );
    return knex.raw(
      '(SELECT TOP 1 * FROM (??) AS __nc_agg_src FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) as ??',
      [tQb, alias],
    );
  }

  // generateNestedRowSelectQuery — included for interface parity with
  // pg/mysql, but mssql's Option A shape never wraps an inner-then-aggregate
  // pair: FOR JSON PATH directly turns the child SELECT into the JSON output,
  // with column aliases (col ids) becoming the JSON keys. This helper builds
  // the same row-shape as `json_build_object` for callers that genuinely want
  // it (e.g. assembling a JSON object from a pre-aliased subquery), so it
  // stays available even though the relation branches below bypass it.
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
    // Build `(SELECT a.[c1] AS [c1], a.[c2] AS [c2] FOR JSON PATH[, WITHOUT_ARRAY_WRAPPER], INCLUDE_NULL_VALUES) AS [title]`.
    const cols = columns.map((c) => `?? AS ??`).join(', ');
    const bindings = columns.flatMap((c) => [`${alias}.${c.id}`, c.id]);
    const tail = isBtOrOo
      ? 'FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES'
      : 'FOR JSON PATH, INCLUDE_NULL_VALUES';
    return knex.raw(`(SELECT ${cols} ${tail}) AS ??`, [...bindings, title]);
  }

  async extractColumns(param) {
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
    baseModel: IBaseModelSqlV2;
    ast: Record<string, any>;
    throwErrorIfInvalidParams: boolean;
    validateFormula: boolean;
    columns?: Column[];
    apiVersion?: NcApiVersion;
  }) {
    const context = baseModel.context;

    const result = { isArray: false };

    switch (column.uidt) {
      case UITypes.LinkToAnotherRecord: {
        if (!column.colOptions) {
          await column.getColOptions(context);
        }
        const isMMLike = isMMOrMMLike(column);
        const relatedModel = await (
          column.colOptions as LinkToAnotherRecordColumn
        ).getRelatedTable(context);

        if (!relatedModel) {
          this.logger.warn(
            `Skipping orphaned LTAR column ${column.id} (${
              column.title
            }) — related model ${
              (column.colOptions as LinkToAnotherRecordColumn)
                ?.fk_related_model_id
            } not found`,
          );
          return result;
        }

        const { refContext } = (
          column.colOptions as LinkToAnotherRecordColumn
        ).getRelContext(context);

        await relatedModel.getColumns(refContext);
        // @ts-ignore
        const pkColumn = relatedModel.primaryKey;
        const pvColumn = relatedModel.mm
          ? relatedModel.primaryKeys[1]
          : relatedModel.displayValue;

        const listArgs = getListArgs(params ?? {}, relatedModel, {
          ignoreAssigningWildcardSelect: true,
          apiVersion,
          nested: true,
        });

        const aliasColObjMap = await relatedModel.getAliasColObjMap(
          refContext,
          relatedModel.columns,
        );

        const customDisplayCol = (
          column.colOptions as LinkToAnotherRecordColumn
        ).fk_display_value_column_id
          ? relatedModel.columns?.find(
              (c) =>
                c.id ===
                (column.colOptions as LinkToAnotherRecordColumn)
                  .fk_display_value_column_id,
            )
          : undefined;

        let fields: Column[] = [
          pkColumn,
          ...(pvColumn && pvColumn !== pkColumn ? [pvColumn] : []),
          ...(customDisplayCol &&
          customDisplayCol.id !== pkColumn?.id &&
          customDisplayCol.id !== pvColumn?.id
            ? [customDisplayCol]
            : []),
        ].filter(Boolean);

        if (listArgs?.fields === '*') {
          fields = relatedModel.columns;
        } else if (listArgs?.fields?.length) {
          fields = listArgs.fields
            ?.split(',')
            .map((f) => aliasColObjMap[f])
            .filter(Boolean);

          if (
            customDisplayCol &&
            !fields.find((f) => f?.id === customDisplayCol.id)
          ) {
            fields.push(customDisplayCol);
          }
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

        // Inner ast — ensure pk/pv get selected even when the outer ast is an
        // object that omits them. Without these the resulting JSON is missing
        // identity and substituteColumnIdsWithColumnTitles can't map it.
        // `ast` is typed Record<string, any> but at runtime extract-columns.ts
        // also passes the sentinel values `true` / `1` to mean "all columns".
        // For the scalar sentinels (a Lookup targeting this LTAR recurses here
        // with the lookup column's own scalar AST) the pk/pv-only gate in
        // extract-columns would drop the custom display value column — widen
        // the scalar into an object AST so the override survives.
        const astAny = ast as unknown as true | 1 | Record<string, any>;
        const innerAst =
          astAny === true || astAny === 1
            ? customDisplayCol
              ? {
                  // all PKs, not just the first — composite-PK related tables
                  // must keep every key column extractable
                  ...(relatedModel.primaryKeys ?? []).reduce(
                    (o, pk) => ({ ...o, [pk.id]: true }),
                    {},
                  ),
                  ...(pvColumn?.id ? { [pvColumn.id]: true } : {}),
                  [customDisplayCol.id]: true,
                }
              : ast
            : {
                ...(typeof astAny === 'object' && astAny ? astAny : {}),
                ...(pkColumn?.id ? { [pkColumn.id]: true } : {}),
                ...(pvColumn?.id && pvColumn.id !== pkColumn?.id
                  ? { [pvColumn.id]: true }
                  : {}),
              };

        switch (relType) {
          case RelationTypes.MANY_TO_MANY: {
            const isSingleTargetV2 = isBtLikeV2Junction(column);
            result.isArray = !isSingleTargetV2;

            const assocAlias = getAlias();
            const parentAlias = getAlias();

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

            if (!assocModel) {
              qb.select(
                knex.raw('? AS ??', [
                  NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                  getAs(column),
                ]),
              );
              break;
            }

            const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
              id: assocModel.id,
              dbDriver: knex,
            });
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              id: parentColumn.fk_model_id,
              dbDriver: knex,
            });

            // Inner query: junction-join the related table, correlate the
            // junction's child column to the outer rootAlias.pk. Select
            // EVERYTHING from the parent (extractColumns then narrows to the
            // requested fields by aliasing them by col-id).
            const innerQb = knex(
              knex.raw('?? AS ??', [
                assocBaseModel.getTnPath(assocModel),
                assocAlias,
              ]),
            )
              .innerJoin(
                knex.raw(`?? AS ?? ON ??.?? = ??.??`, [
                  parentBaseModel.getTnPath(parentModel),
                  parentAlias,
                  parentAlias,
                  sanitize(parentColumn.column_name),
                  assocAlias,
                  sanitize(mmParentColumn.column_name),
                ]),
              )
              .whereRaw(`??.?? = ??.??`, [
                assocAlias,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

            const mmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              parentBaseModel,
              parentAlias,
            );
            if (mmSoftDeleteFilter) innerQb.where(mmSoftDeleteFilter);

            await conditionV2(
              parentBaseModel,
              queryFilterObj,
              innerQb,
              parentAlias,
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
            const relatedSorts = await view?.getSorts(refContext);
            if (sorts && sorts.length > 0) {
              await sortV2(parentBaseModel, sorts, innerQb, parentAlias);
            } else if (relatedSorts && relatedSorts.length > 0) {
              await sortV2(parentBaseModel, relatedSorts, innerQb, parentAlias);
            } else if (parentModel.primaryKey) {
              innerQb.orderBy(
                `${parentAlias}.${parentModel.primaryKey.column_name}`,
                'asc',
              );
            } else {
              // Related model has no PK (e.g. a view) — T-SQL still requires
              // an ORDER BY for the OFFSET/FETCH below. Use a no-op order.
              innerQb.orderByRaw('(SELECT NULL)');
            }

            // T-SQL OFFSET … FETCH requires an ORDER BY (handled above).
            if (isSingleTargetV2) {
              innerQb.limit(1).offset(0);
            } else {
              innerQb.limit(+listArgs.limit + 1).offset(+listArgs.offset);
            }

            await this.extractColumns({
              columns: fields,
              knex,
              qb: innerQb,
              params,
              getAlias,
              alias: parentAlias,
              baseModel: parentBaseModel,
              ast: innerAst,
              throwErrorIfInvalidParams,
              validateFormula,
              apiVersion,
            });

            const tail = isSingleTargetV2
              ? 'FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES'
              : 'FOR JSON PATH, INCLUDE_NULL_VALUES';
            const innerSql = innerQb.toQuery().replaceAll('?', '\\?');
            // Wrap with JSON_QUERY so a parent FOR JSON (when this LTAR is
            // itself nested) inlines the JSON instead of escaping it as a
            // string. Transparent no-op when this is the top-level qb.
            qb.select(
              knex.raw(`JSON_QUERY((${innerSql} ${tail})) AS ??`, [
                getAs(column),
              ]),
            );
            break;
          }

          case RelationTypes.BELONGS_TO: {
            const parentAlias = getAlias();
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

            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: knex,
            });

            // BT: at most one parent — `.first()` becomes `TOP (1)` in mssql.
            const innerQb = knex(
              knex.raw('?? AS ??', [
                parentBaseModel.getTnPath(parentModel),
                parentAlias,
              ]),
            )
              .whereRaw(`??.?? = ??.??`, [
                parentAlias,
                sanitize(parentColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ])
              .first();

            const btSoftDeleteFilter =
              await parentBaseModel.getSoftDeleteFilter();
            if (btSoftDeleteFilter) innerQb.where(btSoftDeleteFilter);

            await conditionV2(parentBaseModel, queryFilterObj, innerQb);

            await this.extractColumns({
              columns: fields,
              knex,
              qb: innerQb,
              params,
              getAlias,
              alias: parentAlias,
              baseModel: parentBaseModel,
              ast: innerAst,
              throwErrorIfInvalidParams,
              validateFormula,
              apiVersion,
            });

            const innerSql = innerQb.toQuery().replaceAll('?', '\\?');
            // JSON_QUERY: let a parent FOR JSON inline this BT's payload
            // instead of string-escaping. No-op at the top level.
            qb.select(
              knex.raw(
                `JSON_QUERY((${innerSql} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS ??`,
                [getAs(column)],
              ),
            );
            break;
          }

          case RelationTypes.ONE_TO_ONE: {
            const isBt = column.meta?.bt;
            const relationColOpts =
              column.colOptions as LinkToAnotherRecordColumn;
            const { childContext, parentContext, refContext } =
              await relationColOpts.getParentChildContext(context);
            const refAlias = getAlias();

            const refModel = await relationColOpts.getRelatedTable(refContext);
            const childColumn = await relationColOpts.getChildColumn(
              childContext,
            );
            const parentColumn = await relationColOpts.getParentColumn(
              parentContext,
            );

            const refBaseModel = await Model.getBaseModelSQL(refContext, {
              model: refModel,
              dbDriver: knex,
            });

            // OO is always WITHOUT_ARRAY_WRAPPER (single object). Correlation
            // direction depends on which side holds the FK (meta.bt).
            const innerQb = knex(
              knex.raw('?? AS ??', [
                refBaseModel.getTnPath(refModel),
                refAlias,
              ]),
            ).first();

            if (isBt) {
              innerQb.whereRaw(`??.?? = ??.??`, [
                refAlias,
                sanitize(parentColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);
            } else {
              innerQb.whereRaw(`??.?? = ??.??`, [
                refAlias,
                sanitize(childColumn.column_name),
                rootAlias,
                sanitize(parentColumn.column_name),
              ]);
            }

            const ooSoftDeleteFilter = await refBaseModel.getSoftDeleteFilter();
            if (ooSoftDeleteFilter) innerQb.where(ooSoftDeleteFilter);

            await conditionV2(refBaseModel, queryFilterObj, innerQb);

            await this.extractColumns({
              columns: fields,
              knex,
              qb: innerQb,
              params,
              getAlias,
              alias: refAlias,
              baseModel: refBaseModel,
              ast: innerAst,
              throwErrorIfInvalidParams,
              validateFormula,
              apiVersion,
            });

            const innerSql = innerQb.toQuery().replaceAll('?', '\\?');
            // JSON_QUERY: let a parent FOR JSON inline this OO's payload
            // instead of string-escaping. No-op at the top level.
            qb.select(
              knex.raw(
                `JSON_QUERY((${innerSql} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS ??`,
                [getAs(column)],
              ),
            );
            break;
          }

          case RelationTypes.HAS_MANY: {
            result.isArray = true;
            const childAlias = getAlias();

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

            const innerQb = knex(
              knex.raw('?? AS ??', [
                childBaseModel.getTnPath(childModel),
                childAlias,
              ]),
            ).whereRaw(`??.?? = ??.??`, [
              childAlias,
              sanitize(childColumn.column_name),
              rootAlias,
              sanitize(parentColumn.column_name),
            ]);

            const hmSoftDeleteFilter =
              await childBaseModel.getSoftDeleteFilter();
            if (hmSoftDeleteFilter) innerQb.where(hmSoftDeleteFilter);

            await conditionV2(childBaseModel, queryFilterObj, innerQb);

            const view = relationColOpts.fk_target_view_id
              ? await View.get(childContext, relationColOpts.fk_target_view_id)
              : await View.getFirstCollaborativeView(
                  childContext,
                  childModel.id,
                );
            const childSorts = await view?.getSorts(childContext);
            if (sorts && sorts.length > 0) {
              await sortV2(childBaseModel, sorts, innerQb, childAlias);
            } else if (childSorts && childSorts.length > 0) {
              await sortV2(childBaseModel, childSorts, innerQb);
            } else if (childModel.primaryKey) {
              innerQb.orderBy(
                `${childAlias}.${childModel.primaryKey.column_name}`,
                'asc',
              );
            } else {
              // Child model has no PK (e.g. a view) — T-SQL still requires
              // an ORDER BY for the OFFSET/FETCH below. Use a no-op order.
              innerQb.orderByRaw('(SELECT NULL)');
            }

            innerQb.limit(+listArgs.limit + 1).offset(+listArgs.offset);

            await this.extractColumns({
              columns: fields,
              knex,
              qb: innerQb,
              params,
              getAlias,
              alias: childAlias,
              baseModel: childBaseModel,
              ast: innerAst,
              throwErrorIfInvalidParams,
              validateFormula,
              apiVersion,
            });

            const innerSql = innerQb.toQuery().replaceAll('?', '\\?');
            // JSON_QUERY: let a parent FOR JSON inline this HM's payload
            // instead of string-escaping. No-op at the top level.
            qb.select(
              knex.raw(
                `JSON_QUERY((${innerSql} FOR JSON PATH, INCLUDE_NULL_VALUES)) AS ??`,
                [getAs(column)],
              ),
            );
            break;
          }
        }
        break;
      }

      // Lookup — value(s) pulled through an LTAR. For BT/OO (single relation
      // target) the lookup is a scalar correlated subquery returning the
      // looked-up value directly. For HM/MM (multi) we emit FOR JSON PATH with
      // the looked-up column aliased as `[v]`, producing `[{"v": val}, …]`.
      // The mssql post-parse step in execAndParse will flatten that into
      // `[val, …]` so the on-wire shape matches what pg's `json_agg(col)`
      // produces. If the looked-up column is itself an LTAR, the resulting
      // JSON nests naturally (FOR JSON inside a column expression is JSON, not
      // an escaped string).
      case UITypes.Lookup: {
        const lookupColOpt = await column.getColOptions<LookupColumn>(context);
        if (lookupColOpt.error) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }
        const relationColumn = await lookupColOpt.getRelationColumn(context);
        if (!relationColumn) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }
        const relationColOpts =
          await relationColumn.getColOptions<LinkToAnotherRecordColumn>(
            context,
          );
        const isMMLike = isMMOrMMLike(relationColumn);
        const { parentContext, childContext, refContext, mmContext } =
          await relationColOpts.getParentChildContext(context);

        const lookupColumn = await lookupColOpt.getLookupColumn(refContext);
        if (!lookupColumn) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }

        const relType = isMMLike
          ? RelationTypes.MANY_TO_MANY
          : relationColumn.colOptions.type;
        const lookupIsSingleTargetV2 = isBtLikeV2Junction(relationColumn);

        let relQb: Knex.QueryBuilder;
        const relTableAlias = getAlias();
        let refBaseModel: IBaseModelSqlV2;

        switch (relType) {
          case RelationTypes.MANY_TO_MANY: {
            result.isArray = !lookupIsSingleTargetV2;
            const assocAlias = getAlias();

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

            if (!assocModel) {
              qb.select(
                knex.raw('? AS ??', [
                  NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
                  getAs(column),
                ]),
              );
              return result;
            }

            const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: assocModel,
              dbDriver: knex,
            });
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: knex,
            });
            refBaseModel = parentBaseModel;

            relQb = knex(
              knex.raw('?? AS ??', [
                assocBaseModel.getTnPath(assocModel),
                assocAlias,
              ]),
            )
              .innerJoin(
                knex.raw(`?? AS ?? ON ??.?? = ??.??`, [
                  parentBaseModel.getTnPath(parentModel),
                  relTableAlias,
                  relTableAlias,
                  sanitize(parentColumn.column_name),
                  assocAlias,
                  sanitize(mmParentColumn.column_name),
                ]),
              )
              .whereRaw(`??.?? = ??.??`, [
                assocAlias,
                sanitize(mmChildColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ]);

            if (lookupIsSingleTargetV2) {
              // T-SQL OFFSET/FETCH requires an ORDER BY in the same query.
              // The lookup MM path doesn't add a sort otherwise — single-row
              // fetch so any order is fine. `(SELECT NULL)` is the canonical
              // no-op order; the limit 1 makes the ordering irrelevant.
              relQb.orderByRaw('(SELECT NULL)').limit(1).offset(0);
            }
            break;
          }
          case RelationTypes.BELONGS_TO: {
            const parentModel = await relationColOpts.getRelatedTable(
              refContext,
            );
            const childColumn = await relationColOpts.getChildColumn(
              childContext,
            );
            const parentColumn = await relationColOpts.getParentColumn(
              parentContext,
            );
            const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
              model: parentModel,
              dbDriver: knex,
            });
            refBaseModel = parentBaseModel;

            relQb = knex(
              knex.raw('?? AS ??', [
                parentBaseModel.getTnPath(parentModel),
                relTableAlias,
              ]),
            )
              .whereRaw(`??.?? = ??.??`, [
                relTableAlias,
                sanitize(parentColumn.column_name),
                rootAlias,
                sanitize(childColumn.column_name),
              ])
              .first();
            break;
          }
          case RelationTypes.HAS_MANY: {
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
            refBaseModel = childBaseModel;

            relQb = knex(
              knex.raw('?? AS ??', [
                childBaseModel.getTnPath(childModel),
                relTableAlias,
              ]),
            ).whereRaw(`??.?? = ??.??`, [
              relTableAlias,
              sanitize(childColumn.column_name),
              rootAlias,
              sanitize(parentColumn.column_name),
            ]);
            break;
          }
          case RelationTypes.ONE_TO_ONE: {
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
                parentContext,
                {
                  model: parentModel,
                  dbDriver: knex,
                },
              );
              refBaseModel = parentBaseModel;
              relQb = knex(
                knex.raw('?? AS ??', [
                  parentBaseModel.getTnPath(parentModel),
                  relTableAlias,
                ]),
              )
                .whereRaw(`??.?? = ??.??`, [
                  relTableAlias,
                  sanitize(parentColumn.column_name),
                  rootAlias,
                  sanitize(childColumn.column_name),
                ])
                .first();
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
              const childBaseModel = await Model.getBaseModelSQL(childContext, {
                model: childModel,
                dbDriver: knex,
              });
              refBaseModel = childBaseModel;
              relQb = knex(
                knex.raw('?? AS ??', [
                  childBaseModel.getTnPath(childModel),
                  relTableAlias,
                ]),
              )
                .whereRaw(`??.?? = ??.??`, [
                  relTableAlias,
                  sanitize(childColumn.column_name),
                  rootAlias,
                  sanitize(parentColumn.column_name),
                ])
                .first();
            }
            break;
          }
          default:
            qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
            return result;
        }

        const refSoftDeleteFilter = await getAliasedSoftDeleteFilter(
          refBaseModel,
          relTableAlias,
        );
        if (refSoftDeleteFilter) relQb.where(refSoftDeleteFilter);

        // Apply the Lookup column's "enable conditions" link-relation filters
        // to the relation CTE (parity with pg/mysql). Without this, Lookup
        // columns configured with conditions return unfiltered related values.
        await extractLinkRelFiltersAndApply({
          qb: relQb,
          column,
          alias: relTableAlias,
          table: refBaseModel.model,
          baseModel: refBaseModel,
          context: refBaseModel.context,
        });

        // Recursively extract the looked-up column onto relQb. After this, the
        // SELECT list of relQb has exactly one entry: `<expr> AS [<lookupId>]`.
        // (extractColumn handles formulas, LTARs, etc. recursively.)
        await this.extractColumn({
          column: lookupColumn,
          qb: relQb,
          rootAlias: relTableAlias,
          knex,
          getAlias,
          baseModel: refBaseModel,
          isLookup: true,
          ast,
          throwErrorIfInvalidParams,
          validateFormula,
          apiVersion,
        });

        // Replace the SELECT-list alias of the looked-up column with `[v]`
        // (sentinel) so the JSON output is `[{"v": …}]` — the mssql post-parse
        // step flattens that to `[…]` to match pg's flat-array shape.
        //
        // We can't easily mutate knex's SELECT-statements list portably, so we
        // instead build a wrapping subquery that picks the lookup-aliased
        // column under the `[v]` alias.
        const sentinelAlias = '_lkv';
        const lookupOutAlias = getAs(lookupColumn);
        const innerSql = relQb.toQuery().replaceAll('?', '\\?');

        // If the looked-up column itself emits JSON (lookup-of-LTAR /
        // lookup-of-lookup), the value in `relQb` is already a JSON nvarchar.
        // Wrap the inner SELECT pick with JSON_QUERY so the outer FOR JSON
        // PATH below inlines the JSON instead of string-escaping it. For
        // scalar lookups (lookup-of-Text/Number/etc.) JSON_QUERY would
        // return NULL — gate on the lookupColumn's UIType.
        const lookupTargetEmitsJson = [
          UITypes.LinkToAnotherRecord,
          UITypes.Lookup,
        ].includes(lookupColumn.uidt);
        const innerPickExpr = lookupTargetEmitsJson
          ? `JSON_QUERY(??.??)`
          : `??.??`;
        const wrapped = `SELECT ${innerPickExpr} AS ?? FROM (${innerSql}) AS ??`;

        // Outer JSON_QUERY: let a parent FOR JSON inline this Lookup's
        // payload instead of string-escaping. No-op at the top level.
        if (!result.isArray) {
          // single value (BT / OO / SingleTargetV2 MM): no array wrapper
          qb.select(
            knex.raw(
              `JSON_QUERY((${wrapped} FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES)) AS ??`,
              [
                relTableAlias,
                lookupOutAlias,
                sentinelAlias,
                relTableAlias,
                getAs(column),
              ],
            ),
          );
        } else {
          qb.select(
            knex.raw(
              `JSON_QUERY((${wrapped} FOR JSON PATH, INCLUDE_NULL_VALUES)) AS ??`,
              [
                relTableAlias,
                lookupOutAlias,
                sentinelAlias,
                relTableAlias,
                getAs(column),
              ],
            ),
          );
        }
        break;
      }

      case UITypes.Formula: {
        const model: Model = await column.getModel(context);
        const formula = await column.getColOptions<FormulaColumn>(context);
        if (formula.error) {
          qb.select(knex.raw(`'ERR' AS ??`, [getAs(column)]));
          return result;
        }
        try {
          const selectQb = await formulaQueryBuilderv2({
            baseModel,
            tree: formula.formula,
            model,
            column,
            tableAlias: rootAlias,
            validateFormula,
          });
          qb.select(knex.raw(`?? AS ??`, [selectQb.builder, getAs(column)]));
        } catch (e) {
          this.logger.log(e);
          qb.select(knex.raw(`'ERR' AS ??`, [getAs(column)]));
        }
        break;
      }

      case UITypes.Button: {
        const model: Model = await column.getModel(context);
        const buttonCol = await column.getColOptions<ButtonColumn>(context);
        if (buttonCol.type === ButtonActionsType.Url) {
          if (buttonCol.error) return result;
          const selectQb = await formulaQueryBuilderv2({
            baseModel,
            tree: buttonCol.formula,
            model,
            column,
            tableAlias: rootAlias,
            validateFormula,
          });
          // Build a single-row scalar FOR JSON object for the button payload.
          // Using a derived table because FOR JSON PATH needs a SELECT scope.
          // JSON_QUERY: lets a parent FOR JSON inline this payload if the
          // Button appears nested in an LTAR's children.
          qb.select(
            knex.raw(
              `JSON_QUERY(( SELECT ? AS [type], ? AS [label], ?? AS [url] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES )) AS ??`,
              [
                buttonCol.type,
                `${buttonCol.label}`,
                selectQb.builder,
                getAs(column),
              ],
            ),
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
            knex.raw(
              `JSON_QUERY(( SELECT ? AS [type], ? AS [label], ? AS [${key}] FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES )) AS ??`,
              [
                buttonCol.type,
                `${buttonCol.label}`,
                buttonCol[key],
                getAs(column),
              ],
            ),
          );
        }
        break;
      }

      case UITypes.Links:
        if (
          (params?.linksAsLtar === 'true' && apiVersion === NcApiVersion.V3) ||
          isBtLikeV2Junction(column)
        ) {
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
          });
        }
      // eslint-disable-next-line no-fallthrough -- Links without linksAsLtar falls through to Rollup (count)
      case UITypes.Rollup: {
        const rollupColOptions = await column.getColOptions(context);
        if (rollupColOptions.error) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }
        qb.select(
          (
            await genRollupSelectv2({
              baseModelSqlv2: baseModel,
              knex,
              columnOptions: rollupColOptions,
              alias: rootAlias,
            })
          ).builder.as(getAs(column)),
        );
        break;
      }

      case UITypes.Barcode: {
        const barcodeCol = await column.getColOptions<BarcodeColumn>(context);
        if (barcodeCol.error || !barcodeCol.fk_barcode_value_column_id) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }
        const barcodeValCol = await barcodeCol.getValueColumn(context);
        return this.extractColumn({
          column: new Column({ ...barcodeValCol, asId: column.id }),
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
          apiVersion,
        });
      }

      case UITypes.QrCode: {
        const qrCol = await column.getColOptions<QrCodeColumn>(context);
        if (qrCol.error || !qrCol.fk_qr_value_column_id) {
          qb.select(knex.raw(`? AS ??`, [NC_ERROR_SENTINEL, getAs(column)]));
          break;
        }
        const qrValCol = await qrCol.getValueColumn(context);
        return this.extractColumn({
          column: new Column({ ...qrValCol, asId: column.id }),
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
          apiVersion,
        });
      }

      case UITypes.Attachment: {
        // Stored as JSON in an nvarchar column; convertAttachmentType parses
        // the string client-side. No cast needed (mssql json type only landed
        // in SQL Server 2025; the column is nvarchar(max) in all live schemas).
        qb.select(
          knex.raw(`??.?? AS ??`, [
            rootAlias,
            sanitize(column.column_name),
            getAs(column),
          ]),
        );
        break;
      }

      case UITypes.CreatedTime:
      case UITypes.LastModifiedTime:
      case UITypes.DateTime: {
        const columnName = await getColumnName(context, column, columns);
        // Fetch datetimes in UTC. `AT TIME ZONE 'UTC'` normalizes the value:
        //  - datetime2 / datetime carry no offset → treated as already-UTC,
        //    so this is a no-op (the stored wall-clock is preserved).
        //  - datetimeoffset carries an offset → converted to UTC, so the read
        //    returns the true UTC instant (not the local wall-clock that plain
        //    `CONVERT(.., 120)` would emit, which drops the offset).
        // We then format to the offset-less `YYYY-MM-DD HH:mm:ss` shape
        // DateTimeMssqlHandler expects (it treats the string as UTC). Inside a
        // nested FOR JSON it stays a plain string (FOR JSON only auto-formats
        // native datetime types).
        qb.select(
          knex.raw(
            `CONVERT(VARCHAR(19), ??.?? AT TIME ZONE 'UTC', 120) AS ??`,
            [sanitize(rootAlias), sanitize(columnName), getAs(column)],
          ),
        );
        break;
      }

      case UITypes.CreatedBy:
      case UITypes.LastModifiedBy: {
        const columnName = await getColumnName(context, column, columns);
        qb.select(
          knex.raw(`??.?? AS ??`, [
            rootAlias,
            sanitize(columnName),
            getAs(column),
          ]),
        );
        break;
      }

      case UITypes.SingleSelect: {
        // T-SQL forbids `=` against the legacy text/ntext types, which
        // breaks `NULLIF(col, '')` (it desugars to a CASE-WHEN equality).
        // Pre-`nvarchar(MAX)` MssqlUi created SingleSelect as ntext, and
        // imported external sources can still surface either. CAST to
        // NVARCHAR(MAX) keeps the empty-string normalization working.
        const dt = (column.dt ?? '').toLowerCase();
        if (dt === 'text' || dt === 'ntext') {
          qb.select(
            knex.raw(`NULLIF(CAST(??.?? AS NVARCHAR(MAX)), '') AS ??`, [
              rootAlias,
              sanitize(column.column_name),
              getAs(column),
            ]),
          );
        } else {
          qb.select(
            knex.raw(`NULLIF(??.??, '') AS ??`, [
              rootAlias,
              sanitize(column.column_name),
              getAs(column),
            ]),
          );
        }
        break;
      }

      case UITypes.LongText: {
        if (baseModel.dbDriver.isExternal) {
          // T-SQL SUBSTRING is 1-indexed, length-bounded — mirrors the
          // mysql SUBSTR cap used to avoid pulling unbounded payloads.
          qb.select(
            knex.raw(`SUBSTRING(??.??, 1, ?) AS ??`, [
              rootAlias,
              sanitize(column.column_name),
              NC_MAX_TEXT_LENGTH,
              getAs(column),
            ]),
          );
          break;
        }
        // fall through to default
      }

      default: {
        qb.select(
          knex.raw(`??.?? AS ??`, [
            rootAlias,
            sanitize(column.column_name),
            getAs(column),
          ]),
        );
        break;
      }
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
  ): Promise<Record<string, any>> {
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
      baseModel?: IBaseModelSqlV2;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      skipPaginateWrapper?: boolean;
      skipSortBasedOnOrderCol?: boolean;
      ignoreViewFilterAndSort?: boolean;
    },
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  > {
    return singleQueryList(this, this.logger).list(context, ctx);
  }
}
