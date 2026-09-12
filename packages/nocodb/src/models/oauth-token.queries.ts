import type { Knex } from 'knex';

/**
 * Atomic compare-and-swap revoke of an OAuth token: flips `is_revoked` from
 * false to true and returns the number of rows affected (1 if this caller won,
 * 0 if the token was already revoked or does not exist).
 *
 * The `is_revoked: false` predicate makes the update a CAS so concurrent refresh
 * requests presenting the same refresh token cannot both rotate it. Mirrors the
 * proven single-use primitive in OAuthAuthorizationCode.claimByCode().
 * Fixes GHSA-353r-pj87-54hc.
 */
export function buildRevokeIfActiveUpdate(
  knex: Knex,
  tableName: string,
  id: string,
): Knex.QueryBuilder {
  return knex(tableName)
    .where({ id, is_revoked: false })
    .update({ is_revoked: true });
}
