import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
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
import dayjs from 'dayjs';
import { MCPToken, User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcError } from '~/helpers/catchError';
import { MetaApiLimiterGuard } from '~/ee/guards/meta-api-limiter.guard';

@Controller('mcp/:mcpTokenId')
@UseGuards(MetaApiLimiterGuard)
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  @Get()
  @Delete()
  async handleMcpRequest(
    @Param('mcpTokenId') tokenId: string,
    @Request() req: NcRequest,
    @Response() res,
    @TenantContext() context: NcContext,
  ) {
    const mcpToken = await MCPToken.get(context, tokenId);

    if (!mcpToken || dayjs(mcpToken.expires_at).isAfter(dayjs())) {
      res.status(404).send('MCP Token not found');
      return;
    }

    req.user = await User.getWithRoles(context, mcpToken.fk_user_id, {
      baseId: mcpToken.base_id,
      workspaceId: mcpToken.fk_workspace_id,
    });

    // Check if user base_role is not no_access
    if (extractRolesObj(req.user.base_roles)[ProjectRoles.NO_ACCESS]) {
      NcError.forbidden('User has no access');
    }

    return await this.mcpService.handleRequest(tokenId, context, req, res);
  }
}
