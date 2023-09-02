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
import { WorkspacePlan } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { WorkspacesService } from './workspaces.service';
import type { WorkspaceType } from 'nocodb-sdk';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { CacheScope, MetaTable } from '~/utils/globals';
import { MetaService } from '~/meta/meta.service';
import NocoCache from '~/cache/NocoCache';
import { GlobalGuard } from '~/guards/global/global.guard';

@Controller()
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly metaService: MetaService,
  ) {}

  @UseGuards(GlobalGuard)
  @Get('/api/v1/workspaces/')
  @Acl('workspaceList', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async list(@Request() req) {
    return await this.workspacesService.list({
      user: req.user,
    });
  }

  @UseGuards(GlobalGuard)
  @Get('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceGet', {
    scope: 'workspace',
    blockApiTokenAccess: true,
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

  @UseGuards(GlobalGuard)
  @Post('/api/v1/workspaces/')
  @Acl('workspaceCreate', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async create(@Body() body: any, @Request() req) {
    return await this.workspacesService.create({
      workspaces: body,
      user: req.user,
    });
  }

  @UseGuards(GlobalGuard)
  @Patch('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceUpdate', {
    scope: 'workspace',
    blockApiTokenAccess: true,
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

  @UseGuards(GlobalGuard)
  @Post('/api/v1/workspaces/:workspaceId/upgrade')
  @Acl('workspaceUpgrade', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async upgrade(@Param('workspaceId') workspaceId: string, @Request() req) {
    return await this.workspacesService.upgrade({
      workspaceId,
      user: req.user,
    });
  }

  @UseGuards(GlobalGuard)
  @Delete('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceDelete', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async delete(@Param('workspaceId') workspaceId: string, @Request() req) {
    return await this.workspacesService.delete({
      workspaceId,
      user: req.user,
    });
  }

  @UseGuards(GlobalGuard)
  @Post('/api/v1/workspaces/:workspaceId/projects/:projectId/move')
  @Acl('moveProjectToWorkspace', {
    scope: 'workspace',
    blockApiTokenAccess: true,
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

  @UseGuards(GlobalGuard)
  @Get('/api/v1/workspaces/:workspaceId/projects')
  @Acl('workspaceProjectList', {
    scope: 'workspace',
    blockApiTokenAccess: true,
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

    const updateWorkspacePayload = {
      status: body.status,
      message: body.message,
    };

    if (body['plan']) {
      if (Object.values(WorkspacePlan).includes(body['plan']) === false)
        NcError.badRequest('Invalid plan type');

      updateWorkspacePayload['plan'] = body['plan'];
    }

    await this.metaService.metaUpdate(
      null,
      null,
      MetaTable.WORKSPACE,
      updateWorkspacePayload,
      workspace.id,
    );

    // clear cache
    await NocoCache.del(`${CacheScope.WORKSPACE}:${workspace.id}`);

    return true;
  }
}
