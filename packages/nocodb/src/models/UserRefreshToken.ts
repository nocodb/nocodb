import dayjs from 'dayjs';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { MetaTable, RootScopes } from '~/utils/globals';
import { parseMetaProp, stringifyMetaProp } from '~/utils/modelUtils';
import { NC_REFRESH_TOKEN_EXP_IN_DAYS } from '~/constants';

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
      insertObj,
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
    // `metaUpdate` keys the UPDATE on `{ token: oldToken }` and returns the
    // rows-affected count, so the compare-and-swap is at the SQL level. Prefer
    // it over raw knex for the scope checks and `updated_at` stamping.
    const affected = await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        token: newToken,
        expires_at: dayjs().add(NC_REFRESH_TOKEN_EXP_IN_DAYS, 'day').toDate(),
      },
      {
        token: oldToken,
      },
    );

    return Number(affected) || 0;
  }

  static async deleteToken(token: string, ncMeta = Noco.ncMeta) {
    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        token,
      },
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
    const userToken = await ncMeta.metaGet2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.USER_REFRESH_TOKENS,
      {
        token,
      },
    );

    if (!userToken) return null;

    userToken.meta = parseMetaProp(userToken);

    return userToken;
  }
}
