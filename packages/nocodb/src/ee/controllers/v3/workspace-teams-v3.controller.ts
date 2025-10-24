import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamUpdateV3ReqType,
  WorkspaceTeamV3ResponseType,
} from '~/ee/services/v3/workspace-teams-v3.types';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { WorkspaceTeamsV3Service } from '~/ee/services/v3/workspace-teams-v3.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class WorkspaceTeamsV3Controller {
  constructor(
    private readonly workspaceTeamsV3Service: WorkspaceTeamsV3Service,
  ) {}

  @Get('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamList', {
    scope: 'workspace',
  })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceTeamListV3Type> {
    return this.workspaceTeamsV3Service.teamList(context, {
      workspaceId,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/invites')
  @HttpCode(200)
  @Acl('teamCreate', {
    scope: 'workspace',
  })
  async teamAdd(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body()
    teams: WorkspaceTeamCreateV3ReqType | WorkspaceTeamCreateV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType | WorkspaceTeamV3ResponseType[]> {
    const teamsArray = Array.isArray(teams) ? teams : [teams];

    if (teamsArray.length === 1) {
      // Single request
      return this.workspaceTeamsV3Service.teamAdd(context, {
        workspaceId,
        team: teamsArray[0],
        req,
      });
    } else {
      // Bulk request
      return this.workspaceTeamsV3Service.teamAddBulk(context, {
        workspaceId,
        teams: { teams: teamsArray },
        req,
      });
    }
  }

  @Get('/api/v3/meta/workspaces/:workspaceId/invites/:teamId')
  @Acl('teamGet', {
    scope: 'workspace',
  })
  async teamDetail(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Param('teamId') teamId: string,
  ): Promise<WorkspaceTeamDetailV3Type> {
    return this.workspaceTeamsV3Service.teamDetail(context, {
      workspaceId,
      teamId,
    });
  }

  @Patch('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamUpdate', {
    scope: 'workspace',
  })
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body() team: WorkspaceTeamUpdateV3ReqType | WorkspaceTeamUpdateV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamV3ResponseType | WorkspaceTeamV3ResponseType[]> {
    return this.workspaceTeamsV3Service.teamUpdate(context, {
      workspaceId,
      team,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceId/invites')
  @Acl('teamDelete', {
    scope: 'workspace',
  })
  async teamRemove(
    @TenantContext() context: NcContext,
    @Param('workspaceId') workspaceId: string,
    @Body()
    teams: WorkspaceTeamDeleteV3ReqType | WorkspaceTeamDeleteV3ReqType[],
    @Req() req: NcRequest,
  ): Promise<{ msg: string }> {
    const teamsArray = Array.isArray(teams) ? teams : [teams];

    if (teamsArray.length === 1) {
      // Single request
      return this.workspaceTeamsV3Service.teamRemove(context, {
        workspaceId,
        team: teamsArray[0],
        req,
      });
    } else {
      // Bulk request
      return this.workspaceTeamsV3Service.teamRemoveBulk(context, {
        workspaceId,
        teams: { teams: teamsArray },
        req,
      });
    }
  }
}
