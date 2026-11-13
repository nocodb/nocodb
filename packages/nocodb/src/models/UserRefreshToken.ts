import dayjs from 'dayjs';
import type { Knex } from 'knex';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import { NC_REFRESH_TOKEN_EXP_IN_DAYS } from '~/constants';
import { secretEquals, sha256Hex } from '~/helpers/sha256';

// The row a presented token names. `token` is still written by every pod, so it
// wins over the hash: a pod on the previous image rotates `token` only, which
// would leave the hash of the token it replaced.
const presentedTokenCondition = (token: string) => (qb: Knex.QueryBuilder) =>
  qb
    .where('token', token)
    .orWhere((q) => q.whereNull('token').where('token_hash', sha256Hex(token)));

export default class UserRefreshToken {
  fk_user_id: string;
  token: string;
  expires_at: any;
  meta?: any;
  created_at?: any;
  updated_at?: any;

  public static async insert(
    userRefreshToken: Partial<UserRefreshToken>,
    ncMeta = Noco.ncMeta,
  ) {
    // clear old invalid tokens before inserting new one
    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        fk_user_id: userRefreshToken.fk_user_id,
      },
      {
        expires_at: {
          lt: dayjs().toDate(),
        },
      },
    );

    const insertObj = extractProps(userRefreshToken, [
      'fk_user_id',
      'token',
      'expires_at',
      'meta',
    ]);

    // set expiry based on the env or default value
    if (!('expires_at' in insertObj)) {
      insertObj.expires_at = dayjs()
        .add(NC_REFRESH_TOKEN_EXP_IN_DAYS, 'day')
        .toDate();
    }

    if ('meta' in insertObj) {
      insertObj.meta = stringifyMetaProp(insertObj);
    }

    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      { ...insertObj, token_hash: sha256Hex(insertObj.token) },
      true,
    );
    return insertObj;
  }

  // todo: caching
  /**
   * Rotate a refresh token as an atomic compare-and-swap. Returns the number of
   * rows affected: 1 if this caller won the rotation, 0 if the old token was
   * already rotated/revoked (concurrent reuse / replay). Callers MUST reject on
   * a 0 result rather than minting a second valid token.
   */
  static async updateOldToken(
    oldToken: string,
    newToken: string,
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    if (typeof oldToken !== 'string' || !oldToken) return 0;

    // `metaUpdate` returns the rows-affected count, so the compare-and-swap is
    // at the SQL level. Prefer it over raw knex for the scope checks and
    // `updated_at` stamping.
    const affected = await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        token: newToken,
        token_hash: sha256Hex(newToken),
        expires_at: dayjs().add(NC_REFRESH_TOKEN_EXP_IN_DAYS, 'day').toDate(),
      },
      {},
      presentedTokenCondition(oldToken),
    );

    return Number(affected) || 0;
  }

  static async deleteToken(token: string, ncMeta = Noco.ncMeta) {
    if (typeof token !== 'string' || !token) return 0;

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {},
      presentedTokenCondition(token),
    );
  }

  static async deleteAllUserToken(userId: string, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        fk_user_id: userId,
      },
    );
  }

  static async getByToken(
    token: string,
    ncMeta = Noco.ncMeta,
  ): Promise<UserRefreshToken> {
    if (typeof token !== 'string' || !token) return null;

    let userToken = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      { token_hash: sha256Hex(token) },
    );

    // A stale hash: a pod on the previous image rotated `token` past it.
    if (userToken?.token != null && !secretEquals(userToken.token, token)) {
      userToken = null;
    }

    // Rows issued before the hash column, until the backfill job reaches them.
    userToken ??= await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      { token },
    );

    if (!userToken) return null;

    delete userToken.token_hash;

    userToken.meta = parseMetaProp(userToken);

    return userToken;
  }
}
