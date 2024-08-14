import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class WorkspaceUsersController {
  constructor(private readonly workspaceUsersService: WorkspaceUsersService) {}

  @Get('/api/v1/workspaces/:workspaceId/users')
  @Acl('workspaceUserList', {
    scope: 'workspace',
  })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return await this.workspaceUsersService.list({
      workspaceId,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @Get('/api/v1/workspaces/:workspaceId/users/:userId')
  @Acl('workspaceUserGet', {
    scope: 'workspace',
  })
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
  ) {
    return await this.workspaceUsersService.get({
      workspaceId,
      userId,
    });
  }

  @Patch('/api/v1/workspaces/:workspaceId/users/:userId')
  @Acl('workspaceUserUpdate', {
    scope: 'workspace',
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.workspaceUsersService.update({
      workspaceId,
      userId,
      roles: body.roles,
      siteUrl: req.ncSiteUrl,
      req,
    });
  }

  @Delete('/api/v1/workspaces/:workspaceId/users/:workspaceUserId')
  @Acl('workspaceUserDelete', {
    scope: 'workspace',
  })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('workspaceUserId') workspaceUserId: string,
    @Req() req: NcRequest,
  ) {
    return await this.workspaceUsersService.delete({
      workspaceId,
      userId: workspaceUserId,
      req,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations')
  @Acl('workspaceInvite', {
    scope: 'workspace',
  })
  async invite(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.workspaceUsersService.invite({
      workspaceId,
      body,
      invitedBy: req.user,
      siteUrl: req.ncSiteUrl,
      req,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations/:invitationToken/accept')
  @Acl('workspaceInvitationAccept', {
    scope: 'workspace',
  })
  async acceptInvite(
    @Param('invitationToken') invitationToken: string,
    @Param('userId') userId: string,
  ) {
    return await this.workspaceUsersService.acceptInvite({
      invitationToken,
      userId,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations/:invitationToken/reject')
  @Acl('workspaceInvitationReject', {
    scope: 'workspace',
  })
  async rejectInvite(
    @Param('invitationToken') invitationToken: string,
    @Param('userId') userId: string,
  ) {
    return await this.workspaceUsersService.rejectInvite({
      invitationToken,
      userId,
    });
  }
}
