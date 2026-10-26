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
import { NcError } from '~/helpers/catchError';
import { buildRevokeIfActiveUpdate } from '~/models/oauth-token.queries';

export default class OAuthToken {
  id: string;
  fk_client_id: string;
  fk_user_id: string;

  access_token: string;
  access_token_expires_at: string;

  refresh_token?: string;
  refresh_token_expires_at?: string;

  // MCP Requirements
  resource?: string;
  audience?: string;

  granted_resources?: Record<string, any>;
  permissions?: string;
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
      'fk_client_id',
      'fk_user_id',
      'access_token',
      'access_token_expires_at',
      'refresh_token',
      'refresh_token_expires_at',
      'resource',
      'audience',
      'granted_resources',
      'permissions',
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

  static async updatePermissions(
    id: string,
    permissions: string,
    ncMeta = Noco.ncMeta,
  ) {
    const token = await this.get(id, ncMeta);
    if (!token) {
      return false;
    }

    const updateData = { permissions };

    // Skips a token a concurrent refresh revoked, whose grant it already copied.
    const updated = await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      updateData,
      { id, is_revoked: false },
    );

    if (!updated) {
      return false;
    }

    // The strategy reads the grant through this cache entry on every call.
    await NocoCache.update(
      'root',
      `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
      updateData,
    );

    return true;
  }

  /**
   * Atomically revoke a token only if it is currently active. Returns true only
   * if this caller won the compare-and-swap (the token was active and is now
   * revoked); false if it was already revoked or does not exist. Used to make
   * refresh-token rotation single-use under concurrency (GHSA-353r).
   */
  static async revokeIfActive(id: string, ncMeta = Noco.ncMeta) {
    const token = await this.get(id, ncMeta);
    if (!token) {
      return false;
    }

    const updated = await buildRevokeIfActiveUpdate(
      ncMeta.knex,
      MetaTable.OAUTH_TOKENS,
      id,
    );

    if (!updated) {
      return false;
    }

    // Update cache by access token
    await NocoCache.update(
      'root',
      `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
      { is_revoked: true },
    );

    return true;
  }

  static async revokeAllByUser(userId: string, ncMeta = Noco.ncMeta) {
    const tokens = await this.listByUser(userId, ncMeta);
    if (tokens?.length) {
      await Promise.all(tokens.map((t) => this.revoke(t.id, ncMeta)));
    }
  }

  static async deleteAllByClient(clientId: string, ncMeta = Noco.ncMeta) {
    const BATCH_SIZE = 100;
    let deletedCount = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Fetch a batch of tokens
      const tokens = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_TOKENS,
        {
          condition: { fk_client_id: clientId },
          limit: BATCH_SIZE,
        },
      );

      if (!tokens || tokens.length === 0) {
        break;
      }

      // Clear cache for each token in the batch
      for (const token of tokens) {
        await NocoCache.deepDel(
          'root',
          `${CacheScope.OAUTH_TOKEN}:${token.access_token}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }

      // Delete the batch. NOTE: passing `{ id: { in: [...] } }` to metaDelete's
      // simple-condition argument makes Knex treat it as an equality object, so
      // NO rows are deleted — the client would be removed while its tokens stay
      // valid (CWE-613). Use an explicit `whereIn` and verify the affected-row
      // count matches the batch so a partial/failed delete cannot be reported as
      // success.
      const tokenIdsToDelete = tokens.map((t) => t.id);
      const affected = await ncMeta
        .knexConnection(MetaTable.OAUTH_TOKENS)
        .whereIn('id', tokenIdsToDelete)
        .del();

      if (affected !== tokenIdsToDelete.length) {
        NcError.internalServerError(
          'Failed to revoke all OAuth tokens for the client',
        );
      }

      deletedCount += affected;

      // If we got fewer than BATCH_SIZE, we're done
      if (tokens.length < BATCH_SIZE) {
        break;
      }
    }

    return deletedCount;
  }

  private static lastUsedWrites = new Map<string, number>();
  private static readonly LAST_USED_INTERVAL_MS = 60_000;

  /**
   * Fire-and-forget, at most one `last_used_at` write per token a minute. The
   * map skips the shared lease on most calls; the lease dedupes across instances.
   */
  static touchLastUsed(token: OAuthToken) {
    const now = Date.now();
    const lastWrite = OAuthToken.lastUsedWrites.get(token.id);

    if (lastWrite && now - lastWrite < OAuthToken.LAST_USED_INTERVAL_MS) return;

    // Re-inserted so the map stays oldest-first; a token evicted early only costs a lease check.
    OAuthToken.lastUsedWrites.delete(token.id);
    OAuthToken.lastUsedWrites.set(token.id, now);
    if (OAuthToken.lastUsedWrites.size > 10_000) {
      const [oldest] = OAuthToken.lastUsedWrites.keys();
      OAuthToken.lastUsedWrites.delete(oldest);
    }

    NocoCache.setIfNotExist(
      'root',
      `oAuthTokenLastUsed:${token.id}`,
      '1',
      OAuthToken.LAST_USED_INTERVAL_MS / 1000,
    )
      .then((acquired) => acquired && OAuthToken.updateLastUsed(token.id))
      .catch(() => {});
  }

  // Not mirrored into the cached token: merging into it could write back a stale `is_revoked` or `permissions`.
  static async updateLastUsed(id: string, ncMeta = Noco.ncMeta) {
    const updated = await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { last_used_at: new Date().toISOString() },
      id,
    );

    return !!updated;
  }

  public static castType(token: any): OAuthToken {
    if (!token) return null;

    token = prepareForResponse(token, ['granted_resources']);

    return new OAuthToken(token);
  }
}
