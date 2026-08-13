/**
 * True if a driver error is a unique-constraint violation.
 *
 * Knex surfaces the native error differently per driver and wraps it at
 * different depths, so check every shape rather than one dialect's.
 */
export function isUniqueViolation(e: any): boolean {
  if (!e) return false;

  const code =
    e.code ??
    e.original?.code ??
    e.nativeError?.code ??
    e.errno ??
    e.original?.errno ??
    e.nativeError?.errno;

  if (
    code === '23505' || // postgres
    code === 23505 ||
    code === 'ER_DUP_ENTRY' || // mysql
    code === 1062 ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT' ||
    code === 2627 || // mssql — unique constraint
    code === 2601 // mssql — unique index
  ) {
    return true;
  }

  const msg = String(e.message ?? '');
  return /UNIQUE constraint failed|duplicate key value|Cannot insert duplicate key/i.test(
    msg,
  );
}
