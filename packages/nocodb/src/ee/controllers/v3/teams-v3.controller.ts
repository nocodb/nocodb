import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  TeamDetailV3Type,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamTreeNodeV3Type,
  TeamV3ResponseType,
} from '~/services/v3/teams-v3.types';
import {
  TeamCreateV3ReqType,
  TeamMoveV3ReqType,
  TeamUpdateV3ReqType,
} from '~/services/v3/teams-v3.types';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TeamsV3Service } from '~/services/v3/teams-v3.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { License } from '~/decorators/license.decorator';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
@License('teams')
export class TeamsV3Controller {
  constructor(protected readonly teamsV3Service: TeamsV3Service) {}

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams')
  @Acl('teamList', { scope: 'workspace', extendedScope: 'cloud-org' })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamV3ResponseType[] }> {
    return await this.teamsV3Service.teamList(context, {
      workspaceOrOrgId,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/tree')
  @Acl('teamTree', { scope: 'workspace', extendedScope: 'cloud-org' })
  async teamTree(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamTreeNodeV3Type[] }> {
    return await this.teamsV3Service.teamTree(context, {
      workspaceOrOrgId,
    });
  }

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamGet', { scope: 'workspace', extendedScope: 'cloud-org' })
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
  @Acl('teamCreate', { scope: 'workspace', extendedScope: 'cloud-org' })
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
  @Acl('teamUpdate', { scope: 'workspace', extendedScope: 'cloud-org' })
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

  @Patch('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/move')
  @Acl('teamMove', { scope: 'workspace', extendedScope: 'cloud-org' })
  async teamMove(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Body() body: TeamMoveV3ReqType,
  ): Promise<TeamV3ResponseType> {
    return await this.teamsV3Service.teamMove(context, {
      workspaceOrOrgId,
      teamId,
      body,
      req,
    });
  }

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamDelete', { scope: 'workspace', extendedScope: 'cloud-org' })
  async teamDelete(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
    @Query('force') force?: string,
  ) {
    return await this.teamsV3Service.teamDelete(context, {
      workspaceOrOrgId,
      teamId,
      force: force === 'true',
      req,
    });
  }

  @Post('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @HttpCode(200)
  @Acl('teamMembersAdd', { scope: 'workspace', extendedScope: 'cloud-org' })
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
  @Acl('teamMembersRemove', { scope: 'workspace', extendedScope: 'cloud-org' })
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
  @Acl('teamMembersUpdate', { scope: 'workspace', extendedScope: 'cloud-org' })
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
