import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { PlanFeatureTypes } from '~/utils/globals';
import { WorkspaceTeamsV3Service } from '~/ee/services/v3/workspace-teams-v3.service';
import type { NcRequest } from '~/interface/config';
import type {
  WorkspaceTeamListV3Type,
  WorkspaceTeamV3ResponseType,
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamUpdateV3ReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamDetailV3Type,
} from '~/ee/services/v3/workspace-teams-v3.types';

@Controller()
export class WorkspaceTeamsV3Controller {
  constructor(private readonly workspaceTeamsV3Service: WorkspaceTeamsV3Service) {}

  @Get([
    '/api/v3/workspaces/:workspaceId/teams',
    '/api/v3/meta/workspaces/:workspaceId/teams',
  ])
  @Acl({
    scope: 'workspace',
    allowedRoles: ['owner', 'creator'],
    blockApiTokenAccess: true,
    feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  })
  async teamList(
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamListV3Type> {
    return this.workspaceTeamsV3Service.teamList(req.context, {
      workspaceId,
    });
  }

  @Post([
    '/api/v3/workspaces/:workspaceId/teams',
    '/api/v3/meta/workspaces/:workspaceId/teams',
  ])
  @Acl({
    scope: 'workspace',
    allowedRoles: ['owner', 'creator'],
    blockApiTokenAccess: true,
    feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  })
  async teamAdd(
    @Param('workspaceId') workspaceId: string,
    @Body() team: WorkspaceTeamCreateV3ReqType,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType> {
    return this.workspaceTeamsV3Service.teamAdd(req.context, {
      workspaceId,
      team,
      req,
    });
  }

  @Get([
    '/api/v3/workspaces/:workspaceId/teams/:teamId',
    '/api/v3/meta/workspaces/:workspaceId/teams/:teamId',
  ])
  @Acl({
    scope: 'workspace',
    allowedRoles: ['owner', 'creator'],
    blockApiTokenAccess: true,
    feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  })
  async teamDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamDetailV3Type> {
    return this.workspaceTeamsV3Service.teamDetail(req.context, {
      workspaceId,
      teamId,
    });
  }

  @Patch([
    '/api/v3/workspaces/:workspaceId/teams/:teamId',
    '/api/v3/meta/workspaces/:workspaceId/teams/:teamId',
  ])
  @Acl({
    scope: 'workspace',
    allowedRoles: ['owner', 'creator'],
    blockApiTokenAccess: true,
    feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  })
  async teamUpdate(
    @Param('workspaceId') workspaceId: string,
    @Param('teamId') teamId: string,
    @Body() team: WorkspaceTeamUpdateV3ReqType,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType> {
    return this.workspaceTeamsV3Service.teamUpdate(req.context, {
      workspaceId,
      team,
      req,
    });
  }

  @Delete([
    '/api/v3/workspaces/:workspaceId/teams/:teamId',
    '/api/v3/meta/workspaces/:workspaceId/teams/:teamId',
  ])
  @Acl({
    scope: 'workspace',
    allowedRoles: ['owner', 'creator'],
    blockApiTokenAccess: true,
    feature: PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
  })
  async teamRemove(
    @Param('workspaceId') workspaceId: string,
    @Param('teamId') teamId: string,
    @Body() team: WorkspaceTeamDeleteV3ReqType,
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    return this.workspaceTeamsV3Service.teamRemove(req.context, {
      workspaceId,
      team,
      req,
    });
  }
}
