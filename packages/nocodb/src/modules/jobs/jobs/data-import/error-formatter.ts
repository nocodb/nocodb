/**
 * Translate a thrown DB-driver error into a short, user-facing reason that
 * makes sense in an import toast. Raw driver text ("invalid input syntax
 * for type numeric") leaks SQL jargon and isn't actionable to a non-DBA
 * user; we map the common Postgres SQLSTATE codes (and MySQL error numbers)
 * to something a person can read.
 *
 * Pulled into its own module so importing it from a unit test doesn't drag
 * the whole jobs / NestJS module graph along.
 */

interface DbDriverError {
  code?: unknown;
  errno?: unknown;
  message?: unknown;
  column?: unknown;
}

/**
 * Best-effort column extraction from raw driver text — Postgres reports
 * "column \"event_date\"", MySQL reports "column `event_date`", SQLite
 * sometimes uses single quotes.
 */
function extractColumn(msg: string): string | undefined {
  const m =
    msg.match(/column "([^"]+)"/i) ||
    msg.match(/column `([^`]+)`/i) ||
    msg.match(/column '([^']+)'/i);
  return m?.[1];
}

/**
 * Postgres often embeds the offending VALUE in error text (e.g. `invalid
 * input syntax for type numeric: "$500.00"`) but not the column name. When
 * we have the row that triggered the error we can match the value back to
 * find which column held it.
 */
function extractColumnFromRowMatch(
  msg: string,
  row: Record<string, unknown> | undefined,
): string | undefined {
  if (!row) return undefined;
  // Pull any double-quoted value out of the message — Postgres uses double
  // quotes to wrap the offending value in most "value-included" errors.
  const quoted = msg.match(/: "([^"]+)"/);
  if (!quoted) return undefined;
  const needle = quoted[1];
  for (const [col, val] of Object.entries(row)) {
    if (val === undefined || val === null) continue;
    if (String(val) === needle) return col;
  }
  return undefined;
}

/** Append "(column: name)" when we know the column — keeps the toast
 *  short but actionable. */
function withColumn(reason: string, column?: string): string {
  return column ? `${reason} (column: ${column})` : reason;
}

export function describeRowError(
  err: unknown,
  row?: Record<string, unknown>,
): string {
  if (!err || typeof err !== 'object') return 'Database rejected the row';

  const e = err as DbDriverError;
  const rawMsg = typeof e.message === 'string' ? e.message : '';
  const colHint =
    (typeof e.column === 'string' && e.column ? e.column : undefined) ||
    extractColumn(rawMsg) ||
    extractColumnFromRowMatch(rawMsg, row);

  // Postgres SQLSTATE — these are the ones we hit on CSV import.
  // Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (typeof e.code === 'string') {
    switch (e.code) {
      case '22001':
        return withColumn('Value is too long for the column', colHint);
      case '22003':
        return withColumn('Number is out of range for the column', colHint);
      case '22007':
      case '22008':
        return withColumn('Invalid date or time value', colHint);
      case '22P02':
        return withColumn('Value does not match the column type', colHint);
      case '23502':
        return withColumn('Required column is empty', colHint);
      case '23503':
        return 'Referenced record does not exist';
      case '23505':
        return withColumn(
          'Duplicate value violates a unique constraint',
          colHint,
        );
      case '23514':
        return 'Value violates a check constraint';
    }
  }

  // MySQL — knex preserves the numeric `errno` alongside `.code`.
  const errno = typeof e.errno === 'number' ? e.errno : undefined;
  if (errno !== undefined) {
    switch (errno) {
      case 1062:
        return withColumn(
          'Duplicate value violates a unique constraint',
          colHint,
        );
      case 1264:
        return withColumn('Number is out of range for the column', colHint);
      case 1265: // WARN_DATA_TRUNCATED — strict mode promotes to error
      case 1406:
        return withColumn('Value is too long for the column', colHint);
      case 1292:
        return withColumn('Invalid date or time value', colHint);
      case 1366:
        return withColumn('Value does not match the column type', colHint);
      case 1048:
        return withColumn('Required column is empty', colHint);
      case 1452:
        return 'Referenced record does not exist';
    }
  }

  // Last-resort pattern match on the raw message — handles SQLite (no useful
  // error codes) and anything else we haven't enumerated above.
  if (rawMsg) {
    if (/not[- ]?null|null value in column|cannot be null/i.test(rawMsg))
      return withColumn('Required column is empty', colHint);
    if (/duplicate|unique constraint/i.test(rawMsg))
      return withColumn(
        'Duplicate value violates a unique constraint',
        colHint,
      );
    if (/foreign key|references/i.test(rawMsg))
      return 'Referenced record does not exist';
    if (/check constraint/i.test(rawMsg))
      return 'Value violates a check constraint';
    if (/too long|truncat/i.test(rawMsg))
      return withColumn('Value is too long for the column', colHint);
    if (/out of range/i.test(rawMsg))
      return withColumn('Number is out of range for the column', colHint);
    if (
      /date|time|timestamp/i.test(rawMsg) &&
      /invalid|out of range|format/i.test(rawMsg)
    )
      return withColumn('Invalid date or time value', colHint);
    if (/invalid input syntax|incorrect.*value|invalid.*format/i.test(rawMsg))
      return withColumn('Value does not match the column type', colHint);
  }

  // Nothing matched. Don't leak raw SQL text — give a generic line.
  return colHint
    ? `Database rejected the row (column: ${colHint})`
    : 'Database rejected the row';
}
