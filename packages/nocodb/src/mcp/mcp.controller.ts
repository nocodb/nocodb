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
import type { UserType } from 'nocodb-sdk';
import { MCPToken, User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

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
}
