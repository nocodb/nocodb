import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EnterpriseOrgUserRoles, OrgUserRoles } from 'nocodb-sdk';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';
import { NcRequest } from '~/interface/config';
import { OrgUsersService as OrgUsersServiceOnPrem } from '~/ee-on-prem/services/org-users.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import Noco from '~/Noco';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgUsersController extends OrgUsersControllerCE {
  constructor(protected readonly orgUsersService: OrgUsersServiceOnPrem) {
    super(orgUsersService);
  }

  @Get('/api/v1/users')
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN, EnterpriseOrgUserRoles.ADMIN],
    blockApiTokenAccess: true,
    blockOAuthTokenAccess: true,
  })
  async userList(@Req() req: NcRequest) {
    // Unlicensed — delegate to CE controller (PagedResponseImpl wrapped)
    if (!Noco.isEE() || !Noco.ncDefaultOrgId) {
      return super.userList(req);
    }
    return this.orgUsersService.userList({
      query: req.query,
      reqUser: req.user,
    });
  }

  /**
   * Invite-picker endpoint — mirrors cloud's
   * `GET /api/v2/orgs/:orgId/users/invitable`. Admin-only: only org admins
   * (cloud-org-level-owner) and global super admins can see other org
   * members in the picker. Workspace owners who lack org admin rights get a
   * 403 — the frontend swallows that and falls back to plain email input.
   * `excludeWorkspaceId` / `excludeBaseId` filter out users already in that
   * workspace/base.
   */
  @Get('/api/v2/orgs/:orgId/users/invitable')
  @HttpCode(200)
  @Acl('orgUserListForInvite', {
    scope: 'cloud-org',
    blockApiTokenAccess: true,
  })
  async getOrgUsers(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Query('excludeWorkspaceId') excludeWorkspaceId?: string,
    @Query('excludeBaseId') excludeBaseId?: string,
  ) {
    if (!Noco.isEE() || !Noco.ncDefaultOrgId) {
      return [];
    }
    return this.orgUsersService.getOrgUsers({
      orgId,
      req,
      excludeWorkspaceId,
      excludeBaseId,
    });
  }

  @Post('/api/v1/orgs/:orgId/users')
  @HttpCode(200)
  @Acl('userAdd', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN, EnterpriseOrgUserRoles.ADMIN],
    blockApiTokenAccess: true,
  })
  async addToOrg(
    @Param('orgId') _orgId: string,
    @Body() body: { email: string; org_role?: EnterpriseOrgUserRoles },
    @Req() req: NcRequest,
  ) {
    return this.orgUsersService.addToOrg({
      email: body.email,
      orgRole: body.org_role,
      req,
    });
  }

  @Patch('/api/v1/orgs/:orgId/users/:userId')
  @Acl('userUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN, EnterpriseOrgUserRoles.ADMIN],
    blockApiTokenAccess: true,
  })
  async updateOrgRole(
    @Param('orgId') _orgId: string,
    @Param('userId') userId: string,
    @Body() body: { org_role: EnterpriseOrgUserRoles },
    @Req() req: NcRequest,
  ) {
    await this.orgUsersService.updateOrgRole({
      userId,
      orgRole: body.org_role,
      req,
    });
    return { msg: 'Org role updated' };
  }

  @Delete('/api/v1/orgs/:orgId/users/:userId')
  @Acl('userDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN, EnterpriseOrgUserRoles.ADMIN],
    blockApiTokenAccess: true,
  })
  async removeFromOrg(
    @Param('orgId') _orgId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
  ) {
    await this.orgUsersService.removeFromOrg({ userId, req });
    return { msg: 'User removed from organization' };
  }
}
