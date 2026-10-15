import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import type { XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

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

  // SQLite rejects the generic `AS alias (cols)` column list; a bare VALUES
  // names its columns column1…N, so rename them in an outer SELECT. VALUES is
  // not bound by the 500-term compound-SELECT limit a UNION ALL chain hits.
  temporaryTableRaw({
    knex,
    data,
    fields,
    alias,
  }: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }) {
    const columns = fields.map((_, i) => `column${i + 1} AS ??`).join(', ');
    const row = `(${fields.map(() => '?').join(', ')})`;
    const values = data.map(() => row).join(', ');
    return knex.raw(`(SELECT ${columns} FROM (VALUES ${values})) AS ??`, [
      ...fields,
      ...data.flatMap((r) => fields.map((field) => r[field])),
      alias,
    ]);
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

    // `json_each.key` is the id's position in the delimited cell; carry it
    // through so the GROUP_CONCAT below can pin the concatenation order.
    // Without an explicit ORDER BY the aggregate order is whatever the join
    // emits — non-deterministic, and it shifts whenever the `stack`
    // (base-user list) changes size/order, silently corrupting User/CreatedBy
    // sort & filter results.
    const needleAsRows = knex
      .raw(
        `select ?? as nc_raw_needle, nc_t_stack_1.value as nc_p_needle, nc_t_stack_1.key as nc_p_ord from (json_each('["' || replace(??, '${delimiter}', ?) || '"]')) nc_t_stack_1`,
        [params.needleColumn, params.needleColumn, `"${delimiter}"`],
      )
      .toQuery();

    return knex
      .raw(
        [
          `select nc_p_result from (`,
          `  select nc_t_needle.nc_raw_needle, GROUP_CONCAT(coalesce(nc_t_stack.nc_p_value, nc_t_stack.nc_p_key), '${delimiter}' order by nc_t_needle.nc_p_ord) as nc_p_result`,
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
