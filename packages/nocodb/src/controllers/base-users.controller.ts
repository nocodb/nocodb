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
import { ProjectRoles, ProjectUserReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseUsersController {
  constructor(protected readonly baseUsersService: BaseUsersService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  @Acl('baseUserList')
  async userList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ) {
    const baseRoles = Object.keys((req.user as any)?.base_roles ?? {});
    const mode =
      baseRoles.includes(ProjectRoles.OWNER) ||
      baseRoles.includes(ProjectRoles.CREATOR)
        ? 'full'
        : 'viewer';

    return {
      users: await this.baseUsersService.userList(context, {
        baseId,
        mode,
      }),
    };
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }
    return await this.baseUsersService.userInvite(context, {
      baseId,
      baseUser: body,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/users/:userId',
    '/api/v2/meta/bases/:baseId/users/:userId',
  ])
  @Acl('baseUserUpdate')
  async baseUserUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body()
    body: ProjectUserReqType & {
      base_id: string;
    },
  ): Promise<any> {
    await this.baseUsersService.baseUserUpdate(context, {
      baseUser: body,
      baseId,
      userId,
      req,
    });
    return {
      msg: 'The user has been updated successfully',
    };
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/users/:userId',
    '/api/v2/meta/bases/:baseId/users/:userId',
  ])
  @Acl('baseUserDelete')
  async baseUserDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
  ): Promise<any> {
    await this.baseUsersService.baseUserDelete(context, {
      baseId,
      userId,
      req,
    });
    return {
      msg: 'The user has been deleted successfully',
    };
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/users/:userId/resend-invite',
    '/api/v2/meta/bases/:baseId/users/:userId/resend-invite',
  ])
  @HttpCode(200)
  @Acl('baseUserInviteResend')
  async baseUserInviteResend(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    await this.baseUsersService.baseUserInviteResend(context, {
      baseId: baseId,
      userId: userId,
      baseUser: body,
      req,
    });
    return {
      msg: 'The invitation has been sent to the user',
    };
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/user',
    '/api/v2/meta/bases/:baseId/user',
  ])
  @Acl('baseUserMetaUpdate')
  async baseUserMetaUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    return await this.baseUsersService.baseUserMetaUpdate(context, {
      baseId,
      body,
      user: req.user,
      req,
    });
  }
}
