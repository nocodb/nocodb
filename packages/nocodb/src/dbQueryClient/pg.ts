import { ClientType } from 'nocodb-sdk';
import debug from 'debug';
import type { Knex } from 'knex';
import type { DBQueryClient } from '~/dbQueryClient/types';
import { GenericDBQueryClient } from '~/dbQueryClient/generic';

const debugPGDBQueryClient = debug('nc:db:query:PGDBQueryClient');

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
        col,
        `_src.__upd__${col}`,
        true,
        `_src.${col}`,
        typeof tableName === 'string' ? `${tableName}.${col}` : col,
      ]);
    });

    // Database-specific query construction

    const setClause = setStatements.map((stmt) => stmt.toString()).join(', ');
    // PostgreSQL: UPDATE table SET ... FROM (...) WHERE ...
    const updateQuery: Knex.Raw = knex.raw(
      `UPDATE ?? SET ${setClause} FROM ${tempTableRaw.toString()} WHERE ${pkMatchConditions.join(
        ' AND ',
      )}`,
      [tableName, ...pkMatchParams],
    );
    debugPGDBQueryClient(updateQuery.toQuery());
    await updateQuery;
  }
}
