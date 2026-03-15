import { ClientType } from 'nocodb-sdk';
import type { DBQueryClient } from '~/dbQueryClient/types';
import type { Knex, XKnex } from '~/db/CustomKnex';
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

    // Build SET clause with CASE statements
    const setStatements = updatingInfo.updatingColumns.map((col) => {
      // Use 1/0 for boolean comparison (works across all DBs)
      return knex.raw(`?? = CASE ?? WHEN ? THEN ?? ELSE ?? END`, [
        typeof tableName === 'string' ? `${tableName}.${col}` : col,
        `_src.__upd__${col}`,
        true,
        `_src.${col}`,
        typeof tableName === 'string' ? `${tableName}.${col}` : col,
      ]);
    });

    // Database-specific query construction

    const setClause = setStatements.map((stmt) => stmt.toString()).join(', ');
    // MySQL: UPDATE table INNER JOIN (...) ON ... SET ...
    const updateQuery: Knex.Raw = knex.raw(
      `UPDATE ?? INNER JOIN ${tempTableRaw.toString()} ON ${pkMatchConditions.join(
        ' AND ',
      )} SET ${setClause}`,
      [tableName, ...pkMatchParams],
    );

    await updateQuery;
  }
}
