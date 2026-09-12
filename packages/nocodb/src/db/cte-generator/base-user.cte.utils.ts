import type { Knex } from 'knex';

/**
 * Build the parameterized `SELECT ... UNION ALL ...` raw used as the BaseUser CTE.
 *
 * Values are passed as knex bindings (`?`) rather than interpolated into the SQL
 * string, so user-controlled fields (notably `email`, which validator.isEmail
 * accepts with a single quote in a quoted local part) cannot break out of the
 * string literal. Fixes GHSA-8qgc-rxmx-p7cw.
 */
export function buildBaseUserCteSelect(
  knex: Knex,
  rows: { fk_user_id: string; email?: string }[],
): Knex.Raw {
  const selectUnionQuery = rows
    .map(() => 'SELECT ? as id, ? as email')
    .join(' UNION ALL ');
  // Coerce nullish to '' — knex throws on `undefined` bindings, whereas the
  // previous string interpolation silently rendered them. Real base users
  // always have an email, but internal/system rows may not.
  const bindings = rows.flatMap((u) => [u.fk_user_id ?? '', u.email ?? '']);
  return knex.raw(selectUnionQuery, bindings);
}
