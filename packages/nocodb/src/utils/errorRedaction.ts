import type { ErrorEvent } from '@sentry/node';
import { LRUMap } from '~/utils/LRUMap';

/**
 * knex builds `err.message = formatQuery(sql, bindings) + ' - ' + err.message`,
 * inlining binding *values*. Any driver error carrying a compiled statement
 * therefore carries customer row data (`… where "email" = 'alice@x.com'`), so
 * it must be masked before the message leaves the box — Sentry and the
 * priority-error telemetry sink are both third-party processors.
 *
 * Double-quoted and backticked identifiers survive untouched: they are schema
 * metadata, and without them the exported statement is useless for diagnosing
 * the defect that produced it. MySQL and MSSQL single-quote identifiers in
 * their *driver* messages too, so a single-quoted token is kept only where the
 * surrounding phrase names schema and the token is identifier-shaped
 * ({@link isDiagnosticIdentifier}). A bare one-word value still survives
 * `Incorrect syntax near 'x'` — accepted, since that token is the whole
 * diagnostic for MSSQL 102.
 */
const SQL_STRING_LITERAL = /[eEnN]?'(?:[^'\\]|\\.|'')*'/g;
const SQL_HEX_LITERAL = /\b0x[0-9a-fA-F]+/g;
// collapse `?, ?, ?` so a 500-row insert groups with its 1-row sibling
const PLACEHOLDER_RUN = /\?(?:\s*,\s*\?)+/g;

/**
 * MySQL's ER_PARSE_ERROR quotes a raw SQL fragment without escaping the quotes
 * inside it, so the fragment can't be tokenised — pairing quotes across it
 * leaves binding values as bare text. Mask it whole instead.
 */
const MYSQL_PARSE_FRAGMENT = /near '[\s\S]*' at line (\d+)/g;

// phrases after which a quoted token names schema, not data
const DIAGNOSTIC_PHRASE =
  /\b(?:near|key|column|table|constraint|index|relation|database|schema|in)\s+$/i;
const IDENTIFIER_SHAPE = /^[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*$/;
// MySQL names the failing clause in the same position an identifier appears
const CLAUSE_NAMES = new Set([
  'field list',
  'where clause',
  'order clause',
  'group statement',
  'having clause',
  'on clause',
]);

/**
 * First branch is passed through: error numbers, statement positions and
 * host:port pairs are the identifying part of a driver message and can never
 * be an inlined binding. Second branch skips `$1` placeholders and digits
 * inside identifiers (`nc_tbl_1`).
 */
const SQL_NUMERIC_LITERAL =
  /(ORA-\d+|\bat character \d+|\bat line \d+|\berror \d+|\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?)|(?<![\w$."'`])-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w"'`])/gi;

const STACK_FIRST_FRAME = /\n\s*at\s/;

function isDiagnosticIdentifier(literal: string, preceding: string): boolean {
  if (!DIAGNOSTIC_PHRASE.test(preceding)) return false;

  const inner = literal.replace(/^[eEnN]?'/, '').replace(/'$/, '');
  return IDENTIFIER_SHAPE.test(inner) || CLAUSE_NAMES.has(inner.toLowerCase());
}

export function redactSqlLiterals<T extends string | undefined | null>(
  message: T,
): T {
  if (typeof message !== 'string') return message;

  return message
    .replace(MYSQL_PARSE_FRAGMENT, 'near ? at line $1')
    .replace(SQL_STRING_LITERAL, (literal, offset: number, full: string) =>
      isDiagnosticIdentifier(literal, full.slice(0, offset)) ? literal : '?',
    )
    .replace(SQL_HEX_LITERAL, '?')
    .replace(SQL_NUMERIC_LITERAL, (_match, keep: string) => keep ?? '?')
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
 *
 * `suppressed` carries what the cap dropped in the previous window, so the
 * magnitude survives the cap — 6/min and 60k/min are otherwise indistinguishable
 * once both are clamped to 5. It is reported on the next event that gets
 * through, so a flood that stops dead never reports its tail.
 */
export function allowErrorExport(
  signature: string,
  now = Date.now(),
): { allow: boolean; suppressed: number } {
  const entry = exportRate.get(signature);

  if (!entry || now - entry.windowStart >= EXPORT_WINDOW_MS) {
    exportRate.set(signature, { windowStart: now, count: 1 });
    return {
      allow: true,
      suppressed: Math.max(0, (entry?.count ?? 0) - EXPORTS_PER_WINDOW),
    };
  }

  entry.count += 1;
  return { allow: entry.count <= EXPORTS_PER_WINDOW, suppressed: 0 };
}

export function resetErrorExportRate() {
  exportRate.clear();
}

const MAX_REDACT_DEPTH = 4;

function redactDeep(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return redactSqlLiterals(value);
  if (depth >= MAX_REDACT_DEPTH) return value;
  if (Array.isArray(value))
    return value.map((item) => redactDeep(item, depth + 1));
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        redactDeep(item, depth + 1),
      ]),
    );
  return value;
}

/**
 * Sentry `beforeSend`. Breadcrumbs are covered too: `consoleIntegration()` is
 * on by default and the EE `uncaughtExceptionMonitor` console.errors the raw
 * error, so a knex message reaches Sentry that way even when the exception
 * itself is clean.
 */
export function redactErrorEvent(
  event: ErrorEvent,
  now = Date.now(),
): ErrorEvent | null {
  for (const exception of event.exception?.values ?? []) {
    exception.value = redactSqlLiterals(exception.value);
  }
  event.message = redactSqlLiterals(event.message);

  for (const breadcrumb of event.breadcrumbs ?? []) {
    breadcrumb.message = redactSqlLiterals(breadcrumb.message);
    if (breadcrumb.data)
      breadcrumb.data = redactDeep(breadcrumb.data) as typeof breadcrumb.data;
  }

  const signature =
    event.exception?.values?.map((e) => `${e.type}:${e.value}`).join('|') ??
    event.message ??
    '';

  const { allow, suppressed } = allowErrorExport(signature, now);
  if (!allow) return null;

  if (suppressed)
    event.extra = { ...event.extra, suppressed_since_last_report: suppressed };

  return event;
}
