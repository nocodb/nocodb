import { Injectable } from '@nestjs/common';
import type { MCPTokenType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { MCPToken } from '~/models';

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

    return await MCPToken.insert(context, payload);
  }

  async update(
    context: NcContext,
    tokenId: string,
    payload: Partial<MCPTokenType>,
  ) {
    // Verify token exists
    const token = await MCPToken.get(context, tokenId);
    if (!token) {
      NcError.notFound('MCP token not found');
    }

    return await MCPToken.update(context, tokenId, payload);
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

    return token;
  }
}
