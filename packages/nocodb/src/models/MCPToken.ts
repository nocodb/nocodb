import type { MCPTokenType, NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb } from '~/utils/modelUtils';
import { isEE } from '~/utils';

export default class MCPToken implements MCPTokenType {
  id: string;
  title: string;
  expires_at: string;
  order: number;
  fk_workspace_id: string;
  base_id: string;
  fk_user_id: string;
  updated_at: string;
  created_at: string;

  constructor(mcpToken: MCPToken | MCPTokenType) {
    Object.assign(this, mcpToken);
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

    return mcpTokenList.map((mcpToken) => new MCPToken(mcpToken));
  }

  public static async insert(
    context: NcContext,
    mcpToken: Partial<MCPTokenType>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(mcpToken, [
      'title',
      'expires_at',
      'base_id',
      'fk_user_id',
      ...(isEE ? ['fk_workspace_id'] : []),
    ]);

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
    const updateObj = extractProps(mcpToken, ['title', 'expires_at']);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.MCP_TOKENS,
      prepareForDb(updateObj),
      mcpTokenId,
    );

    const key = `${CacheScope.MCP_TOKEN}:${mcpTokenId}`;
    await NocoCache.update(key, updateObj);

    return this.get(context, mcpTokenId, ncMeta);
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

  public static async deleteByBaseUser(
    context: NcContext,
    userId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const tokens = await this.list(context, userId, ncMeta);

    for (const token of tokens) {
      await ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.MCP_TOKENS,
        token.id,
      );

      const key = `${CacheScope.MCP_TOKEN}:${token.id}`;
      await NocoCache.del(key);
    }

    return true;
  }
}
