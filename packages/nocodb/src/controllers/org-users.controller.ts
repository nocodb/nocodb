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
import { Request } from 'express';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { OrgUsersService } from '~/services/org-users.service';
import { User } from '~/models';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class OrgUsersController {
  constructor(private readonly orgUsersService: OrgUsersService) {}

  @Get('/api/v1/users')
  @Acl('userList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userList(@Req() req: Request) {
    return new PagedResponseImpl(
      await this.orgUsersService.userList({
        query: req.query,
      }),
      {
        ...req.query,
        // todo: fix - wrong count
        count: await User.count(req.query),
      },
    );
  }

  @Patch('/api/v1/users/:userId')
  @Acl('userUpdate', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userUpdate(@Body() body, @Param('userId') userId: string) {
    return await this.orgUsersService.userUpdate({
      user: body,
      userId,
    });
  }

  @Delete('/api/v1/users/:userId')
  @Acl('userDelete', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userDelete(@Param('userId') userId: string) {
    await this.orgUsersService.userDelete({
      userId,
    });
    return { msg: 'The user has been deleted successfully' };
  }

  @Post('/api/v1/users')
  @HttpCode(200)
  @Acl('userAdd', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userAdd(@Body() body, @Req() req: Request) {
    const result = await this.orgUsersService.userAdd({
      user: req.body,
      req,
    });

    return result;
  }

  @Post('/api/v1/users/settings')
  @HttpCode(200)
  @Acl('userSettings', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userSettings(@Body() body): Promise<any> {
    await this.orgUsersService.userSettings(body);
    return {};
  }

  @Post('/api/v1/users/:userId/resend-invite')
  @HttpCode(200)
  @Acl('userInviteResend', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userInviteResend(
    @Req() req: Request,
    @Param('userId') userId: string,
  ): Promise<any> {
    await this.orgUsersService.userInviteResend({
      userId,
      req,
    });

    return { msg: 'The invitation has been sent to the user' };
  }

  @Post('/api/v1/users/:userId/generate-reset-url')
  @HttpCode(200)
  @Acl('generateResetUrl', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async generateResetUrl(@Req() req: Request, @Param('userId') userId: string) {
    const result = await this.orgUsersService.generateResetUrl({
      siteUrl: req.ncSiteUrl,
      userId,
    });

    return result;
  }

  @Get('/api/v1/app-settings')
  @Acl('appSettingsGet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async appSettingsGet() {
    const settings = await this.orgUsersService.appSettingsGet();
    return settings;
  }

  @Post('/api/v1/app-settings')
  @HttpCode(200)
  @Acl('appSettingsSet', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async appSettingsSet(@Body() body) {
    await this.orgUsersService.appSettingsSet({
      settings: body,
    });

    return { msg: 'The app settings have been saved' };
  }
}
