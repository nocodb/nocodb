import { Injectable } from '@nestjs/common';
import { nanoid } from 'nanoid';
import type { MCPTokenType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Base, MCPToken, Workspace } from '~/models';
import { processConcurrently } from '~/utils/dataUtils';
import { RootScopes } from '~/utils/globals';

@Injectable()
export class McpTokenService {
  async list(context: NcContext, req: NcRequest) {
    const userId = req.user.id;
    return await MCPToken.list(context, userId);
  }

  async create(
    context: NcContext,
    payload: Partial<MCPTokenType>,
    req: NcRequest,
  ) {
    // Set required fields
    payload.fk_user_id = req.user.id;
    payload.fk_workspace_id = context.workspace_id;
    payload.base_id = context.base_id;

    payload.title = payload.title?.trim();

    const mcp = await MCPToken.insert(context, payload);

    return {
      ...mcp,
      base: await Base.get(context, mcp.base_id),
      workspace: await Workspace.get(mcp.fk_workspace_id),
    };
  }

  async regenerateToken(
    context: NcContext,
    tokenId: string,
    payload: Pick<MCPTokenType, 'token'>,
  ) {
    // Verify token exists
    const token = await MCPToken.get(context, tokenId);
    if (!token) {
      NcError.get(context).notFound('MCP token not found');
    }

    payload.token = nanoid(32);

    const mcp = await MCPToken.update(context, tokenId, payload);

    return {
      ...mcp,
      base: await Base.get(context, mcp.base_id),
      workspace: await Workspace.get(mcp.fk_workspace_id),
    };
  }

  async delete(context: NcContext, tokenId: string) {
    const token = await MCPToken.get(context, tokenId);

    if (!token) {
      NcError.notFound('MCP token not found');
    }

    const success = await MCPToken.delete(context, tokenId);
    if (!success) {
      NcError.internalServerError('Failed to delete MCP token');
    }

    return true;
  }

  async get(context: NcContext, tokenId: string) {
    const token = await MCPToken.get(context, tokenId);
    if (!token) {
      NcError.notFound('MCP token not found');
    }

    return {
      ...token,
      base: await Base.get(context, token.base_id),
      workspace: await Workspace.get(token.fk_workspace_id),
    };
  }

  async listByUserId(context: NcContext, req: NcRequest) {
    const userId = req.user.id;
    const tokens = await MCPToken.listByUser(context, userId);

    const workspaceIds = new Set<string>();
    const baseIds = new Set<string>();

    tokens.forEach((token: any) => {
      if (token.fk_workspace_id) workspaceIds.add(token.fk_workspace_id);
      if (token.base_id) baseIds.add(token.base_id);
    });

    const workspaceMap = new Map<string, Workspace>();
    const baseMap = new Map<string, Base>();

    await processConcurrently(
      [...Array.from(workspaceIds), ...Array.from(baseIds)],
      async (id) => {
        try {
          if (workspaceIds.has(id)) {
            const workspace = await Workspace.get(id);
            if (workspace?.title) {
              workspaceMap.set(id, workspace);
            }
          } else {
            const base = await Base.get(
              {
                workspace_id: RootScopes.BYPASS,
                base_id: RootScopes.BYPASS,
              },
              id,
            );
            if (base?.title) {
              baseMap.set(id, base);
            }
          }
        } catch (e) {
          console.log(e);
        }
      },
    );

    return tokens.map((token: any) => ({
      ...token,
      workspace: token.fk_workspace_id
        ? workspaceMap.get(token.fk_workspace_id) || null
        : null,
      base: token.base_id ? baseMap.get(token.base_id) || null : null,
    }));
  }
}
