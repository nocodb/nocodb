import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { WorkspacePlan } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import type { WorkspaceType } from 'nocodb-sdk';
import { WorkspacesService } from '~/services/workspaces.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';
import { MetaService } from '~/meta/meta.service';
import NocoCache from '~/cache/NocoCache';
import { GlobalGuard } from '~/guards/global/global.guard';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

const IS_UPGRADE_ALLOWED_CACHE_KEY = 'nc_upgrade_allowed';

@Controller()
export class WorkspacesController {
  protected logger = new Logger(WorkspacesController.name);

  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceUserService: WorkspaceUsersService,
    private readonly metaService: MetaService,
  ) {}

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Get('/api/v1/workspaces/')
  @Acl('workspaceList', {
    scope: 'org',
  })
  async list(@Req() req: Request) {
    return await this.workspacesService.list({
      user: req.user,
    });
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Get('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceGet', {
    scope: 'workspace',
  })
  async get(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const workspace: WorkspaceType & {
      roles?: any;
    } = await this.workspacesService.get({
      workspaceId,
      user: req.user,
    });

    const workspaceUserCount = await this.workspaceUserService.count({
      workspaceId,
    });

    // temporary workaround to allow only specific users to upgrade
    if (!(workspace as any).fk_org_id) {
      try {
        if (process.env.NODE_ENV === 'test') {
          (workspace as any).isUpgradeAllowed = true;
        } else {
          const cacheVal = await NocoCache.get(
            IS_UPGRADE_ALLOWED_CACHE_KEY,
            CacheGetType.TYPE_STRING,
          );

          (workspace as any).isUpgradeAllowed = cacheVal
            ?.trim?.()
            .split(/\s*,\s*/)
            .includes((req as any).user?.email);
        }
      } catch {
        // ignore
      }
    }

    return { workspace, workspaceUserCount };
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post('/api/v1/workspaces/')
  @Acl('workspaceCreate', {
    scope: 'org',
    blockApiTokenAccess: true,
  })
  async create(@Body() body: any, @Req() req: Request) {
    return await this.workspacesService.create({
      workspaces: body,
      user: req.user,
      req,
    });
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Patch('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceUpdate', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async update(
    @Param('workspaceId') workspaceId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    return await this.workspacesService.update({
      workspaceId,
      workspace: body,
      user: req.user,
      req,
    });
  }

  /*
  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post('/api/v1/workspaces/:workspaceId/upgrade')
  @Acl('workspaceUpgrade', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async upgrade(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    return await this.workspacesService.upgrade({
      workspaceId,
      user: req.user,
    });
  }
  */

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Delete('/api/v1/workspaces/:workspaceId')
  @Acl('workspaceDelete', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async delete(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    return await this.workspacesService.delete({
      workspaceId,
      user: req.user,
      req,
    });
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Post('/api/v1/workspaces/:workspaceId/bases/:baseId/move')
  @Acl('moveProjectToWorkspace', {
    scope: 'workspace',
    blockApiTokenAccess: true,
  })
  async moveProjectToWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Param('baseId') baseId: string,
    @Req() req: Request,
  ) {
    return await this.workspacesService.moveProject({
      workspaceId,
      baseId,
      user: req.user,
    });
  }

  @UseGuards(MetaApiLimiterGuard, GlobalGuard)
  @Get('/api/v1/workspaces/:workspaceId/bases')
  @Acl('workspaceBaseList', {
    scope: 'workspace',
  })
  async listProjects(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return await this.workspacesService.getProjectList({
      workspaceId,
      user: req.user,
      req,
    });
  }

  @Patch('/api/v1/workspaces/:workspaceId/status')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async updateStatus(
    @Req() req: Request,
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

    if (!workspace) NcError.workspaceNotFound(workspaceId);

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

    await NocoCache.update(
      `${CacheScope.WORKSPACE}:${workspace.id}`,
      updateWorkspacePayload,
    );

    return true;
  }

  @Post('/internal/workspaces/deprecate')
  @UseGuards(MetaApiLimiterGuard, AuthGuard('basic'))
  async deleteDeprecatedWorkspaces() {
    try {
      await this.workspacesService.deleteDeprecatedWorkspaces();
    } catch (e) {
      this.logger.error(e);
      NcError.internalServerError(
        'Failed to delete deprecated workspaces, check logs for more details.',
      );
    }
    return true;
  }
}
