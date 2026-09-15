// Driver error classification for "this object/column is already there".
//
// Knex surfaces the native error differently per driver and wraps it at
// different depths, so check every shape rather than one dialect's — the same
// reasoning as isUniqueViolation. tedious puts the SQL Server number on
// `.number` (`.code` is always `'EREQUEST'`) and emits an AggregateError over
// `.errors`; oracledb puts the ORA number on `.errorNum`.

const DUPLICATE_OBJECT_CODES = new Set<string | number>([
  '42P07', // postgres — duplicate_table
  'ER_TABLE_EXISTS_ERROR', // mysql
  1050, // mysql
  2714, // mssql — "There is already an object named '...' in the database"
  955, // oracle — ORA-00955 "name is already used by an existing object"
]);

const DUPLICATE_COLUMN_CODES = new Set<string | number>([
  '42701', // postgres — duplicate_column
  'ER_DUP_FIELDNAME', // mysql
  1060, // mysql
  2705, // mssql — "Column names in each table must be unique"
  1430, // oracle — ORA-01430 "column being added already exists in table"
]);

// sqlite3 carries no useful code for either case (a bare SQLITE_ERROR covers
// every DDL failure), so it is matched on the message alone.
const DUPLICATE_OBJECT_MESSAGE =
  /already exists|already an object named|name is already used by an existing object/i;
const DUPLICATE_COLUMN_MESSAGE =
  /duplicate column name|column names in each table must be unique|column being added already exists/i;

function candidates(e: any): any[] {
  return [
    e,
    e.original,
    e.nativeError,
    e.originalError,
    ...(Array.isArray(e.errors) ? e.errors : []),
  ];
}

function hasCode(e: any, codes: Set<string | number>): boolean {
  for (const err of candidates(e)) {
    if (!err) continue;
    if (
      codes.has(err.code) ||
      codes.has(err.number) ||
      codes.has(err.errno) ||
      codes.has(err.errorNum) ||
      codes.has(err.info?.number)
    ) {
      return true;
    }
  }
  return false;
}

/** True if a driver error says the table/view already exists. */
export function isDuplicateObjectError(e: any): boolean {
  if (!e) return false;
  if (hasCode(e, DUPLICATE_OBJECT_CODES)) return true;
  // Guard the message fallback: a duplicate *column* on mssql/sqlite also says
  // "already exists", and must not be read as a duplicate table.
  if (hasCode(e, DUPLICATE_COLUMN_CODES)) return false;
  const msg = String(e.message ?? '');
  return (
    DUPLICATE_OBJECT_MESSAGE.test(msg) && !DUPLICATE_COLUMN_MESSAGE.test(msg)
  );
}

/** True if a driver error says the column already exists on the table. */
export function isDuplicateColumnError(e: any): boolean {
  if (!e) return false;
  if (hasCode(e, DUPLICATE_COLUMN_CODES)) return true;
  if (hasCode(e, DUPLICATE_OBJECT_CODES)) return false;
  return DUPLICATE_COLUMN_MESSAGE.test(String(e.message ?? ''));
}
