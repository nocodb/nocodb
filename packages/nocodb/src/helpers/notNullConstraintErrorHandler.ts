import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { NcError } from '~/helpers/ncError';

/**
 * Extract the physical column name from a driver not-null violation, or
 * undefined if the error is not one.
 */
export function extractNotNullColumnName(error: any): string | undefined {
  if (!error) return;

  const message = typeof error.message === 'string' ? error.message : '';

  // PG 23502: `null value in column "X" of relation "Y" violates not-null constraint`
  if (error.code === '23502') {
    return (
      error.column ?? message.match(/null value in column "([^"]+)"/i)?.[1]
    );
  }

  const match =
    // MySQL ER_NO_DEFAULT_FOR_FIELD: `Field 'X' doesn't have a default value`
    message.match(/Field '([^']+)' doesn't have a default value/i) ||
    // MySQL ER_BAD_NULL_ERROR: `Column 'X' cannot be null`
    message.match(/Column '([^']+)' cannot be null/i) ||
    // SQLite: `NOT NULL constraint failed: table.X`
    message.match(/NOT NULL constraint failed: (?:[^\s.]+\.)?([^\s]+)/i) ||
    // MSSQL 515: `Cannot insert the value NULL into column 'X', table ...`
    message.match(/Cannot insert the value NULL into column '([^']+)'/i);

  return match?.[1];
}

/**
 * Converts a database not-null violation into a bad request naming the field
 * by its title. Does nothing if the error is not a not-null violation or the
 * column cannot be resolved, so the caller can rethrow the original error.
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

  const columns = await baseModel.model.getColumns();
  const column =
    columns.find((c) => c.column_name === columnName) ??
    columns.find(
      (c) => c.column_name?.toLowerCase() === columnName.toLowerCase(),
    );
  if (!column) return;

  NcError.badRequest(`A value is required for field '${column.title}'.`);
}
