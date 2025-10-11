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
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamV3ResponseType,
  TeamDetailV3Type,
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
import { getFeature } from '~/helpers/paymentHelpers';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class TeamsV3Controller {
  constructor(protected readonly teamsV3Service: TeamsV3Service) {}

  /**
   * Validates if the user has access to the Teams API.
   * This method checks if the feature is enabled for the workspace.
   * If not, it throws an error indicating that the feature is only available on paid plans.
   */
  async canExecute(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.forbidden(
        'Accessing Teams API is only available on paid plans. Please upgrade your workspace plan to enable this feature. Your current plan is not sufficient.',
      );
    }
  }

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams')
  @Acl('teamList', { scope: 'workspace' })
  async teamList(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
  ): Promise<TeamV3ResponseType[]> {
    await this.canExecute(context);
    const teamsWithCounts = await this.teamsV3Service.teamList(context, {
      workspaceOrOrgId,
    });

    // Transform to v3 response format
    const teamsV3: TeamV3ResponseType[] = teamsWithCounts.map((team) => {
      const meta =
        typeof team.meta === 'string'
          ? JSON.parse(team.meta)
          : team.meta || {};
      return {
        id: team.id,
        name: team.title,
        icon: meta.icon || undefined,
        badge_color: meta.badge_color || undefined,
        members_count: team.members_count,
        created_at: team.created_at,
        updated_at: team.updated_at,
      };
    });

    return teamsV3;
  }

  @Get('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamGet', { scope: 'workspace' })
  async teamGet(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
  ): Promise<TeamDetailV3Type> {
    await this.canExecute(context);
    const { team, membersWithUsers } = await this.teamsV3Service.teamGet(context, {
      workspaceOrOrgId,
      teamId,
    });

    // Transform members to v3 response format with email
    const members = membersWithUsers.map(({ teamUser, user }) => ({
      user_email: user.email,
      user_id: user.id,
      team_role: (teamUser.roles === 'owner'
        ? 'manager'
        : teamUser.roles) as 'member' | 'manager' | 'owner',
    }));

    const meta =
      typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
    const teamDetail: TeamDetailV3Type = {
      name: team.title,
      icon: meta.icon || undefined,
      badge_color: meta.badge_color || undefined,
      members,
    };

    return teamDetail;
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
    await this.canExecute(context);
    const team = await this.teamsV3Service.teamCreate(context, {
      workspaceOrOrgId,
      team: body,
      req,
    });

    // Get member count for the created team
    const teamUsers = await this.teamsV3Service.getTeamMembersCount(context, team.id);

    // Transform to v3 response format
    const meta =
      typeof team.meta === 'string'
        ? JSON.parse(team.meta)
        : team.meta || {};
    
    return {
      id: team.id,
      name: team.title,
      icon: meta.icon || undefined,
      badge_color: meta.badge_color || undefined,
      members_count: teamUsers,
      created_at: team.created_at,
      updated_at: team.updated_at,
    };
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
    await this.canExecute(context);
    const team = await this.teamsV3Service.teamUpdate(context, {
      workspaceOrOrgId,
      teamId,
      team: body,
      req,
    });

    // Get member count for the updated team
    const teamUsers = await this.teamsV3Service.getTeamMembersCount(context, team.id);

    // Transform to v3 response format
    const meta =
      typeof team.meta === 'string'
        ? JSON.parse(team.meta)
        : team.meta || {};
    
    return {
      id: team.id,
      name: team.title,
      icon: meta.icon || undefined,
      badge_color: meta.badge_color || undefined,
      members_count: teamUsers,
      created_at: team.created_at,
      updated_at: team.updated_at,
    };
  }

  @Delete('/api/v3/meta/workspaces/:workspaceOrOrgId/teams/:teamId')
  @Acl('teamDelete', { scope: 'workspace' })
  async teamDelete(
    @TenantContext() context: NcContext,
    @Param('workspaceOrOrgId') workspaceOrOrgId: string,
    @Param('teamId') teamId: string,
    @Req() req: NcRequest,
  ) {
    await this.canExecute(context);
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
    await this.canExecute(context);
    const addedMembers = await this.teamsV3Service.teamMembersAdd(context, {
      workspaceOrOrgId,
      teamId,
      members: body,
      req,
    });

    // Transform to v3 response format with email
    const members = await Promise.all(
      addedMembers.map(async (teamUser) => {
        const user = await this.teamsV3Service.getUserById(context, teamUser.fk_user_id);
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: (teamUser.roles === 'owner'
            ? 'manager'
            : teamUser.roles) as 'member' | 'manager' | 'owner',
        };
      }),
    );

    return members;
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
    await this.canExecute(context);
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
    await this.canExecute(context);
    const updatedMembers = await this.teamsV3Service.teamMembersUpdate(context, {
      workspaceOrOrgId,
      teamId,
      members: body,
      req,
    });

    // Transform to v3 response format with email
    const members = await Promise.all(
      updatedMembers.map(async (teamUser) => {
        const user = await this.teamsV3Service.getUserById(context, teamUser.fk_user_id);
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: (teamUser.roles === 'owner'
            ? 'manager'
            : teamUser.roles) as 'member' | 'manager' | 'owner',
        };
      }),
    );

    return members;
  }
}
