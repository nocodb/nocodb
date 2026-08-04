import type { XKnex } from '~/db/CustomKnex';

export function sanitize(v) {
  if (typeof v !== 'string') return v;
  return v?.replace(/([^\\]|^)(\?+)/g, (_, m1, m2) => {
    return `${m1}${m2.split('?').join('\\?')}`;
  });
}

export function unsanitize(v) {
  if (typeof v !== 'string') return v;
  return v?.replace(/\\[?]/g, '?');
}

/**
 * Escape a string as a PostgreSQL string literal: wraps in single quotes
 * and doubles any embedded single quotes. Use when an inline literal must
 * be embedded directly in DDL (CREATE TYPE … AS ENUM, ALTER TYPE ADD/RENAME
 * VALUE, ALTER COLUMN SET DEFAULT, USING expressions in ALTER TABLE) — PG's
 * DDL parser rejects parameter placeholders for value literals, so knex's
 * `?` binding (which becomes `$N`) cannot be used in those positions.
 *
 * Identifiers should still go through knex's `??` placeholder.
 */
export function pgQuoteLiteral(value: string): string {
  if (value == null) {
    throw new Error('pgQuoteLiteral: value must not be null or undefined');
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Validate a column precision/length value (`dtxp`) before it is interpolated
 * into DDL. Unlike the data type (`dt`, guarded by `KnexClient.sanitiseDataType`),
 * `dtxp` is not run through an allowlist anywhere in the column pipeline, so a
 * crafted value such as `1) CHECK(1=0` would otherwise inject a persistent
 * constraint — or, on SQLite, an arbitrary `;`-delimited statement — into the
 * live table schema.
 *
 * Accepts only the shapes NocoDB ever legitimately produces for `dtxp`:
 *   - numeric precision, optionally `precision,scale` — e.g. `255`, `10,2`
 *   - the `MAX` length sentinel for SQL Server large-value types — e.g.
 *     `nvarchar(MAX)`, stored verbatim as `dtxp: 'MAX'` for text columns (see
 *     `MssqlUi`). A bare keyword with no injection surface.
 *   - enum/set value lists of single-quoted SQL string literals (with `''`
 *     escaping) — e.g. `'a','b'`, built by `columns.service` for Single/MultiSelect
 *
 * Returns the validated value (trimmed; enum lists kept verbatim) so it can be
 * interpolated as-is. Throws on anything else — mirroring `sanitiseDataType`.
 */
export function sanitiseDataTypePrecision(
  dtxp: string | number | null | undefined,
): string {
  if (dtxp === null || dtxp === undefined) return '';

  const value = String(dtxp).trim();
  if (value === '') return '';

  // numeric precision, optionally precision,scale: `255` | `10,2`
  if (/^\d+(?:\s*,\s*\d+)?$/.test(value)) return value;

  // SQL Server large-value sentinel: `nvarchar(MAX)`, `varbinary(MAX)`, …
  // Normalise to upper-case `MAX` regardless of stored casing.
  if (/^max$/i.test(value)) return 'MAX';

  // enum/set value list: `'a','b',…` — each a quoted literal with `''` escaping
  if (/^'(?:[^']|'')*'(?:\s*,\s*'(?:[^']|'')*')*$/.test(value)) return value;

  throw new Error(`Invalid data type precision: ${dtxp}`);
}

export function sanitizeAndEscapeDots(alias: string, knex: XKnex) {
  const sanitizedAlias = sanitize(alias);
  // if alias does not contain any dot then return as it is
  if (!knex || !sanitizedAlias.includes('.')) return sanitizedAlias;
  // if alias contains dot then return knex.raw with escaped dot
  switch (knex?.clientType?.()) {
    case 'mysql':
    case 'mysql2':
      return knex.raw(
        knex.raw('??', sanitizedAlias).toQuery().replace(/`\.`/g, '.'),
      );
    case 'pg':
      return knex.raw(
        knex.raw('??', sanitizedAlias).toQuery().replace(/"\."/g, '.'),
      );
    default:
      return sanitizedAlias;
  }
}
