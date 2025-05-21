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
