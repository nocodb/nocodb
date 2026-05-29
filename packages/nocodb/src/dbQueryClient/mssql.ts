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
}
