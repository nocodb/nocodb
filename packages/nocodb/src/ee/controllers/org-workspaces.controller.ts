import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { OrgWorkspacesService } from '~/services/org-workspaces.service';
import { NcRequest } from '~/interface/config';

@Controller()
export class OrgWorkspacesController {
  constructor(protected readonly orgWorkspaceService: OrgWorkspacesService) {}

  //api for upgrading workspace, creating org and move workspace to org
  @Post('/api/v2/orgs/workspaces/:workspaceId/upgrade')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgWorkspaceUpgrade', {
    scope: 'workspace',
  })
  async upgradeWorkspace(
    @Req() req: NcRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.orgWorkspaceService.upgradeWorkspace({
      workspaceId,
      req,
      user: req.user,
    });
  }

  @Post('/api/v2/orgs/:orgId/workspaces/:workspaceId')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgWorkspaceAdd', {
    scope: 'cloud-org',
  })
  async addWorkspace(
    @Req() req: NcRequest,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.orgWorkspaceService.addWorkspaceToOrg({
      workspaceId,
      orgId,
      req,
      user: req.user,
    });
  }

  @Get('/api/v2/orgs/:orgId/workspaces')
  @HttpCode(200)
  @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  @Acl('orgWorkspaceList', {
    scope: 'cloud-org',
  })
  async listWorkspaces(@Req() req: NcRequest, @Param('orgId') orgId: string) {
    return await this.orgWorkspaceService.listWorkspaces({
      orgId,
      req,
      user: req.user,
    });
  }

  // @Patch('/api/v2/orgs/:orgId/workspaces/:workspaceId')
  // @HttpCode(200)
  // @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  // @Acl('orgWorkspaceUpdate', {
  //     scope: 'cloud-org',
  //   })
  // async updateWorkspace(
  //   @Req() req: NcRequest,
  //   @Body() body: { orgId: string; workspaceId: string; workspaceName: string },
  // ) {
  //   return this.orgWorkspaceService.updateWorkspace({
  //     workspaceId: body.workspaceId,
  //     req,
  //     user: req.user,
  //   });
  // }

  // @Delete('/api/v2/orgs/:orgId/workspaces/:workspaceId')
  // @HttpCode(200)
  // @UseGuards(GlobalGuard, MetaApiLimiterGuard)
  // @Acl('orgWorkspaceDelete',, {
  //     scope: 'cloud-org',
  //   })
  // async deleteWorkspace(
  //   @Req() req: NcRequest,
  //   @Body() body: { orgId: string; workspaceId: string; workspaceName: string },
  // ) {
  //   return this.orgWorkspaceService.deleteWorkspace({
  //     workspaceId: body.workspaceId,
  //     req,
  //     user: req.user,
  //   });
  // }
}
