import { ClientType } from 'nocodb-sdk';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Model } from '~/models';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';
import { genMssqlAggregateQuery } from '~/dbQueryClient/aggregations/mssql';

export class MssqlDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
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
    // T-SQL has no JSON_OBJECT. Select each aggregate as a named column and
    // wrap with `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER` — as a scalar subquery
    // the result is a single `{...}` string. The caller's
    // `execAndParse({ bulkAggregate: true })` parses it automatically.
    //
    // TOP 1 + derived-table wrap is required because the inner expressions
    // may be non-aggregating (median uses a scalar subquery, attachment_size
    // uses CROSS APPLY) — when no real SQL aggregate appears in the outer
    // SELECT, MSSQL evaluates the projection per FROM-row, returning N
    // identical rows. FOR JSON would then concatenate N objects into a
    // malformed `{...}{...}{...}` string instead of a single `{...}`. All
    // rows carry the same scalar values, so picking one with TOP 1 is safe.
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
}
