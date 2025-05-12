import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  Response,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import dayjs from 'dayjs';
import { MCPToken, User } from '~/models';
import { McpService } from '~/mcp/mcp.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller('mcp/:tokenId')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Post()
  @Get()
  @Delete()
  async handleMcpRequest(
    @Param('tokenId') tokenId: string,
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
    });

    return await this.mcpService.handleRequest(tokenId, context, req, res);
  }
}
