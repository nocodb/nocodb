import { ClientType } from 'nocodb-sdk';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
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
    return `CAST(${field} AS ${asType})`;
  }

  generateAggregateQuery(params: AggregationGeneratorParams) {
    return genMssqlAggregateQuery(params);
  }

  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw {
    const knex = baseModel.dbDriver;
    // T-SQL has no JSON_OBJECT. Select each aggregate as a named column and
    // append `FOR JSON PATH, WITHOUT_ARRAY_WRAPPER` to the tQb SELECT — as a
    // scalar subquery the result is a single `{...}` string (NOT chunked
    // across rows, which is the top-level FOR JSON behaviour). The caller's
    // `execAndParse({ bulkAggregate: true })` parses it automatically.
    tQb.select(
      knex.raw(
        Object.keys(expressions)
          .map((k) => `${expressions[k]} as [${k}]`)
          .join(', '),
      ),
    );
    return knex.raw('(?? FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) as ??', [
      tQb,
      alias,
    ]);
  }
}
