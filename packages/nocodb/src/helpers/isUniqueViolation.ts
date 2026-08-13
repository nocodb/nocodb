const UNIQUE_VIOLATION_CODES = new Set<string | number>([
  '23505', // postgres
  23505,
  'ER_DUP_ENTRY', // mysql
  1062,
  'SQLITE_CONSTRAINT_UNIQUE',
  2627, // mssql — unique constraint
  2601, // mssql — unique index
]);

/**
 * True if a driver error is a unique-constraint violation.
 *
 * Knex surfaces the native error differently per driver and wraps it at
 * different depths, so check every shape rather than one dialect's. tedious puts
 * the SQL Server number on `.number` (`.code` is always `'EREQUEST'`), and emits
 * an AggregateError over `.errors` when a statement raises more than one.
 */
export function isUniqueViolation(e: any): boolean {
  if (!e) return false;

  const candidates = [
    e,
    e.original,
    e.nativeError,
    e.originalError,
    ...(Array.isArray(e.errors) ? e.errors : []),
  ];

  for (const err of candidates) {
    if (!err) continue;
    if (
      UNIQUE_VIOLATION_CODES.has(err.code) ||
      UNIQUE_VIOLATION_CODES.has(err.number) ||
      UNIQUE_VIOLATION_CODES.has(err.errno) ||
      UNIQUE_VIOLATION_CODES.has(err.info?.number)
    ) {
      return true;
    }
  }

  // A bare SQLITE_CONSTRAINT covers NOT NULL / FK / CHECK too, so it only counts
  // alongside the message — which sqlite3 always carries for a real violation.
  const msg = String(e.message ?? '');
  return /UNIQUE constraint failed|duplicate key value|Cannot insert duplicate key/i.test(
    msg,
  );
}
