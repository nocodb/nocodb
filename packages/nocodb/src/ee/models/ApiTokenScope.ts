import type {
  ApiTokenPermissions,
  ApiTokenPermissionsJson,
  ApiTokenScopeEntry,
  ApiTokenScopeResourceType,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import Base from '~/models/Base';
import NocoCache from '~/cache/NocoCache';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';

export default class ApiTokenScope implements ApiTokenScopeEntry {
  id?: string;
  fk_api_token_id?: string;
  resource_type: ApiTokenScopeResourceType;
  resource_id: string;
  permissions?: ApiTokenPermissions;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<ApiTokenScope>) {
    Object.assign(this, data);
  }

  public static async insert(
    scope: Partial<ApiTokenScope>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertData: Record<string, any> = {
      fk_api_token_id: scope.fk_api_token_id,
      resource_type: scope.resource_type,
      resource_id: scope.resource_id,
      permissions: scope.permissions
        ? typeof scope.permissions === 'string'
          ? scope.permissions
          : JSON.stringify({
              version: 1,
              categories: scope.permissions,
            })
        : null,
    };

    const result = await ncMeta.metaInsert2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKEN_SCOPES,
      insertData,
    );

    return this.get(result.id, ncMeta).then(async (res) => {
      if (res) {
        await NocoCache.appendToList(
          'root',
          CacheScope.API_TOKEN_SCOPE,
          [scope.fk_api_token_id],
          `${CacheScope.API_TOKEN_SCOPE}:${res.id}`,
        );
      }
      return res;
    });
  }

  public static async bulkInsert(
    tokenId: string,
    scopes: ApiTokenScopeEntry[],
    ncMeta = Noco.ncMeta,
  ) {
    const results: ApiTokenScope[] = [];
    for (const scope of scopes) {
      const inserted = await this.insert(
        {
          fk_api_token_id: tokenId,
          resource_type: scope.resource_type as ApiTokenScopeResourceType,
          resource_id: scope.resource_id,
          permissions: scope.permissions,
        },
        ncMeta,
      );
      if (inserted) results.push(inserted);
    }

    return results;
  }

  public static async get(scopeId: string, ncMeta = Noco.ncMeta) {
    let data =
      scopeId &&
      (await NocoCache.get(
        'root',
        `${CacheScope.API_TOKEN_SCOPE}:${scopeId}`,
        CacheGetType.TYPE_OBJECT,
      ));

    if (!data) {
      data = await ncMeta.metaGet(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKEN_SCOPES,
        scopeId,
      );

      if (data) {
        await NocoCache.set(
          'root',
          `${CacheScope.API_TOKEN_SCOPE}:${scopeId}`,
          data,
        );
      }
    }

    return data && new ApiTokenScope(data);
  }

  public static async listByTokenId(
    tokenId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApiTokenScope[]> {
    const cachedList = await NocoCache.getList(
      'root',
      CacheScope.API_TOKEN_SCOPE,
      [tokenId],
    );

    let { list: scopeList } = cachedList;
    const { isNoneList } = cachedList;

    if (!isNoneList && !scopeList.length) {
      scopeList = await ncMeta.metaList2(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.API_TOKEN_SCOPES,
        {
          condition: { fk_api_token_id: tokenId },
        },
      );
      await NocoCache.setList(
        'root',
        CacheScope.API_TOKEN_SCOPE,
        [tokenId],
        scopeList,
      );
    }

    return (scopeList || []).map((s) => new ApiTokenScope(s));
  }

  /**
   * Find a matching scope for a given resource.
   * First checks for an exact base match, then workspace match,
   * then checks if any base-scoped entries belong to the requested workspace.
   */
  public static async findMatchingScope(
    tokenId: string,
    baseId?: string,
    workspaceId?: string,
    ncMeta = Noco.ncMeta,
  ): Promise<ApiTokenScope | null> {
    const scopes = await this.listByTokenId(tokenId, ncMeta);

    if (!scopes.length) return null;

    // 1. Try exact base match
    if (baseId) {
      const baseScope = scopes.find(
        (s) => s.resource_type === 'base' && s.resource_id === baseId,
      );
      if (baseScope) return baseScope;
    }

    // 2. Try exact workspace match
    if (workspaceId) {
      const wsScope = scopes.find(
        (s) => s.resource_type === 'workspace' && s.resource_id === workspaceId,
      );
      if (wsScope) return wsScope;
    }

    // Base-scoped tokens should not be promoted to workspace-level access.
    // Fix #3 (scoped tokens denied on context-free endpoints) makes this
    // redundant, and the promotion allowed unmapped workspace operations
    // to bypass token scope restrictions.

    return null;
  }

  public static async update(
    scopeId: string,
    data: Partial<{ permissions: string }>,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKEN_SCOPES,
      data,
      scopeId,
    );

    // Invalidate individual + list cache
    await NocoCache.deepDel(
      'root',
      `${CacheScope.API_TOKEN_SCOPE}:${scopeId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    return this.get(scopeId, ncMeta);
  }

  public static async delete(scopeId: string, ncMeta = Noco.ncMeta) {
    const scope = await this.get(scopeId, ncMeta);

    await NocoCache.deepDel(
      'root',
      `${CacheScope.API_TOKEN_SCOPE}:${scopeId}`,
      CacheDelDirection.CHILD_TO_PARENT,
    );

    await ncMeta.metaDelete(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.API_TOKEN_SCOPES,
      scopeId,
    );

    return scope;
  }

  public static async deleteByTokenId(
    tokenId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const scopes = await this.listByTokenId(tokenId, ncMeta);

    for (const scope of scopes) {
      await NocoCache.deepDel(
        'root',
        `${CacheScope.API_TOKEN_SCOPE}:${scope.id}`,
        CacheDelDirection.CHILD_TO_PARENT,
      );
    }

    await ncMeta
      .knex(MetaTable.API_TOKEN_SCOPES)
      .where('fk_api_token_id', tokenId)
      .delete();

    // Clean up list cache key and any remaining children
    await NocoCache.deepDel(
      'root',
      `${CacheScope.API_TOKEN_SCOPE}:${tokenId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );
  }

  parsePermissions(): ApiTokenPermissionsJson | null {
    if (!this.permissions) return null;

    try {
      const raw = this.permissions;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

      if (parsed.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
