import { ClientType } from 'nocodb-sdk';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';
import { genMysql2AggregatedQuery } from '~/dbQueryClient/aggregations/mysql2';

export class MySqlDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.MYSQL;
  }
  validateClientType(client: string) {
    if (!['mysql', 'mysql2'].includes(client)) {
      throw new Error('Source is not ' + this.clientType);
    }
  }

  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }
  simpleCast(field: string, asType: string) {
    const useAsType = asType.toUpperCase() === 'TEXT' ? 'CHAR' : asType;
    return `CAST(${field} as ${useAsType})`;
  }

  generateAggregateQuery(params: AggregationGeneratorParams) {
    return genMysql2AggregatedQuery(params);
  }

  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw {
    const knex = baseModel.dbDriver;
    const jsonBuildObject = knex.raw(`JSON_UNQUOTE(JSON_OBJECT(
      ${Object.keys(expressions)
        .map((k) => `'${k}', ${expressions[k]}`)
        .join(', ')}))`);
    // Run the aggregates over the FILTERED `tQb` as a scalar subquery so the
    // per-bucket / selection `where` (carried on tQb) is honored — mirrors the
    // pg path. The previous form embedded the bare JSON_OBJECT over the outer
    // (unfiltered) query, so per-bucket filters were silently ignored on MySQL.
    // `limit(1)`: median/attachment-size are non-aggregate scalar subqueries
    // (unlike pg's aggregate percentile_cont), so without it the wrapped SELECT
    // returns one row per filtered row → "subquery returns more than 1 row".
    tQb.select(jsonBuildObject).limit(1);
    return knex.raw('(??) as ??', [tQb, alias]);
  }
}
