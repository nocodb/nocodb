import { NcError } from 'src/helpers/catchError';
import { nanoid } from 'nanoid';
import type { MCPTokenType, NcContext } from 'nocodb-sdk';
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

  constructor(mcpToken: MCPToken | MCPTokenType) {
    Object.assign(this, mcpToken);
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
    let mcpToken = await NocoCache.get(key, CacheGetType.TYPE_OBJECT);

    if (!mcpToken) {
      mcpToken = await ncMeta.metaGet2(
        context.workspace_id,
        context.base_id,
        MetaTable.MCP_TOKENS,
        mcpTokenId,
      );

      if (mcpToken) {
        await NocoCache.set(key, mcpToken);
      }
    }

    return mcpToken && new MCPToken(mcpToken);
  }

  public static async list(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const cachedList = await NocoCache.getList(CacheScope.MCP_TOKEN, [
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

  public static async insert(
    context: NcContext,
    mcpToken: Partial<MCPTokenType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(mcpToken, [
      'title',
      'base_id',
      'fk_user_id',
      'fk_workspace_id',
    ]);

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
    mcpToken: Partial<MCPTokenType>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(mcpToken, ['token']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      prepareForDb(updateObj),
      mcpTokenId,
    );

    const key = `${CacheScope.MCP_TOKEN}:${mcpTokenId}`;
    await NocoCache.update(key, updateObj);

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
    await NocoCache.del(key);

    return true;
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
      await NocoCache.del(key);
    }

    return true;
  }
}
