import { isDeepStrictEqual } from 'util';
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
import { secretEquals, sha256Hex } from '~/helpers/sha256';

// A scope of its own: a pod on the previous image reads `oAuthToken:<presented
// token>`, so an entry keyed there by hash would accept the stored hash as a bearer.
const hashCacheKey = (hash: string) => `${CacheScope.OAUTH_TOKEN_HASH}:${hash}`;
const clearCacheKey = (accessToken: string) =>
  `${CacheScope.OAUTH_TOKEN}:${accessToken}`;

// The clear-token key stays maintained for pods on the previous image; a later
// release drops it with the clear columns.
const cacheKeysOf = (token: {
  access_token?: string;
  access_token_hash?: string;
}) => {
  const hash =
    token.access_token_hash ??
    (token.access_token ? sha256Hex(token.access_token) : null);
  return [
    hash && hashCacheKey(hash),
    token.access_token && clearCacheKey(token.access_token),
  ].filter(Boolean);
};

export default class OAuthToken {
  id: string;
  fk_client_id: string;
  fk_user_id: string;

  access_token: string;
  access_token_hash?: string;
  access_token_expires_at: string;

  refresh_token?: string;
  refresh_token_hash?: string;
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
      // The clear columns stay for pods on the previous image; a later release drops them.
      {
        ...insertData,
        access_token_hash: sha256Hex(insertData.access_token),
        refresh_token_hash: insertData.refresh_token
          ? sha256Hex(insertData.refresh_token)
          : null,
      },
      true,
    );

    return this.getByAccessToken(insertData.access_token, ncMeta).then(
      async (token) => {
        await NocoCache.appendToList(
          'root',
          CacheScope.OAUTH_TOKEN_HASH,
          [],
          hashCacheKey(sha256Hex(insertData.access_token)),
        );
        await NocoCache.appendToList(
          'root',
          CacheScope.OAUTH_TOKEN,
          [],
          clearCacheKey(insertData.access_token),
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
    if (typeof accessToken !== 'string' || !accessToken) return null;

    const keys = [
      hashCacheKey(sha256Hex(accessToken)),
      clearCacheKey(accessToken),
    ];
    const [byHash, byClear] = await Promise.all(
      keys.map((key) => NocoCache.get('root', key, CacheGetType.TYPE_OBJECT)),
    );

    // Pods on the previous image update only the clear-token key.
    let data = byHash && isDeepStrictEqual(byHash, byClear) ? byHash : null;

    if (!data) {
      data = await this.getBySecret('access_token', accessToken, ncMeta);
      if (data) {
        for (const key of keys) await NocoCache.set('root', key, data);
      }
    }

    return data && this.castType(data);
  }

  static async getByRefreshToken(refreshToken: string, ncMeta = Noco.ncMeta) {
    const data = await this.getBySecret('refresh_token', refreshToken, ncMeta);

    return data && this.castType(data);
  }

  // By the hash, then by the clear column for rows the backfill has not reached.
  private static async getBySecret(
    column: 'access_token' | 'refresh_token',
    secret: string,
    ncMeta = Noco.ncMeta,
  ) {
    if (typeof secret !== 'string' || !secret) return null;

    const byHash = await ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { [`${column}_hash`]: sha256Hex(secret) },
    );

    if (
      byHash &&
      (byHash[column] == null || secretEquals(byHash[column], secret))
    ) {
      return byHash;
    }

    return ncMeta.metaGet(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.OAUTH_TOKENS,
      { [column]: secret },
    );
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

    for (const key of cacheKeysOf(token)) {
      await NocoCache.update('root', key, updateData);
    }

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

    // The strategy reads the grant through these cache entries on every call.
    for (const key of cacheKeysOf(token)) {
      await NocoCache.update('root', key, updateData);
    }

    return true;
  }

  /**
   * Rewrite the permissions blob from its current value. The write is
   * conditional on the value it was built from, so two writers touching
   * different fields (a tool edit, a recorded base) never drop each other's:
   * the loser re-reads and re-applies. Returns null when the row is gone or
   * revoked — a refresh already copied the blob it held.
   */
  static async updatePermissionsWith(
    id: string,
    build: (token: OAuthToken) => Promise<string> | string,
    ncMeta = Noco.ncMeta,
  ): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const token = await this.get(id, ncMeta);
      if (!token || token.is_revoked) return null;

      const permissions = await build(token);
      if (permissions === token.permissions) return permissions;

      const updated = await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.OAUTH_TOKENS,
        { permissions },
        { id, is_revoked: false, permissions: token.permissions ?? null },
      );

      if (updated) {
        for (const key of cacheKeysOf(token)) {
          await NocoCache.update('root', key, { permissions });
        }
        return permissions;
      }
    }

    NcError.badRequest(
      'This authorization changed while it was being saved; try again',
    );
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

    for (const key of cacheKeysOf(token)) {
      await NocoCache.update('root', key, { is_revoked: true });
    }

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
        for (const key of cacheKeysOf(token)) {
          await NocoCache.deepDel(
            'root',
            key,
            CacheDelDirection.CHILD_TO_PARENT,
          );
        }
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
