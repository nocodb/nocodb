import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { EnterpriseOrgUserRoles, OrgUserRoles } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';
import { OrgUsersService } from '~/services/org-users.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

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
    return this.orgUsersService.userList({
      query: req.query,
    });
  }

  @Patch('/api/v1/users/:userId/org-role')
  @Acl('userUpdate', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
    blockApiTokenAccess: true,
  })
  async updateOrgRole(
    @Param('userId') userId: string,
    @Body() body: { org_role: EnterpriseOrgUserRoles },
  ) {
    await (this.orgUsersService as any).updateOrgRole({
      userId,
      orgRole: body.org_role,
    });
    return { msg: 'Org role updated' };
  }

  @Delete('/api/v1/users/:userId/org')
  @Acl('userDelete', {
    scope: 'org',
    allowedRoles: [
      OrgUserRoles.SUPER_ADMIN,
      EnterpriseOrgUserRoles.ADMIN,
    ],
    blockApiTokenAccess: true,
  })
  async removeFromOrg(@Param('userId') userId: string) {
    await (this.orgUsersService as any).removeFromOrg({ userId });
    return { msg: 'User removed from organization' };
  }
}
