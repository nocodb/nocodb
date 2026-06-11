import { ClientType } from 'nocodb-sdk';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';
import { genSqlite3AggregateQuery } from '~/dbQueryClient/aggregations/sqlite3';

export class SqliteDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.SQLITE;
  }
  concat(fields: string[]) {
    return `${fields.join(' || ')}`;
  }
  simpleCast(field: string, asType: string) {
    return `CAST(${field} as ${asType})`;
  }

  generateAggregateQuery(params: AggregationGeneratorParams) {
    return genSqlite3AggregateQuery(params);
  }

  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw {
    const knex = baseModel.dbDriver;
    const jsonBuildObject = knex.raw(`json_object(
        ${Object.keys(expressions)
          .map((k) => `'${k}', ${expressions[k]}`)
          .join(', ')})`);
    tQb.select(jsonBuildObject);
    return knex.raw('(??) as ??', [tQb, alias]);
  }

  replaceDelimitedWithKeyValue(params: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }): string {
    const delimiter = params.delimiter ?? ',';
    const knex = params.knex;

    if (!params.stack || params.stack.length === 0) {
      return knex.raw(`??`, [params.needleColumn]).toQuery();
    }

    const mapUnion = params.stack
      .map((row) =>
        knex
          .raw(`select ? as nc_p_key, ? as nc_p_value`, [row.key, row.value])
          .toQuery(),
      )
      .join(' UNION ALL ');

    const needleAsRows = knex
      .raw(
        `select ?? as nc_raw_needle, nc_t_stack_1.value as nc_p_needle from (json_each('["' || replace(??, '${delimiter}', ?) || '"]')) nc_t_stack_1`,
        [params.needleColumn, params.needleColumn, `"${delimiter}"`],
      )
      .toQuery();

    return knex
      .raw(
        [
          `select nc_p_result from (`,
          `  select nc_t_needle.nc_raw_needle, GROUP_CONCAT(coalesce(nc_t_stack.nc_p_value, nc_t_stack.nc_p_key), '${delimiter}') as nc_p_result`,
          `  from (${needleAsRows}) nc_t_needle`,
          `  left join (${mapUnion}) nc_t_stack`,
          `    on nc_t_needle.nc_p_needle = nc_t_stack.nc_p_key`,
          `  group by nc_t_needle.nc_raw_needle`,
          `) nc_subquery`,
        ].join(' '),
      )
      .toQuery();
  }
}
