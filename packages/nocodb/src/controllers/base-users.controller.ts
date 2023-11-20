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
import { ProjectUserReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BaseUsersController {
  constructor(protected readonly baseUsersService: BaseUsersService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/users',
    '/api/v2/meta/bases/:baseId/users',
  ])
  @Acl('userList')
  async userList(@Param('baseId') baseId: string, @Req() req: Request) {
    return {
      users: await this.baseUsersService.userList({
        baseId,
        query: req.query,
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
    @Param('baseId') baseId: string,
    @Req() req: Request,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }
    return await this.baseUsersService.userInvite({
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
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
    @Body()
    body: ProjectUserReqType & {
      base_id: string;
    },
  ): Promise<any> {
    await this.baseUsersService.baseUserUpdate({
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
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<any> {
    await this.baseUsersService.baseUserDelete({
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
    @Param('baseId') baseId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    await this.baseUsersService.baseUserInviteResend({
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
    @Param('baseId') baseId: string,
    @Req() req: Request,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    return await this.baseUsersService.baseUserMetaUpdate({
      baseId,
      body,
      user: req.user,
    });
  }
}
