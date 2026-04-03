import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EnterpriseOrgUserRoles, OrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';
import { OrgUsersService } from '~/services/org-users.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import Noco from '~/Noco';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgUsersController extends OrgUsersControllerCE {
  constructor(protected readonly orgUsersService: OrgUsersService) {
    super(orgUsersService);
  }

  @Get('/api/v1/users')
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
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
    });
  }

  @Post('/api/v1/orgs/:orgId/users')
  @HttpCode(200)
  @Acl('userAdd', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
    blockApiTokenAccess: true,
  })
  async addToOrg(
    @Param('orgId') _orgId: string,
    @Body() body: { email: string; org_role?: EnterpriseOrgUserRoles },
    @Req() req: NcRequest,
  ) {
    return (this.orgUsersService as any).addToOrg({
      email: body.email,
      orgRole: body.org_role,
      req,
    });
  }

  @Patch('/api/v1/orgs/:orgId/users/:userId')
  @Acl('userUpdate', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
    blockApiTokenAccess: true,
  })
  async updateOrgRole(
    @Param('orgId') _orgId: string,
    @Param('userId') userId: string,
    @Body() body: { org_role: EnterpriseOrgUserRoles },
  ) {
    await (this.orgUsersService as any).updateOrgRole({
      userId,
      orgRole: body.org_role,
    });
    return { msg: 'Org role updated' };
  }

  @Delete('/api/v1/orgs/:orgId/users/:userId')
  @Acl('userDelete', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
    blockApiTokenAccess: true,
  })
  async removeFromOrg(
    @Param('orgId') _orgId: string,
    @Param('userId') userId: string,
  ) {
    await (this.orgUsersService as any).removeFromOrg({ userId });
    return { msg: 'User removed from organization' };
  }
}
