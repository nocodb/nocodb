import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Team, TeamUser, User } from '~/models';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import type {
  TeamV3Type,
  TeamCreateV3ReqType,
  TeamUpdateV3ReqType,
  TeamDetailV3Type,
  TeamMemberV3ResponseType,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
} from './teams-v3.types';

@Injectable()
export class TeamsV3Service {
  protected readonly logger = new Logger(TeamsV3Service.name);

  async teamList(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
    },
  ) {
    // For now, assume it's a workspace ID (can be enhanced later to detect org vs workspace)
    const filterParam = { fk_workspace_id: param.workspaceIdOrORGId };

    const teams = await Team.list(context, filterParam);

    // Transform teams to v3 format with members count
    const teamsV3: TeamV3Type[] = await Promise.all(
      teams.map(async (team) => {
        const teamUsers = await TeamUser.listByTeam(context, team.id);
        const meta = typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
        return {
          id: team.id,
          name: team.title,
          icon: meta.icon || undefined,
          badge_color: meta.badge_color || undefined,
          members_count: teamUsers.length,
          created_at: team.created_at,
          updated_at: team.updated_at,
        };
      }),
    );

    return teamsV3;
  }

  async teamGet(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
    },
  ) {
    const team = await Team.get(context, param.teamId);

    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Verify team belongs to the workspace/org
    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Get team members with user details
    const teamUsers = await TeamUser.listByTeam(context, param.teamId);
    const members: TeamMemberV3ResponseType[] = await Promise.all(
      teamUsers.map(async (teamUser) => {
        const user = await User.get(teamUser.fk_user_id);
        return {
          user_email: user.email,
          user_id: user.id,
          team_role: (teamUser.roles === 'owner' ? 'manager' : teamUser.roles) as 'member' | 'manager' | 'owner',
        };
      }),
    );

    const meta = typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
    const teamDetail: TeamDetailV3Type = {
      name: team.title,
      icon: meta.icon || undefined,
      badge_color: meta.badge_color || undefined,
      members,
    };

    return teamDetail;
  }

  async teamCreate(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      team: TeamCreateV3ReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/TeamCreateV3Req',
      param.team,
    );

    // Generate team ID
    const teamId = await Noco.ncMeta.genNanoid(MetaTable.TEAMS);

    // Create team with enhanced fields
    const teamData = {
      id: teamId,
      title: param.team.name,
      meta: {
        icon: param.team.icon,
        badge_color: param.team.badge_color,
      },
      fk_workspace_id: param.workspaceIdOrORGId,
    };

    const team = await Team.insert(context, teamData);

    // Add members if provided
    if (param.team.members && param.team.members.length > 0) {
      for (const member of param.team.members) {
        // Verify user exists and belongs to workspace/org
        const user = await User.get(member.user_id);
        if (!user) {
          NcError.notFound(`User with id ${member.user_id} not found`);
        }

        // Add user to team
        await TeamUser.insert(context, {
          fk_team_id: teamId,
          fk_user_id: member.user_id,
          roles: member.team_role === 'manager' ? 'owner' : member.team_role,
        });
      }
    }

    // Add creator as team owner if not already added
    const creatorId = param.req.user?.id;
    if (creatorId) {
      const existingCreator = await TeamUser.get(context, teamId, creatorId);
      if (!existingCreator) {
        await TeamUser.insert(context, {
          fk_team_id: teamId,
          fk_user_id: creatorId,
          roles: 'owner',
        });
      }
    }

    return team;
  }

  async teamUpdate(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
      team: TeamUpdateV3ReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/TeamUpdateV3Req',
      param.team,
    );

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'owner') {
        NcError.forbidden('Only team owners can update team information');
      }
    }

    const updateData: any = {};
    if (param.team.name !== undefined) updateData.title = param.team.name;
    if (param.team.icon !== undefined || param.team.badge_color !== undefined) {
      const existingMeta = typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
      updateData.meta = {
        ...existingMeta,
        ...(param.team.icon !== undefined && { icon: param.team.icon }),
        ...(param.team.badge_color !== undefined && { badge_color: param.team.badge_color }),
      };
    }

    const updatedTeam = await Team.update(context, param.teamId, updateData);

    return updatedTeam;
  }

  async teamDelete(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Check if user is team owner or org owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      const isTeamOwner = teamUser && teamUser.roles === 'owner';

      // TODO: Add org owner check when org ownership is implemented
      if (!isTeamOwner) {
        NcError.forbidden('Only team owners can delete teams');
      }
    }

    // Delete all team users first
    const teamUsers = await TeamUser.listByTeam(context, param.teamId);
    for (const teamUser of teamUsers) {
      await TeamUser.delete(context, param.teamId, teamUser.fk_user_id);
    }

    // Delete the team
    await Team.delete(context, param.teamId);

    return { msg: 'Team has been deleted successfully' };
  }

  async teamMembersAdd(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
      members: TeamMembersAddV3ReqType[];
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'owner') {
        NcError.forbidden('Only team owners can add members');
      }
    }

    const addedMembers = [];

    for (const member of param.members) {
      // Check if user exists
      const user = await User.get(member.user_id);
      if (!user) {
        NcError.notFound(`User with id ${member.user_id} not found`);
      }

      // Check if user is already in team
      const existingTeamUser = await TeamUser.get(
        context,
        param.teamId,
        member.user_id,
      );
      if (existingTeamUser) {
        NcError.badRequest(`User ${member.user_id} is already a member of this team`);
      }

      const teamUser = await TeamUser.insert(context, {
        fk_team_id: param.teamId,
        fk_user_id: member.user_id,
          roles: member.team_role === 'manager' ? 'owner' : member.team_role,
      });

      addedMembers.push(teamUser);
    }

    return addedMembers;
  }

  async teamMembersRemove(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
      members: TeamMembersRemoveV3ReqType[];
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const userId = param.req.user?.id;
    const removedMembers = [];

    for (const member of param.members) {
      // Check if team user exists
      const teamUser = await TeamUser.get(
        context,
        param.teamId,
        member.user_id,
      );
      if (!teamUser) {
        NcError.notFound(`User ${member.user_id} is not a member of this team`);
      }

      // Check permissions: team owner or user removing themselves
      const isTeamOwner = userId && await TeamUser.get(context, param.teamId, userId).then(tu => tu?.roles === 'owner') || false;
      const isSelfRemoval = userId === member.user_id;

      if (!isTeamOwner && !isSelfRemoval) {
        NcError.forbidden('Only team owners can remove members or users can remove themselves');
      }

      // If removing the last owner, prevent it
      if (teamUser.roles === 'owner') {
        const teamUsers = await TeamUser.listByTeam(context, param.teamId);
        const ownerCount = teamUsers.filter(tu => tu.roles === 'owner').length;
        if (ownerCount === 1) {
          NcError.badRequest('Cannot remove the last team owner');
        }
      }

      await TeamUser.delete(context, param.teamId, member.user_id);
      removedMembers.push({ user_id: member.user_id });
    }

    return removedMembers;
  }

  async teamMembersUpdate(
    context: NcContext,
    param: {
      workspaceIdOrORGId: string;
      teamId: string;
      members: TeamMembersUpdateV3ReqType[];
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceIdOrORGId;

    if (!belongsToScope) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'owner') {
        NcError.forbidden('Only team owners can update member roles');
      }
    }

    const updatedMembers = [];

    for (const member of param.members) {
      // Check if team user exists
      const teamUser = await TeamUser.get(
        context,
        param.teamId,
        member.user_id,
      );
      if (!teamUser) {
        NcError.notFound(`User ${member.user_id} is not a member of this team`);
      }

      const updatedTeamUser = await TeamUser.update(
        context,
        param.teamId,
        member.user_id,
        { roles: member.team_role === 'manager' ? 'owner' : member.team_role },
      );

      updatedMembers.push(updatedTeamUser);
    }

    return updatedMembers;
  }
}
