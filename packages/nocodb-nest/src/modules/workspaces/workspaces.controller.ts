import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ExtractProjectIdMiddleware,
  UseAclMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { WorkspacesService } from './workspaces.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get('/api/v1/workspaces/')
  @UseAclMiddleware({
    permissionName: 'workspaceList',
  })
  async list(@Request() req) {
    return await this.workspacesService.list({
      user: req.user,
    });
  }

  @Get('/api/v1/workspaces/:workspaceId')
  @UseAclMiddleware({
    permissionName: 'workspaceGet',
  })
  async get(@Param('workspaceId') workspaceId: string, @Request() req) {
    return await this.workspacesService.get({
      workspaceId,
      user: req.user,
    });
  }

  @Post('/api/v1/workspaces/')
  @UseAclMiddleware({
    permissionName: 'workspaceCreate',
  })
  async create(@Body() body: any, @Request() req) {
    return await this.workspacesService.create({
      workspaces: body,
      user: req.user,
    });
  }

  @Patch('/api/v1/workspaces/:workspaceId')
  @UseAclMiddleware({
    permissionName: 'workspaceUpdate',
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Request() req,
  ) {
    return await this.workspacesService.update({
      workspaceId,
      workspace: body,
      user: req.user,
    });
  }

  @Delete('/api/v1/workspaces/:workspaceId')
  @UseAclMiddleware({
    permissionName: 'workspaceDelete',
  })
  async delete(@Param('workspaceId') workspaceId: string, @Request() req) {
    return await this.workspacesService.delete({
      workspaceId,
      user: req.user,
    });
  }

  @Post('/api/v1/workspaces/:workspaceId/projects/:projectId/move')
  @UseAclMiddleware({
    permissionName: 'moveProjectToWorkspace',
  })
  async moveProjectToWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Request() req,
  ) {
    return await this.workspacesService.moveProject({
      workspaceId,
      projectId,
      user: req.user,
    });
  }

  @Get('/api/v1/workspaces/:workspaceId/projects')
  @UseAclMiddleware({
    permissionName: 'workspaceProjectList',
  })
  async listProjects(
    @Param('workspaceId') workspaceId: string,
    @Request() req,
  ) {
    return await this.workspacesService.getProjectList({
      workspaceId,
      user: req.user,
    });
  }
}
