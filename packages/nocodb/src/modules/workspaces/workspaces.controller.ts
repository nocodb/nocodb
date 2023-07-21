import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UseAclMiddleware } from '../../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { NcError } from '../../helpers/catchError';
import { MetaTable } from '../../utils/globals';
import { MetaService } from '../../meta/meta.service';
import { WorkspacesService } from './workspaces.service';
import type { WorkspaceType } from 'nocodb-sdk';

@Controller()
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly metaService: MetaService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('/api/v1/workspaces/')
  @UseAclMiddleware({
    permissionName: 'workspaceList',
    workspaceMode: true,
  })
  async list(@Request() req) {
    return await this.workspacesService.list({
      user: req.user,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('/api/v1/workspaces/:workspaceId')
  @UseAclMiddleware({
    permissionName: 'workspaceGet',
  })
  async get(@Param('workspaceId') workspaceId: string, @Request() req) {
    const workspace: WorkspaceType & {
      roles?: any;
    } = await this.workspacesService.get({
      workspaceId,
      user: req.user,
    });

    workspace.roles = req.user?.roles;

    return workspace;
  }

  @UseGuards(AuthGuard('jwt'))
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

  @UseGuards(AuthGuard('jwt'))
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

  @UseGuards(AuthGuard('jwt'))
  @Post('/api/v1/workspaces/:workspaceId/upgrade')
  @UseAclMiddleware({
    permissionName: 'workspaceUpgrade',
  })
  async upgrade(@Param('workspaceId') workspaceId: string, @Request() req) {
    return await this.workspacesService.upgrade({
      workspaceId,
      user: req.user,
    });
  }

  @UseGuards(AuthGuard('jwt'))
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

  @UseGuards(AuthGuard('jwt'))
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

  @UseGuards(AuthGuard('jwt'))
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

  // Todo: move logic to service
  @Patch('/api/v1/workspaces/:workspaceId/status')
  @UseGuards(AuthGuard('basic'))
  async updateStatus(
    @Req() req,
    @Body() body,
    @Param('workspaceId') workspaceId: string,
  ) {
    if (!body.status) NcError.badRequest('Missing status in body');

    const workspace = await this.metaService.metaGet2(
      null,
      null,
      MetaTable.WORKSPACE,
      workspaceId,
    );

    if (!workspace) NcError.notFound('Workspace not found');

    await this.metaService.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      {
        status: body.status,
        message: body.message,
      },
      workspace.id,
    );

    return true;
  }
}
