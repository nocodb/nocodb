import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { WorkspaceUsersService } from './workspace-users.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, AuthGuard('jwt'))
export class WorkspaceUsersController {
  constructor(private readonly workspaceUsersService: WorkspaceUsersService) {}

  @Get('/api/v1/workspaces/:workspaceId/users')
  @UseAclMiddleware({
    permissionName: 'workspaceUserList',
  })
  async list(@Param('workspaceId') workspaceId: string) {
    return await this.workspaceUsersService.list({
      workspaceId,
    });
  }

  @Get('/api/v1/workspaces/:workspaceId/users/:userId')
  @UseAclMiddleware({
    permissionName: 'workspaceUserGet',
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
  @UseAclMiddleware({
    permissionName: 'workspaceUserUpdate',
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') userId: string,
    @Body() body: any,
  ) {
    return await this.workspaceUsersService.update({
      workspaceId,
      userId,
      roles: body.roles,
    });
  }

  @Delete('/api/v1/workspaces/:workspaceId/users/:workspaceUserId')
  @UseAclMiddleware({
    permissionName: 'workspaceUserDelete',
  })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('workspaceUserId') workspaceUserId: string,
  ) {
    return await this.workspaceUsersService.delete({
      workspaceId,
      userId: workspaceUserId,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations')
  @UseAclMiddleware({
    permissionName: 'workspaceInvite',
  })
  async invite(@Param('workspaceId') workspaceId: string, @Body() body: any) {
    return await this.workspaceUsersService.invite({
      workspaceId,
      body,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/invitations/:invitationToken/accept')
  @UseAclMiddleware({
    permissionName: 'workspaceInvitationAccept',
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
  @UseAclMiddleware({
    permissionName: 'workspaceInvitationReject',
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
