import { nanoid } from 'nanoid';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import NocoCache from '~/cache/NocoCache';

export default class OAuthAuthorizationCode {
  code: string;
  client_id: string;
  user_id: string;

  // PKCE
  code_challenge?: string;
  code_challenge_method: string; // Default: 'S256'

  redirect_uri: string;
  scope?: string;
  state?: string;

  resource?: string;
  granted_resources?: Record<string, any>;

  expires_at: string;
  is_used: boolean;
  created_at: string;

  constructor(authCode: Partial<OAuthAuthorizationCode>) {
    Object.assign(this, authCode);
  }

  public static async insert(
    authCodeData: Partial<OAuthAuthorizationCode>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertData = extractProps(authCodeData, [
      'client_id',
      'user_id',
      'code_challenge',
      'code_challenge_method',
      'redirect_uri',
      'scope',
      'state',
      'resource',
      'granted_resources',
      'expires_at',
    ]);

    insertData.code = nanoid(32);

    insertData = {
      ...insertData,
      code_challenge_method: insertData.code_challenge_method || 'S256',
      is_used: false,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    };

    insertData = prepareForDb(insertData, ['granted_resources']);

    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_AUTHORIZATION_CODES,
      insertData,
      true,
    );

    return await this.getByCode(insertData.code, ncMeta);
  }

  static async getByCode(code: string, ncMeta = Noco.ncMeta) {
    let data = await NocoCache.get(
      'root',
      `${CacheScope.OAUTH_AUTH_CODE}:${code}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_AUTHORIZATION_CODES,
        { code },
      );
      if (data) {
        await NocoCache.setExpiring(
          'root',
          `${CacheScope.OAUTH_AUTH_CODE}:${code}`,
          data,
          600,
        );
      }
    }

    return data && this.castType(data);
  }

  static async markAsUsed(code: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_AUTHORIZATION_CODES,
      { is_used: true },
      { code }, // Using code as the primary key
    );

    await NocoCache.update('root', `${CacheScope.OAUTH_AUTH_CODE}:${code}`, {
      is_used: true,
    });

    return true;
  }

  static async delete(code: string, ncMeta = Noco.ncMeta) {
    if (!code) {
      return false;
    }

    await NocoCache.deepDel(
      'root',
      `${CacheScope.OAUTH_AUTH_CODE}:${code}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_AUTHORIZATION_CODES,
      { code },
    );
  }

  static async deleteExpired(ncMeta = Noco.ncMeta) {
    const expiredCodes = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_AUTHORIZATION_CODES,
      {
        condition: {
          expires_at: {
            lt: new Date().toISOString(),
          },
        },
      },
    );

    for (const expiredCode of expiredCodes) {
      await NocoCache.deepDel(
        'root',
        `${CacheScope.OAUTH_AUTH_CODE}:${expiredCode.code}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_AUTHORIZATION_CODES,
      {
        expires_at: {
          lt: new Date().toISOString(),
        },
      },
    );
  }

  public static castType(authCode: any): OAuthAuthorizationCode {
    if (!authCode) return null;

    authCode = prepareForResponse(authCode, ['granted_resources']);

    return new OAuthAuthorizationCode(authCode);
  }
}
