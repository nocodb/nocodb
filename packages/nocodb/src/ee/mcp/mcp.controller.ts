import { All, Controller, Request, Response, UseGuards } from '@nestjs/common';
import { NcRequest, ProjectRoles } from 'nocodb-sdk';
import { McpController as McpControllerCE } from 'src/mcp/mcp.controller';
import { User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { hasMinimumRole } from '~/utils/roleHelper';

@Controller()
@UseGuards(MetaApiLimiterGuard)
export class McpController extends McpControllerCE {
  constructor(protected readonly mcpService: McpService) {
    super(mcpService);
  }
  @UseGuards(GlobalGuard)
  @All('mcp')
  async handleMcpOAuthRequest(@Request() req: NcRequest, @Response() res) {
    const context = {
      workspace_id: (req.user as any)?.oauth_granted_resources?.workspace_id,
      base_id: (req.user as any)?.oauth_granted_resources?.base_id,
      user: req.user,
      nc_site_url: req.ncSiteUrl,
    };

    if (!context.workspace_id || !context.base_id) {
      NcError.baseNotFound('Base not found');
    }

    req.user = (await User.getWithRoles(context, req.user.id, {
      baseId: context.base_id,
      workspaceId: context.workspace_id,
    })) as typeof req.user;

    if (!hasMinimumRole(req.user, ProjectRoles.VIEWER)) {
      NcError.forbidden('User has no access');
    }

    return await this.mcpService.handleRequest(null, context, req, res);
  }
}
