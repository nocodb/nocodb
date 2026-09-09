import {
  All,
  Controller,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest, ProjectRoles } from 'nocodb-sdk';
import { MCPToken, User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { hasMinimumRole } from '~/utils/roleHelper';

@Controller()
@UseGuards(MetaApiLimiterGuard)
export class McpController {
  constructor(protected readonly mcpService: McpService) {}

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

    User.assertNotBlocked(req.user);

    if (!hasMinimumRole(req.user, ProjectRoles.VIEWER)) {
      NcError.forbidden('User has no access');
    }

    return await this.mcpService.handleRequest(tokenId, context, req, res);
  }
}
