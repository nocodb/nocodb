import { NcError } from 'src/helpers/catchError';
import { nanoid } from 'nanoid';
import { NO_SCOPE } from 'nocodb-sdk';
import type {
  MCPTokenType,
  McpTokenPermissionsJson,
  McpTokenStoredPermissions,
  NcContext,
} from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import {
  CacheGetType,
  CacheScope,
  MetaTable,
  RootScopes,
} from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb } from '~/utils/modelUtils';

export default class MCPToken implements MCPTokenType {
  id: string;
  title: string;
  order: number;
  fk_workspace_id: string;
  base_id: string;
  fk_user_id: string;
  updated_at: string;
  created_at: string;
  token: string;
  /**
   * Granular scopes, as stored. Null means the credential predates them and
   * carries the user's own authority pinned to `base_id` — see
   * `McpTokenPermissionsJson`.
   */
  permissions?: string | null;

  constructor(mcpToken: MCPToken | MCPTokenType) {
    Object.assign(this, mcpToken);
  }

  /**
   * The column as stored, or null when it is absent or unreadable.
   *
   * The caller has to tell those two apart: a credential whose column cannot
   * be read must not fall back to the legacy "user's own authority" reading,
   * which would turn corruption into an escalation. `grantFromMcpToken` does
   * that by testing the raw column alongside this.
   */
  parseStoredPermissions(): McpTokenStoredPermissions | null {
    if (!this.permissions) return null;

    try {
      const parsed =
        typeof this.permissions === 'string'
          ? JSON.parse(this.permissions)
          : this.permissions;

      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /** The scopes this credential grants, or null for a legacy one. */
  parsePermissions(): McpTokenPermissionsJson | null {
    const stored = this.parseStoredPermissions();

    return Array.isArray(stored?.scopes)
      ? (stored as McpTokenPermissionsJson)
      : null;
  }

  /**
   * A row whose authority is its own scopes names no base: it carries the
   * sentinel in `base_id`, which the composite primary key will not let be
   * null.
   */
  static isScoped(token: Pick<MCPToken, 'base_id'>) {
    return !token.base_id || token.base_id === NO_SCOPE;
  }

  /**
   * The scope to address a row under. A scoped row's columns hold the
   * sentinel, which the meta layer does not know as a scope — but
   * `nc_mcp_tokens` is a root-scope table, so ROOT reaches any row while the
   * columns stay the pin `grantFromMcpToken` reads.
   */
  static metaContext(
    token: Pick<MCPToken, 'fk_workspace_id' | 'base_id'>,
  ): NcContext {
    return (
      this.isScoped(token)
        ? { workspace_id: RootScopes.ROOT, base_id: RootScopes.ROOT }
        : { workspace_id: token.fk_workspace_id, base_id: token.base_id }
    ) as NcContext;
  }

  public static async validateToken(
    context: NcContext,
    token: string,
    id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const mcpToken = await this.get(context, id, ncMeta);

    if (!mcpToken || token !== mcpToken.token) {
      NcError.notFound('MCP Token not found');
    }

    return mcpToken;
  }

  public static async get(
    context: NcContext,
    mcpTokenId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const key = `${CacheScope.MCP_TOKEN}:${mcpTokenId}`;
    let mcpToken = await NocoCache.get(context, key, CacheGetType.TYPE_OBJECT);

    if (!mcpToken) {
      mcpToken = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MCP_TOKENS,
        mcpTokenId,
      );

      if (mcpToken) {
        await NocoCache.set(context, key, mcpToken);
      }
    }

    return mcpToken && new MCPToken(mcpToken);
  }

  public static async list(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(context, CacheScope.MCP_TOKEN, [
      context.base_id,
      userId,
    ]);
    let { list: mcpTokenList } = cachedList;

    if (!cachedList.isNoneList && !mcpTokenList.length) {
      mcpTokenList = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.MCP_TOKENS,
        {
          condition: {
            fk_user_id: userId,
          },
          orderBy: {
            created_at: 'asc',
          },
        },
      );
      await NocoCache.setList(
        context,
        CacheScope.MCP_TOKEN,
        [context.base_id, userId],
        mcpTokenList,
        ['id'],
      );
    }

    return mcpTokenList.map((mcpToken) => {
      delete mcpToken.token;
      return new MCPToken(mcpToken);
    });
  }

