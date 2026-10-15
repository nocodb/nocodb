import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { XKnex } from '~/db/CustomKnex';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

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

  // MySQL has no bare `(VALUES (…))` table (8.0.19+ needs `VALUES ROW(…)`), so
  // the generic form is a parse error; UNION ALL works on every MySQL/MariaDB.
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
    const firstRow = `SELECT ${fields.map(() => '? AS ??').join(', ')}`;
    const restRow = `SELECT ${fields.map(() => '?').join(', ')}`;
    const sql = data.map((_, i) => (i === 0 ? firstRow : restRow));
    const bindings: any[] = [];
    data.forEach((row, rowIndex) => {
      for (const field of fields) {
        bindings.push(row[field]);
        if (rowIndex === 0) bindings.push(field);
      }
    });
    bindings.push(alias);
    return knex.raw(`(${sql.join(' UNION ALL ')}) AS ??`, bindings);
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
