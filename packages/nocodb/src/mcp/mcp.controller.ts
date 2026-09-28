import {
  All,
  Controller,
  Param,
  Request,
  Response,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest, ProjectRoles } from 'nocodb-sdk';
import { MCPToken, Permission, User } from '~/models';
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
    // `x-api-key` is the only custom header some MCP clients let you set.
    const token = (req.headers['xc-mcp-token'] ??
      req.headers['x-api-key']) as string;

    if (!token) {
      NcError.unauthorized('MCP token missing');
    }

    const mcpToken = await MCPToken.validateToken(context, token, tokenId);

    req.user = (await User.getWithRoles(context, mcpToken.fk_user_id, {
      baseId: mcpToken.base_id,
      workspaceId: mcpToken.fk_workspace_id,
    })) as typeof req.user;

    User.assertNotBlocked(req.user);

    if (!hasMinimumRole(req.user, ProjectRoles.VIEWER)) {
      NcError.forbidden('User has no access');
    }

    // This route authenticates on the MCP token, so GlobalGuard — which is what
    // mirrors the resolved user onto the request context everywhere else — never
    // runs. Writers that stamp LastModifiedBy read `context.user` and deref its
    // id unguarded, so leaving it unset makes them throw.
    this.mirrorGuardUser(context, req);

    await this.loadPermissions(context, req);

    return await this.mcpService.handleRequest(tokenId, context, req, res);
  }

  // The exact field set GlobalGuard puts on `req.context.user`. Copying `req.user`
  // wholesale instead would carry extras the guard omits — `display_name` among
  // them — so a `{currentUser.name}` RLS policy would match a different row set
  // here than in the browser. `base_roles` is what RLS role-subject matching
  // reads (resolveRlsConditions → matchesDirectSubject), so dropping it would
  // leave RLS enabled with every `role` subject failing to match.
  protected mirrorGuardUser(context: NcContext, req: NcRequest) {
    context.user = {
      id: req.user.id,
      email: req.user.email,
      email_verified: req.user.email_verified,
      base_roles: req.user.base_roles,
      direct_teams: req.user.direct_teams,
    };
  }

  // Same reason as the `context.user` mirror above. BaseModelSqlv2.checkPermission
  // reads `req.permissions` and treats an absent list as "no grant configured",
  // i.e. allow — so an unset list silently disables every table and field grant.
  protected async loadPermissions(
    context: NcContext,
    req: NcRequest & { permissions?: Permission[] },
  ) {
    req.permissions =
      req.permissions ?? (await Permission.list(context, context.base_id));
    context.permissions = req.permissions;
  }
}
