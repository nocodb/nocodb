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

  // ── List ────────────────────────────────────────────────────

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

  @Get('/api/v3/meta/orgs/:workspaceOrOrgId/teams')
  @Acl('orgTeamList', { scope: 'cloud-org' })
  async orgTeamList(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamV3ResponseType[] }> {
    return await this.teamsV3Service.teamList(context, {
      workspaceOrOrgId,
    });
  }

  // ── Tree ────────────────────────────────────────────────────

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/tree')
  @Acl('teamTree', { scope: 'workspace' })
  async teamTree(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamTreeNodeV3Type[] }> {
    return await this.teamsV3Service.teamTree(context, {
      workspaceOrOrgId,
    });
  }

  @Get('/api/v3/meta/orgs/:workspaceOrOrgId/teams/tree')
  @Acl('orgTeamTree', { scope: 'cloud-org' })
  async orgTeamTree(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<{ list: TeamTreeNodeV3Type[] }> {
    return await this.teamsV3Service.teamTree(context, {
      workspaceOrOrgId,
    });
  }

  // ── Get ─────────────────────────────────────────────────────

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

  @Get('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId')
  @Acl('orgTeamGet', { scope: 'cloud-org' })
  async orgTeamGet(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamDetailV3Type> {
    return await this.teamsV3Service.teamGet(context, {
      workspaceOrOrgId,
      teamId,
    });
  }

  // ── Create ──────────────────────────────────────────────────

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

  @Post('/api/v3/meta/orgs/:workspaceOrOrgId/teams')
  @HttpCode(200)
  @Acl('orgTeamCreate', { scope: 'cloud-org' })
  async orgTeamCreate(
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

  // ── Update ──────────────────────────────────────────────────

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

  @Patch('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId')
  @Acl('orgTeamUpdate', { scope: 'cloud-org' })
  async orgTeamUpdate(
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

  // ── Move ────────────────────────────────────────────────────

  @Patch('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/move')
  @Acl('teamMove', { scope: 'workspace' })
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

  @Patch('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId/move')
  @Acl('orgTeamMove', { scope: 'cloud-org' })
  async orgTeamMove(
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

  // ── Delete ──────────────────────────────────────────────────

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamDelete', { scope: 'workspace' })
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

  @Delete('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId')
  @Acl('orgTeamDelete', { scope: 'cloud-org' })
  async orgTeamDelete(
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

  // ── Members Add ─────────────────────────────────────────────

  @Post('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @HttpCode(200)
  @Acl('teamMembersAdd', { scope: 'workspace' })
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

  @Post('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId/members')
  @HttpCode(200)
  @Acl('orgTeamMembersAdd', { scope: 'cloud-org' })
  async orgTeamMembersAdd(
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

  // ── Members Remove ──────────────────────────────────────────

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('teamMembersRemove', { scope: 'workspace' })
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

  @Delete('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('orgTeamMembersRemove', { scope: 'cloud-org' })
  async orgTeamMembersRemove(
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

  // ── Members Update ──────────────────────────────────────────

  @Patch('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('teamMembersUpdate', { scope: 'workspace' })
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

  @Patch('/api/v3/meta/orgs/:workspaceOrOrgId/teams/:teamId/members')
  @Acl('orgTeamMembersUpdate', { scope: 'cloud-org' })
  async orgTeamMembersUpdate(
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
