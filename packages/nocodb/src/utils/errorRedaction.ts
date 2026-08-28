import { LRUMap } from '~/utils/LRUMap';

/**
 * knex builds `err.message = formatQuery(sql, bindings) + ' - ' + err.message`,
 * inlining binding *values*. Any driver error carrying a compiled statement
 * therefore carries customer row data (`… where "email" = 'alice@x.com'`), so
 * it must be masked before the message leaves the box — Sentry and the
 * priority-error telemetry sink are both third-party processors.
 *
 * Identifiers are left intact: they are schema metadata, and without them the
 * exported statement is useless for diagnosing the defect that produced it.
 */
const SQL_STRING_LITERAL = /[eEnN]?'(?:[^'\\]|\\.|'')*'/g;
const SQL_HEX_LITERAL = /\b0x[0-9a-fA-F]+/g;
// skip `$1`-style placeholders and digits inside identifiers (`nc_tbl_1`)
const SQL_NUMERIC_LITERAL =
  /(?<![\w$."'`])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w"'`])/g;
// collapse `?, ?, ?` so a 500-row insert groups with its 1-row sibling
const PLACEHOLDER_RUN = /\?(?:\s*,\s*\?)+/g;

const STACK_FIRST_FRAME = /\n\s*at\s/;

export function redactSqlLiterals<T extends string | undefined | null>(
  message: T,
): T {
  if (typeof message !== 'string') return message;

  return message
    .replace(SQL_STRING_LITERAL, '?')
    .replace(SQL_HEX_LITERAL, '?')
    .replace(SQL_NUMERIC_LITERAL, '?')
    .replace(PLACEHOLDER_RUN, '?') as T;
}

/**
 * Same masking, but only over the message header — frame lines carry
 * `file:line:column` that {@link SQL_NUMERIC_LITERAL} would otherwise eat.
 */
export function redactErrorStack<T extends string | undefined | null>(
  stack: T,
): T {
  if (typeof stack !== 'string') return stack;

  const frame = stack.search(STACK_FIRST_FRAME);
  if (frame === -1) return redactSqlLiterals(stack);

  return (redactSqlLiterals(stack.slice(0, frame)) + stack.slice(frame)) as T;
}

const EXPORT_WINDOW_MS = 60_000;
const EXPORTS_PER_WINDOW = 5;
const exportRate = new LRUMap<{ windowStart: number; count: number }>(500);

/**
 * Per-signature token bucket for outbound error reports. One broken generated
 * query fires on every row read, for every viewer of the resource — without a
 * cap that is an unbounded event stream to a third party. Redaction makes the
 * signature stable enough for this to bite; it is deliberately generous so
 * ordinary error rates are untouched.
 */
export function allowErrorExport(signature: string, now = Date.now()): boolean {
  const entry = exportRate.get(signature);

  if (!entry || now - entry.windowStart >= EXPORT_WINDOW_MS) {
    exportRate.set(signature, { windowStart: now, count: 1 });
    return true;
  }

  entry.count += 1;
  return entry.count <= EXPORTS_PER_WINDOW;
}

export function resetErrorExportRate() {
  exportRate.clear();
}
