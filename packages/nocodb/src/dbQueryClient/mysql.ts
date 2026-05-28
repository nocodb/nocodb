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
    const jsonBuildObject = knex.raw(`JSON_OBJECT(
      ${Object.keys(expressions)
        .map((k) => `'${k}', ${expressions[k]}`)
        .join(', ')})`);
    tQb.select(jsonBuildObject);
    // MySQL: the JSON_OBJECT raw is used directly with JSON_UNQUOTE — the
    // jsonBuildObject embedding (rather than wrapping tQb) matches the
    // legacy bulkAggregate path exactly.
    return knex.raw('JSON_UNQUOTE(??) as ??', [jsonBuildObject, alias]);
  }
}
