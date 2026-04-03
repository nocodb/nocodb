import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import type { CloudOrgUserRoles } from 'nocodb-sdk';
import { OrgUsersController as OrgUsersControllerCE } from 'src/controllers/org-users.controller';
import { OrgUsersService } from '~/services/org-users.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { OrgUserRoles } from 'nocodb-sdk';

@Controller()
export class OrgUsersController extends OrgUsersControllerCE {
  constructor(protected readonly orgUsersService: OrgUsersService) {
    super(orgUsersService);
  }

  @Patch('/api/v1/users/:userId/org-role')
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async updateOrgRole(
    @Param('userId') userId: string,
    @Body() body: { org_role: CloudOrgUserRoles },
  ) {
    await (this.orgUsersService as any).updateOrgRole({
      userId,
      orgRole: body.org_role,
    });
    return { msg: 'Org role updated' };
  }
}
