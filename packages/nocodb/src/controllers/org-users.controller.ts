import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '../guards/global/global.guard';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { User } from '../models';
import { OrgUsersService } from '../services/org-users.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class OrgUsersController {
  constructor(private readonly orgUsersService: OrgUsersService) {}

  @Get('/api/v1/users')
  @Acl('userList', {
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userList(@Request() req) {
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
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userAdd(@Body() body, @Request() req) {
    const result = await this.orgUsersService.userAdd({
      user: req.body,
      req,
    });

    return result;
  }

  @Post('/api/v1/users/settings')
  @HttpCode(200)
  @Acl('userSettings', {
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
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async userInviteResend(
    @Request() req,
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
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async generateResetUrl(@Request() req, @Param('userId') userId: string) {
    const result = await this.orgUsersService.generateResetUrl({
      siteUrl: req.ncSiteUrl,
      userId,
    });

    return result;
  }

  @Get('/api/v1/app-settings')
  @Acl('appSettingsGet', {
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
