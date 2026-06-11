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
