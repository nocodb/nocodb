import crypto from 'crypto';
import { nanoid } from 'nanoid';
import { API_TOKEN_PREFIX } from 'nocodb-sdk';
import type { ApiTokenPermissionsJson, ApiTokenScopeEntry } from 'nocodb-sdk';
import ApiTokenCE from 'src/models/ApiToken';
import ApiTokenScope from './ApiTokenScope';
import SSOClient from '~/models/SSOClient';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';

export default class ApiToken extends ApiTokenCE {
  token_hash?: string;
  token_prefix?: string;
  last_used_at?: string;

  // Loaded from nc_api_token_scopes
  scopes?: ApiTokenScope[];

  async getExtraForUserPayload(
    ncMeta = Noco.ncMeta,
  ): Promise<void | Record<string, any>> {
    if (!this.fk_sso_client_id) return;

    const ssoClient = await SSOClient.get(this.fk_sso_client_id, ncMeta);

    if (!ssoClient) {
      return;
    }

    return {
      org_id: ssoClient.fk_org_id,
      workspace_id: ssoClient.fk_workspace_id,
      sso_client_id: ssoClient.id,
      sso_client_type: ssoClient.type,
    } as Record<string, any>;
  }

  /**
   * Insert a fine-grained API token with optional scopes.
   * Generates nc_pat_ prefixed token, SHA-256 hashes it, stores hash + prefix.
   * Plaintext is never persisted — returned only in the insert response.
   */
  public static async insert(
    apiToken: Partial<ApiToken> & {
      scopes?: ApiTokenScopeEntry[];
      fineGrained?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<ApiToken> {
    const isFineGrained =
      apiToken.fineGrained ||
      apiToken.scopes?.length ||
      apiToken.permissions ||
      apiToken.expiry;

    if (isFineGrained) {
      const plainToken = API_TOKEN_PREFIX + nanoid(40);
      const tokenHash = crypto
        .createHash('sha256')
        .update(plainToken)
        .digest('hex');
      const tokenPrefix = plainToken.substring(0, 12);

      const insertData: Record<string, any> = {
        description: apiToken.description,
        fk_user_id: apiToken.fk_user_id,
        fk_sso_client_id: apiToken.fk_sso_client_id ?? null,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        expiry: apiToken.expiry || null,
        enabled: apiToken.enabled !== undefined ? apiToken.enabled : true,
      };

      const trx = await ncMeta.startTransaction();
      try {
        await trx.metaInsert2(
          RootScopes.ROOT,
          RootScopes.ROOT,
          MetaTable.API_TOKENS,
          insertData,
          true,
        );

        const created = await this.getByTokenHash(tokenHash, trx);

        if (created) {
          // Insert scopes if provided
          if (apiToken.scopes?.length) {
            created.scopes = await ApiTokenScope.bulkInsert(
              created.id,
              apiToken.scopes,
              trx,
              { skipCache: true },
            );
          }
        }

        await trx.commit();

        // Cache operations after commit
        if (created) {
          await NocoCache.appendToList(
            'root',
            CacheScope.API_TOKEN,
            [],
            `${CacheScope.API_TOKEN}:${tokenHash}`,
          );
        }

        // Return the token with plaintext (shown only once)
        const result = this.castType(created);
        result.token = plainToken;
        return result;
      } catch (e) {
        await trx.rollback(e);
        throw e;
      }
    }

    // Legacy token — delegate to CE insert
    return super.insert(apiToken, ncMeta) as Promise<ApiToken>;
  }

  /**
   * Look up a token by its SHA-256 hash.
   */
  static async getByTokenHash(hash: string, ncMeta = Noco.ncMeta) {
    let data =
      hash &&
      (await NocoCache.get(
        'root',
        `${CacheScope.API_TOKEN}:${hash}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKENS,
        { token_hash: hash },
      );

      if (data) {
        await NocoCache.set(
          'root',
          `${CacheScope.API_TOKEN}:${hash}`,
          data,
        );
      }
    }

    return data && this.castType(data);
  }

  /**
   * Override getByToken to support both hash-based (nc_pat_ prefix) and
   * legacy plaintext token lookup.
   */
  static async getByToken(token: string, ncMeta = Noco.ncMeta) {
    if (token && token.startsWith(API_TOKEN_PREFIX)) {
      const hash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      return this.getByTokenHash(hash, ncMeta);
    }

    // Legacy plaintext lookup
    return super.getByToken(token, ncMeta);
  }

  /**
   * Load scopes for a token.
   */
  static async getScopes(tokenId: string, ncMeta = Noco.ncMeta) {
    return ApiTokenScope.listByTokenId(tokenId, ncMeta);
  }

  /**
   * Find the matching scope for a given resource context.
   */
  static async findMatchingScope(
    tokenId: string,
    baseId?: string,
    workspaceId?: string,
    ncMeta = Noco.ncMeta,
  ) {
    return ApiTokenScope.findMatchingScope(
      tokenId,
      baseId,
      workspaceId,
      ncMeta,
    );
  }

  /**
   * Parse the permissions JSON from the database.
   * Returns null for legacy tokens (no permissions set).
   */
  parsePermissions(): ApiTokenPermissionsJson | null {
    if (!this.permissions) return null;

    try {
      const parsed =
        typeof this.permissions === 'string'
          ? JSON.parse(this.permissions)
          : this.permissions;

      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Update the last_used_at timestamp (fire-and-forget).
   */
  static async updateLastUsed(tokenId: string, ncMeta = Noco.ncMeta) {
    try {
      await ncMeta.metaUpdate(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKENS,
        { last_used_at: new Date().toISOString() },
        tokenId,
      );
    } catch {
      // Best-effort — don't block request if this fails
    }
  }

  /**
   * Update token metadata (permissions, expiry, enabled, title).
   */
  static async update(
    tokenId: string,
    data: Partial<{
      description: string;
      permissions: string;
      expiry: string;
      enabled: boolean;
    }>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateData: Record<string, any> = {};

    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }
    if (data.expiry !== undefined) {
      updateData.expiry = data.expiry;
    }
    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled;
    }

    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKENS,
      updateData,
      tokenId,
    );

    // Invalidate cache — the token may be cached by hash or by plaintext
    const tokenData = await this.get(tokenId, ncMeta);
    if (tokenData?.token_hash) {
      await NocoCache.del(
        'root',
        `${CacheScope.API_TOKEN}:${tokenData.token_hash}`,
      );
    }
    if (tokenData?.token) {
      await NocoCache.del(
        'root',
        `${CacheScope.API_TOKEN}:${tokenData.token}`,
      );
    }

    return this.get(tokenId, ncMeta);
  }

  /**
   * Override CE delete to properly invalidate hash-based cache
   * and clean up associated scopes.
   */
  static async delete(tokenId: string, ncMeta = Noco.ncMeta) {
    const tokenData = await this.get(tokenId, ncMeta);

    const trx = await ncMeta.startTransaction();
    try {
      // Clean up scopes
      await ApiTokenScope.deleteByTokenId(tokenId, trx);

      await trx.metaDelete(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKENS,
        tokenId,
      );

      await trx.commit();
    } catch (e) {
      await trx.rollback(e);
      throw e;
    }

    // Invalidate cache after commit
    if (tokenData) {
      if (tokenData.token_hash) {
        await NocoCache.deepDel(
          'root',
          `${CacheScope.API_TOKEN}:${tokenData.token_hash}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
      if (tokenData.token) {
        await NocoCache.deepDel(
          'root',
          `${CacheScope.API_TOKEN}:${tokenData.token}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );
      }
    }
  }

  public static castType(apiToken: ApiToken): ApiToken {
    return apiToken && new ApiToken(apiToken);
  }
}