  public static async listByUser(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const mcpTokenList = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MCP_TOKENS,
      {
        condition: {
          fk_user_id: userId,
        },
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    return mcpTokenList.map((mcpToken) => {
      delete mcpToken.token;
      return new MCPToken(mcpToken);
    });
  }

  public static async insert(
    context: NcContext,
    // `permissions` is not on the generated `MCPTokenType` (Api.ts is built
    // from swagger and not hand-edited), so it is widened here rather than
    // there.
    mcpToken: Partial<MCPTokenType> & {
      permissions?: string | McpTokenPermissionsJson;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(mcpToken, [
      'title',
      'base_id',
      'fk_user_id',
      'fk_workspace_id',
      'permissions',
    ]);

    if (insertObj.permissions && typeof insertObj.permissions !== 'string') {
      insertObj.permissions = JSON.stringify(insertObj.permissions);
    }

    insertObj.token = nanoid(32);

    insertObj.order = await ncMeta.metaGetNextOrder(MetaTable.MCP_TOKENS, {
      base_id: context.base_id,
    });

    const { id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      insertObj,
    );

    return this.get(context, id, ncMeta).then(async (res) => {
      const key = `${CacheScope.MCP_TOKEN}:${id}`;
      await NocoCache.appendToList(
        context,
        CacheScope.MCP_TOKEN,
        [context.base_id, mcpToken.fk_user_id],
        key,
      );
      return res;
    });
  }

  public static async update(
    context: NcContext,
    mcpTokenId: string,
    mcpToken: Partial<MCPTokenType> & {
      permissions?: string | McpTokenPermissionsJson;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(mcpToken, ['token', 'title', 'permissions']);

    if (updateObj.permissions && typeof updateObj.permissions !== 'string') {
      updateObj.permissions = JSON.stringify(updateObj.permissions);
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      prepareForDb(updateObj),
      mcpTokenId,
    );

    const key = `${CacheScope.MCP_TOKEN}:${mcpTokenId}`;
    await NocoCache.update(context, key, updateObj);
    await this.delBypassCache(mcpTokenId);

    return await this.get(context, mcpTokenId, ncMeta);
  }

  public static async delete(
    context: NcContext,
    mcpTokenId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const token = await this.get(context, mcpTokenId, ncMeta);
    if (!token) return false;

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      mcpTokenId,
    );

    const key = `${CacheScope.MCP_TOKEN}:${mcpTokenId}`;
    await NocoCache.del(context, key);
    await this.delBypassCache(mcpTokenId);

    return true;
  }

  /**
   * Record a base this credential itself created, so its own base pin does not
   * shut it out of it.
   *
   * Only `created_bases` is written — never `scopes` — so a legacy credential
   * stays the legacy credential it was: same authority, same reading, one more
   * base it can address. (A scoped credential needs nothing recorded: it can
   * only create where it holds a workspace-wide or account-wide scope, and
   * that scope already covers whatever it creates.)
   *
   * Read-modify-write on a single JSON column: two creates racing can lose an
   * append, and the loser is a refusal the agent can report rather than a
   * widening nobody can see.
   */
  public static async recordCreatedBase(
    token: MCPToken,
    baseId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const stored: McpTokenStoredPermissions =
      token.parseStoredPermissions() ?? {
        version: 1,
      };

    if (stored.created_bases?.includes(baseId)) return;

    stored.created_bases = [...(stored.created_bases ?? []), baseId];

    const context = MCPToken.metaContext(token);
    const permissions = JSON.stringify(stored);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      { permissions },
      token.id,
    );

    await NocoCache.update(context, `${CacheScope.MCP_TOKEN}:${token.id}`, {
      permissions,
    });
    await this.delBypassCache(token.id);
  }

  /**
   * The row is cached under two contexts: its own, and the bypass one every
   * caller that has only an id must read it under — `extract-ids` and the MCP
   * route itself. The secret is validated off that copy, so a regenerate or a
   * delete has to reach it or the old secret keeps working.
   */
  private static async delBypassCache(mcpTokenId: string) {
    await NocoCache.del(
      { workspace_id: RootScopes.FULL_BYPASS, base_id: RootScopes.FULL_BYPASS },
      `${CacheScope.MCP_TOKEN}:${mcpTokenId}`,
    );
  }

  public static async bulkDelete(
    params: Partial<
      Pick<MCPToken, 'fk_workspace_id' | 'base_id' | 'fk_user_id'>
    >,
    ncMeta = Noco.ncMeta,
  ) {
    const condition = extractProps(params, [
      'fk_workspace_id',
      'base_id',
      'fk_user_id',
    ]);

    if (
      !condition.fk_workspace_id &&
      !condition.base_id &&
      !condition.fk_user_id
    ) {
      NcError.badRequest(
        'At least one of fk_workspace_id, base_id or fk_user_id is required',
      );
    }

    const tokens = await ncMeta.metaList2(
      RootScopes.ROOT,
      RootScopes.ROOT,
      MetaTable.MCP_TOKENS,
      {
        condition,
      },
    );

    for (const token of tokens) {
      await ncMeta.metaDelete(
        RootScopes.ROOT,
        RootScopes.ROOT,
        MetaTable.MCP_TOKENS,
        token.id,
      );

      const key = `${CacheScope.MCP_TOKEN}:${token.id}`;
      await NocoCache.del(
        {
          workspace_id: token.fk_workspace_id,
          base_id: token.base_id,
        },
        key,
      );
      await this.delBypassCache(token.id);
    }

    return true;
  }
}
