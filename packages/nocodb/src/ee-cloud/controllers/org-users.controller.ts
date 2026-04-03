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
import { OrgUserReqType } from 'nocodb-sdk';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OrgUsersService } from '~/services/org-users.service';
import { NcRequest } from '~/interface/config';

@Controller()
export class OrgUsersController {
  constructor(protected readonly orgUsersService: OrgUsersService) {}

  @Get('/api/v2/orgs/:orgId/users')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgUserList', {
    scope: 'cloud-org',
  })
  async getOrgUsers(@Req() req: NcRequest, @Param('orgId') orgId: string) {
    return this.orgUsersService.getOrgUsers({
      orgId,
      req,
      user: req.user,
    });
  }

  // api for adding user to org
  @Post('/api/v2/orgs/:orgId/user/:userId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgUserAdd')
  async addUserToOrg(
    @Req() req: NcRequest,
    @Body() body: OrgUserReqType,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.orgUsersService.addUserToOrg({
      orgId,
      req,
      userId,
      userProps: body,
    });
  }

  // api for removing user from org
  @Delete('/api/v2/orgs/:orgId/user/:userId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgUserRemove')
  async removeUserFromOrg(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.orgUsersService.removeUserFromOrg({
      orgId,
      req,
      userId,
    });
  }

  // api for updating user role in org
  @Patch('/api/v2/orgs/:orgId/user/:userId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgUserRoleUpdate')
  async updateUserRoleInOrg(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() body: { org_role: string },
  ) {
    return this.orgUsersService.updateUserRoleInOrg({
      orgId,
      userId,
      orgRole: body.org_role as any,
      req,
    });
  }
}
