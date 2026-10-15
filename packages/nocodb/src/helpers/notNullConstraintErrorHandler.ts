import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { NcError } from '~/helpers/catchError';

const ORACLE_NOT_NULL_CODES = new Set(['ORA-01400', 'ORA-01407']);

/**
 * Physical column name from a driver not-null violation, or undefined when the
 * error is not one. Gated on the driver code so a message that merely quotes
 * user data cannot match.
 */
export function extractNotNullColumnName(error: any): string | undefined {
  if (!error || typeof error !== 'object') return;

  const code = error.code !== undefined ? String(error.code) : undefined;
  const message = typeof error.message === 'string' ? error.message : '';

  // pg: null value in column "X" of relation "Y" violates not-null constraint
  if (code === '23502') {
    return error.column || message.match(/null value in column "([^"]+)"/)?.[1];
  }

  // mysql: Field 'X' doesn't have a default value
  if (code === 'ER_NO_DEFAULT_FOR_FIELD') {
    return message.match(/Field '([^']+)' doesn't have a default value/)?.[1];
  }

  // mysql: Column 'X' cannot be null
  if (code === 'ER_BAD_NULL_ERROR') {
    return message.match(/Column '([^']+)' cannot be null/)?.[1];
  }

  // sqlite: NOT NULL constraint failed: table.X
  if (code === 'SQLITE_CONSTRAINT') {
    return message.match(
      /NOT NULL constraint failed: (?:\S+\.)?([^\s.]+)/,
    )?.[1];
  }

  // mssql: Cannot insert the value NULL into column 'X', table '...'
  if (error.number === 515) {
    return message.match(
      /Cannot insert (?:the )?value NULL into column '([^']+)'/i,
    )?.[1];
  }

  // oracle: ORA-01400 cannot insert NULL into ("S"."T"."X"), ORA-01407 on update
  if (
    (code && ORACLE_NOT_NULL_CODES.has(code)) ||
    error.errorNum === 1400 ||
    error.errorNum === 1407
  ) {
    return message.match(/\("[^"]+"\."[^"]+"\."([^"]+)"\)/)?.[1];
  }
}

/**
 * Table the driver reports for the violation, when it reports one (pg, oracle).
 */
export function extractNotNullTableName(error: any): string | undefined {
  if (!error || typeof error !== 'object') return;
  if (typeof error.table === 'string' && error.table) return error.table;

  const message = typeof error.message === 'string' ? error.message : '';
  return message.match(/\("[^"]+"\."([^"]+)"\."[^"]+"\)/)?.[1];
}

/**
 * Rethrows a driver not-null violation as a required-field error naming the
 * field by its title. No-op otherwise, so the caller rethrows the original.
 */
export async function handleNotNullConstraintError({
  error,
  baseModel,
}: {
  error: any;
  baseModel: IBaseModelSqlV2;
}): Promise<void> {
  const columnName = extractNotNullColumnName(error);
  if (!columnName) return;

  // The write may have hit a linked table (nested-link ops) with a same-named column.
  const tableName = extractNotNullTableName(error);
  if (
    tableName &&
    tableName.toLowerCase() !== baseModel.model.table_name?.toLowerCase()
  )
    return;

  const columns = await baseModel.model.getColumns();
  const column =
    columns.find((c) => c.column_name === columnName) ??
    columns.find(
      (c) => c.column_name?.toLowerCase() === columnName.toLowerCase(),
    );
  if (!column?.title) return;

  NcError.get(baseModel.context).requiredFieldMissing(column.title);
}
