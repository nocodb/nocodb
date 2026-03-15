import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex, XKnex } from '~/db/CustomKnex';
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
    const rowQuery = `SELECT ${fields.map(() => `? as ??`).join(', ')}`;
    const fieldParams: any[] = [];
    for (const row of data) {
      for (const field of fields) {
        fieldParams.push(row[field]);
        fieldParams.push(field);
      }
    }
    return knex.raw(`(${data.map(() => rowQuery).join(' UNION ALL ')}) AS ??`, [
      ...fieldParams,
      alias,
    ]);
  }
  override async massUpdate({
    knex,
    tableName,
    data,
    updatingColumns,
    primaryKeyColumns,
  }: {
    knex: Knex;
    tableName: string | Knex.Raw<any>;
    data: Record<string, any>[];
    updatingColumns: string[];
    primaryKeyColumns: string[];
  }): Promise<undefined> {
    if (!data.length) return null;

    // generate the update objects
    const updatingInfo = this.massUpdateGenerateTempTable({
      data,
      updatingColumns,
      primaryKeyColumns,
    });

    if (!updatingInfo.data.length) return null;

    // Prepare all fields for temporary table: PKs + columns + flags
    const tempFields = [
      ...primaryKeyColumns,
      ...updatingInfo.updatingColumns,
      ...updatingInfo.updatingColumns.map((col) => `__upd__${col}`),
    ];

    // Generate temporary table raw SQL
    const tempTableRaw = this.temporaryTableRaw({
      knex,
      data: updatingInfo.data,
      fields: tempFields,
      alias: '_src',
    });

    // Build primary key matching condition
    const pkMatchConditions = primaryKeyColumns.map(() => `?? = ??`);
    const pkMatchParams = primaryKeyColumns.flatMap((pk) => [
      typeof tableName === 'string' ? `${tableName}.${pk}` : pk,
      `_src.${pk}`,
    ]);

    // Database-specific query construction
    // SQLite: UPDATE table SET col = (SELECT ... FROM ... WHERE ...) WHERE EXISTS (...)
    // More complex - each column needs a subquery
    const setSubqueries = updatingInfo.updatingColumns.map((col) =>
      knex.raw(
        `?? = (SELECT CASE ?? WHEN ? THEN ?? ELSE ?? END FROM ${tempTableRaw.toString()} WHERE ${pkMatchConditions.join(
          ' AND ',
        )})`,
        [
          col,
          `_src.__upd__${col}`,
          1, // SQLite uses 1 for true
          `_src.${col}`,
          col,
          ...pkMatchParams,
        ],
      ),
    );
    const existsCondition = knex.raw(
      `EXISTS (SELECT 1 FROM ${tempTableRaw.toString()} WHERE ${pkMatchConditions.join(
        ' AND ',
      )})`,
      pkMatchParams,
    );
    const updateQuery: Knex.Raw = knex.raw(
      `UPDATE ?? SET ${setSubqueries
        .map((sq) => sq.toString())
        .join(', ')} WHERE ${existsCondition.toString()}`,
      [tableName],
    );

    await updateQuery;
  }
}
