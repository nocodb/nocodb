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
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { ProjectUsersService } from '../services/project-users/project-users.service';

@UseGuards(GlobalGuard)
@Controller()
export class ProjectUsersController {
  constructor(private readonly projectUsersService: ProjectUsersService) {}

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
    return await this.projectUsersService.userInvite({
      projectId,
      projectUser: body,
      req,
    });
  }

  @Patch('/api/v1/db/meta/projects/:projectId/users/:userId')
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
}
