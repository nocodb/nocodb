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
  TeamDetailV3Type,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';
import {
  TeamCreateV3ReqType,
  TeamUpdateV3ReqType,
} from '~/services/v3/teams-v3.types';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TeamsV3Service } from '~/services/v3/teams-v3.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class TeamsV3Controller {
  constructor(protected readonly teamsV3Service: TeamsV3Service) {}

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams')
  @Acl('teamList', { scope: 'workspace' })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamV3ResponseType[] }> {
    return await this.teamsV3Service.teamList(context, {
      workspaceOrOrgId,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamGet', { scope: 'workspace' })
  async teamGet(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamDetailV3Type> {
    return await this.teamsV3Service.teamGet(context, {
      workspaceOrOrgId,
      teamId,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceOrOrgId/teams')
  @HttpCode(200)
  @Acl('teamCreate', { scope: 'workspace' })
  async teamCreate(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Req() req: NcRequest,
    @Body() body: TeamCreateV3ReqType,
  ): Promise<TeamV3ResponseType> {
    return await this.teamsV3Service.teamCreate(context, {
      workspaceOrOrgId,
      team: body,
      req,
    });
  }

  @Patch('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamUpdate', { scope: 'workspace' })
  async teamUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamUpdateV3ReqType,
  ): Promise<TeamV3ResponseType> {
    return await this.teamsV3Service.teamUpdate(context, {
      workspaceOrOrgId,
      teamId,
      team: body,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamDelete', { scope: 'workspace' })
  async teamDelete(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
  ) {
    return await this.teamsV3Service.teamDelete(context, {
      workspaceOrOrgId,
      teamId,
      req,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @HttpCode(200)
  @Acl('teamUserAdd', { scope: 'workspace' })
  async teamMembersAdd(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersAddV3ReqType[],
  ) {
    return await this.teamsV3Service.teamMembersAdd(context, {
      workspaceOrOrgId,
      teamId,
      members: body,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('teamUserRemove', { scope: 'workspace' })
  async teamMembersRemove(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersRemoveV3ReqType[],
  ) {
    await this.teamsV3Service.teamMembersRemove(context, {
      workspaceOrOrgId,
      teamId,
      members: body,
      req,
    });

    return {
      msg: 'Members have been removed successfully',
    };
  }

  @Patch('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('teamUserUpdate', { scope: 'workspace' })
  async teamMembersUpdate(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMembersUpdateV3ReqType[],
  ) {
    return await this.teamsV3Service.teamMembersUpdate(context, {
      workspaceOrOrgId,
      teamId,
      members: body,
      req,
    });
  }
}
