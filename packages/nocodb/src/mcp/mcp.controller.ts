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
import { MCPToken, User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard)
export class McpController {
  constructor(private readonly mcpService: McpService) {}

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

  @All('mcp')
  @UseGuards(GlobalGuard)
  async handleMcpOAuthRequest(@Request() req: NcRequest, @Response() res) {
    const ctx = (req.user as any).oauth_granted_resources;

    return await this.mcpService.handleRequest(
      null,
      {
        workspace_id: ctx.workspace_id,
        base_id: ctx.base_id,
        user: req.user,
        nc_site_url: req.ncSiteUrl,
      },
      req,
      res,
    );
  }
}
