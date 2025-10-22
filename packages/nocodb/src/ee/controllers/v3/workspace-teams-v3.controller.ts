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
} from '@nestjs/common';
import type {
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamV3ResponseType,
} from '~/ee/services/v3/workspace-teams-v3.types';
import {
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamUpdateV3ReqType,
} from '~/ee/services/v3/workspace-teams-v3.types';
import { NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { WorkspaceTeamsV3Service } from '~/ee/services/v3/workspace-teams-v3.service';

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
    @Param('workspaceId') workspaceId: string,
    @Req() req: NcRequest,
  ): Promise<WorkspaceTeamListV3Type> {
    return this.workspaceTeamsV3Service.teamList(req.context, {
      workspaceId,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceId/invites')
  @HttpCode(200)
  @Acl('teamCreate', {
    scope: 'workspace',
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

  @Get('/api/v3/meta/workspaces/:workspaceId/invites/:teamId')
  @Acl('teamGet', {
    scope: 'workspace',
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

  @Patch('/api/v3/meta/workspaces/:workspaceId/invites/:teamId')
  @Acl('teamUpdate', {
    scope: 'workspace',
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

  @Delete('/api/v3/meta/workspaces/:workspaceId/invites/:teamId')
  @Acl('teamDelete', {
    scope: 'workspace',
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
