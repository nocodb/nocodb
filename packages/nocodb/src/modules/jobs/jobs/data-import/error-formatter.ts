import { DBErrorExtractor } from '~/helpers/db-error/extractor';

/**
 * Translate a thrown DB-driver error into a short, user-facing reason that
 * makes sense in an import toast.
 *
 * Delegates to the central DBErrorExtractor (also used by the global
 * exception filter and the formula query builder) so the messaging stays
 * consistent across the codebase. Adds one CSV-import-specific touch on
 * top: when the extractor couldn't pin down a column but Postgres embedded
 * the offending value in the message (e.g. `numeric: "$500.00"`), we match
 * that value back to the row dict to name the column.
 */

/**
 * Best-effort column extraction from raw driver text — Postgres reports
 * "column \"event_date\"", MySQL reports "column `event_date`", SQLite
 * sometimes uses single quotes.
 */
function extractColumnFromMessage(msg: string): string | undefined {
  const m =
    msg.match(/column "([^"]+)"/i) ||
    msg.match(/column `([^`]+)`/i) ||
    msg.match(/column '([^']+)'/i);
  return m?.[1];
}

/**
 * When the extractor returns a value-only message (e.g.
 * `Invalid value '$500.00' for type 'numeric'`), match that value back to
 * the row to find which column held it. Postgres often doesn't include
 * the column in the SQLSTATE; the row dict does.
 */
function extractColumnFromRowMatch(
  msg: string,
  row: Record<string, unknown> | undefined,
): string | undefined {
  if (!row) return undefined;
  // Both extractor output (`'$500.00'`) and raw PG text (`"$500.00"`) embed
  // the bad value in quotes; accept either flavour.
  const quoted = msg.match(/['"]([^'"]+)['"]/);
  if (!quoted) return undefined;
  const needle = quoted[1];
  for (const [col, val] of Object.entries(row)) {
    if (val === undefined || val === null) continue;
    if (String(val) === needle) return col;
  }
  return undefined;
}

export function describeRowError(
  err: unknown,
  row?: Record<string, unknown>,
): string {
  if (!err || typeof err !== 'object') return 'Database rejected the row';

  const extracted = DBErrorExtractor.get().extractDbError(err, {
    ignoreDefault: true,
  });

  const baseMessage =
    typeof extracted?.message === 'string' && extracted.message
      ? extracted.message
      : 'Database rejected the row';

  // Walk through the column-name signals in order of reliability:
  //   1. driver-supplied `err.column` (PG/MySQL set this on some errors)
  //   2. column extracted by DBErrorExtractor into `details.column`
  //   3. quoted column name in the raw or extracted message
  //   4. value embedded in message → match against the row dict
  const driverColumn =
    typeof (err as { column?: unknown }).column === 'string'
      ? (err as { column: string }).column
      : undefined;
  const extractorColumn =
    extracted?.details &&
    typeof (extracted.details as { column?: unknown }).column === 'string'
      ? (extracted.details as { column: string }).column
      : undefined;
  const rawMsg =
    typeof (err as { message?: unknown }).message === 'string'
      ? ((err as { message?: unknown }).message as string)
      : '';
  const messageColumn =
    extractColumnFromMessage(baseMessage) || extractColumnFromMessage(rawMsg);

  const column =
    driverColumn ||
    extractorColumn ||
    messageColumn ||
    extractColumnFromRowMatch(baseMessage, row) ||
    extractColumnFromRowMatch(rawMsg, row);

  if (!column) return baseMessage;

  // If the message already references the column by name, don't repeat it.
  if (baseMessage.includes(column)) return baseMessage;

  return `${baseMessage} (column: ${column})`;
}
