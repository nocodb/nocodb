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
import { ProjectUserReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ProjectUsersService } from '~/services/project-users/project-users.service';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectUsersController {
  constructor(protected readonly projectUsersService: ProjectUsersService) {}

  @Get('/api/v1/db/meta/projects/:projectId/users')
  @Acl('userList')
  async userList(@Param('projectId') projectId: string, @Request() req) {
    return {
      users: await this.projectUsersService.userList({
        projectId,
        query: req.query,
      }),
    };
  }

  @Post('/api/v1/db/meta/projects/:projectId/users')
  @HttpCode(200)
  @Acl('userInvite')
  async userInvite(
    @Param('projectId') projectId: string,
    @Request() req,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }
    return await this.projectUsersService.userInvite({
      projectId,
      projectUser: body,
      req,
    });
  }

  @Patch('/api/v1/db/meta/projects/:projectId/users/:userId')
  @Acl('projectUserUpdate')
  async projectUserUpdate(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Request() req,
    @Body()
    body: ProjectUserReqType & {
      project_id: string;
    },
  ): Promise<any> {
    await this.projectUsersService.projectUserUpdate({
      projectUser: body,
      projectId,
      userId,
      req,
    });
    return {
      msg: 'The user has been updated successfully',
    };
  }

  @Delete('/api/v1/db/meta/projects/:projectId/users/:userId')
  @Acl('projectUserDelete')
  async projectUserDelete(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Request() req,
  ): Promise<any> {
    await this.projectUsersService.projectUserDelete({
      projectId,
      userId,
      req,
    });
    return {
      msg: 'The user has been deleted successfully',
    };
  }

  @Post('/api/v1/db/meta/projects/:projectId/users/:userId/resend-invite')
  @HttpCode(200)
  @Acl('projectUserInviteResend')
  async projectUserInviteResend(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Request() req,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    await this.projectUsersService.projectUserInviteResend({
      projectId: projectId,
      userId: userId,
      projectUser: body,
      req,
    });
    return {
      msg: 'The invitation has been sent to the user',
    };
  }

  @Patch('/api/v1/db/meta/projects/:projectId/user')
  @Acl('projectUserMetaUpdate')
  async projectUserMetaUpdate(
    @Param('projectId') projectId: string,
    @Request() req,
    @Body() body: ProjectUserReqType,
  ): Promise<any> {
    return await this.projectUsersService.projectUserMetaUpdate({
      projectId,
      body,
      user: req.user,
    });
  }
}
