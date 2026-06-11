import { ClientType } from 'nocodb-sdk';
import type {
  AggregationGeneratorParams,
  DBQueryClient,
} from '~/dbQueryClient/types';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';
import { genPgAggregateQuery } from '~/dbQueryClient/aggregations/pg';

export class PGDBQueryClient
  extends GenericDBQueryClient
  implements DBQueryClient
{
  get clientType(): ClientType {
    return ClientType.PG;
  }

  concat(fields: string[]) {
    return `CONCAT(${fields.join(', ')})`;
  }

  simpleCast(field: string, asType: string) {
    return `${field}::${asType}`;
  }

  generateAggregateQuery(params: AggregationGeneratorParams) {
    return genPgAggregateQuery(params);
  }

  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw {
    const knex = baseModel.dbDriver;
    const jsonBuildObject = knex.raw(
      `JSON_BUILD_OBJECT(${Object.keys(expressions)
        .map((k) => `'${k}', ${expressions[k]}`)
        .join(', ')})`,
    );
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
        `select ?? as nc_raw_needle, trim(unnest(string_to_array(??, '${delimiter}'))) as nc_p_needle`,
        [params.needleColumn, params.needleColumn],
      )
      .toQuery();

    return knex
      .raw(
        [
          `select nc_p_result from (`,
          `  select nc_t_needle.nc_raw_needle, string_agg(coalesce(nc_t_stack.nc_p_value, nc_t_stack.nc_p_key), '${delimiter}') as nc_p_result`,
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
