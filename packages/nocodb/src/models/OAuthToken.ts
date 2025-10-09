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

export default class OAuthToken {
  id: string;
  client_id: string;
  fk_user_id: string;

  access_token: string;
  access_token_expires_at: string;

  refresh_token?: string;
  refresh_token_expires_at?: string;

  // MCP Requirements
  resource?: string;
  audience?: string;

  granted_resources?: Record<string, any>;
  scope?: string;
  is_revoked: boolean;

  created_at: string;
  last_used_at?: string;

  constructor(token: Partial<OAuthToken>) {
    Object.assign(this, token);
  }

  public static async insert(
    tokenData: Partial<OAuthToken>,
    ncMeta = Noco.ncMeta,
  ) {
    let insertData = extractProps(tokenData, [
      'client_id',
      'fk_user_id',
      'access_token',
      'access_token_expires_at',
      'refresh_token',
      'refresh_token_expires_at',
      'resource',
      'audience',
      'granted_resources',
      'scope',
    ]);

    insertData.id = nanoid(20);

    insertData = {
      ...insertData,
      is_revoked: false,
    };

    insertData = prepareForDb(insertData, ['granted_resources']);

    await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      insertData,
      true,
    );

    return this.getByAccessToken(insertData.access_token, ncMeta).then(
      async (token) => {
        await NocoCache.appendToList(
          'root',
          CacheScope.OAUTH_TOKEN,
          [],
          `${CacheScope.OAUTH_TOKEN}:${insertData.access_token}`,
        );
        return token;
      },
    );
  }

  static async get(id: string, ncMeta = Noco.ncMeta) {
    const data = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { id },
    );

    return data && this.castType(data);
  }

  static async getByAccessToken(accessToken: string, ncMeta = Noco.ncMeta) {
    let data = await NocoCache.get(
      'root',
      `${CacheScope.OAUTH_TOKEN}:${accessToken}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_TOKENS,
        { access_token: accessToken },
      );
      if (data) {
        await NocoCache.set(
          'root',
          `${CacheScope.OAUTH_TOKEN}:${accessToken}`,
          data,
        );
      }
    }

    return data && this.castType(data);
  }

  static async getByRefreshToken(refreshToken: string, ncMeta = Noco.ncMeta) {
    const data = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { refresh_token: refreshToken },
    );

    return data && this.castType(data);
  }

  static async listByUser(userId: string, ncMeta = Noco.ncMeta) {
    const tokens = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { condition: { fk_user_id: userId, is_revoked: false } },
    );

    return tokens?.map((t) => this.castType(t));
  }

  static async listByClient(clientId: string, ncMeta = Noco.ncMeta) {
    const tokens = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { condition: { client_id: clientId, is_revoked: false } },
    );

    return tokens?.map((t) => this.castType(t));
  }

  static async revoke(id: string, ncMeta = Noco.ncMeta) {
    const token = await this.get(id, ncMeta);
    if (!token) {
      return false;
    }

    const updateData = {
      is_revoked: true,
    };

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      updateData,
      { id },
    );

    // Update cache by access token
    await NocoCache.update(
      'root',
      `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
      updateData,
    );

    return true;
  }

  static async revokeByAccessToken(accessToken: string, ncMeta = Noco.ncMeta) {
    const token = await this.getByAccessToken(accessToken, ncMeta);
    if (token) {
      return await this.revoke(token.id, ncMeta);
    }
    return false;
  }

  static async revokeAllByUser(userId: string, ncMeta = Noco.ncMeta) {
    const tokens = await this.listByUser(userId, ncMeta);

    for (const token of tokens) {
      await this.revoke(token.id, ncMeta);
    }

    return true;
  }

  static async revokeAllByClient(clientId: string, ncMeta = Noco.ncMeta) {
    const tokens = await this.listByClient(clientId, ncMeta);

    for (const token of tokens) {
      await this.revoke(token.id, ncMeta);
    }

    return true;
  }

  static async updateLastUsed(id: string, ncMeta = Noco.ncMeta) {
    const token = await this.get(id, ncMeta);
    if (!token) {
      return false;
    }

    const updateData = {
      last_used_at: new Date().toISOString(),
    };

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      updateData,
      { id },
    );

    // Update cache by access token
    await NocoCache.update(
      'root',
      `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
      updateData,
    );

    return true;
  }

  static async deleteExpired(ncMeta = Noco.ncMeta) {
    const now = new Date().toISOString();

    // Get expired tokens first to clear cache
    const expiredTokens = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      {
        condition: {
          access_token_expires_at: { lt: now },
        },
      },
    );

    // Clear cache for expired tokens
    for (const token of expiredTokens) {
      await NocoCache.deepDel(
        'root',
        `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    // Delete expired tokens
    return await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      {
        access_token_expires_at: { lt: now },
      },
    );
  }

  // Validate if token is still valid
  static async validateAccessToken(
    accessToken: string,
    ncMeta = Noco.ncMeta,
  ): Promise<OAuthToken | null> {
    const token = await this.getByAccessToken(accessToken, ncMeta);

    if (!token) {
      return null;
    }

    // Check if revoked
    if (token.is_revoked) {
      return null;
    }

    // Check if expired
    if (new Date(token.access_token_expires_at) < new Date()) {
      return null;
    }

    // Update last used
    await this.updateLastUsed(token.id, ncMeta);

    return token;
  }

  public static castType(token: any): OAuthToken {
    if (!token) return null;

    token = prepareForResponse(token, ['granted_resources']);

    return new OAuthToken(token);
  }
}
