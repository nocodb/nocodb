import {
  All,
  Controller,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import {
  extractRolesObj,
  NcContext,
  NcRequest,
  ProjectRoles,
} from 'nocodb-sdk';
import { MCPToken, OAuthToken, User } from '~/models';
import Base from '~/models/Base';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { RootScopes } from '~/utils/globals';

@Controller()
@UseGuards(MetaApiLimiterGuard)
export class McpController {
  constructor(protected readonly mcpService: McpService) {}

  @All('mcp')
  async handleMcpBearerRequest(
    @Request() req: NcRequest,
    @Response() res,
  ) {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      NcError.unauthorized('Bearer token required');
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      NcError.unauthorized('Bearer token required');
    }

    const oAuthToken = await OAuthToken.getByAccessToken(token);
    if (!oAuthToken || oAuthToken.is_revoked) {
      NcError.unauthorized('Invalid OAuth token');
    }
    if (
      oAuthToken.access_token_expires_at &&
      new Date(oAuthToken.access_token_expires_at) < new Date()
    ) {
      NcError.unauthorized('OAuth token expired');
    }

    const baseId = oAuthToken.granted_resources?.base_id;
    if (!baseId) {
      NcError.badRequest(
        'OAuth token must be scoped to a base for MCP access',
      );
    }

    const base = await Base.get(
      { workspace_id: RootScopes.BYPASS, base_id: RootScopes.BYPASS },
      baseId,
    );
    if (!base) {
      NcError.badRequest('Base not found for OAuth token');
    }

    const workspaceId =
      oAuthToken.granted_resources?.workspace_id || base.fk_workspace_id;

    const context: NcContext = {
      workspace_id: workspaceId,
      base_id: baseId,
    };
    req.context = context;
    req['ncBaseId'] = baseId;
    req['ncWorkspaceId'] = workspaceId;

    req.user = (await User.getWithRoles(context, oAuthToken.fk_user_id, {
      baseId,
      workspaceId,
    })) as typeof req.user;

    if (extractRolesObj(req.user.base_roles)[ProjectRoles.NO_ACCESS]) {
      NcError.forbidden('User has no access');
    }

    await OAuthToken.updateLastUsed(oAuthToken.id);

    return await this.mcpService.handleRequest(null, context, req, res);
  }

  @All('mcp/:mcpTokenId')
  async handleMcpRequest(
    @Param('mcpTokenId') tokenId: string,
    @Request() req: NcRequest,
    @Response() res,
    @TenantContext() context: NcContext,
  ) {
    if (!req.headers['xc-mcp-token']) {
      NcError.unauthorized('MCP token missing');
    }

    const mcpToken = await MCPToken.validateToken(
      context,
      req.headers['xc-mcp-token'] as string,
      tokenId,
    );

    req.user = (await User.getWithRoles(context, mcpToken.fk_user_id, {
      baseId: mcpToken.base_id,
      workspaceId: mcpToken.fk_workspace_id,
    })) as typeof req.user;

    // Check if user base_role is not no_access
    if (extractRolesObj(req.user.base_roles)[ProjectRoles.NO_ACCESS]) {
      NcError.forbidden('User has no access');
    }

    return await this.mcpService.handleRequest(tokenId, context, req, res);
  }
}
