import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  TeamCreateV3ReqType,
  TeamDetailV3Type,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamMemberV3ResponseType,
  TeamUpdateV3ReqType,
  TeamV3ResponseType,
} from './teams-v3.types';
import { NcError } from '~/helpers/catchError';
import { Team, TeamUser, User } from '~/models';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import { TeamUserRoles } from 'nocodb-sdk';

@Injectable()
export class TeamsV3Service {
  protected readonly logger = new Logger(TeamsV3Service.name);

  async getTeamMembersCount(
    context: NcContext,
    teamId: string,
  ): Promise<number> {
    return await TeamUser.countByTeam(context, teamId);
  }

  async getTeamManagersCount(
    context: NcContext,
    teamId: string,
  ): Promise<number> {
    return await TeamUser.countByTeamAndRole(
      context,
      teamId,
      TeamUserRoles.MANAGER,
    );
  }

  async getUserById(context: NcContext, userId: string) {
    const user = await User.get(userId);
    if (!user) {
      NcError.get(context).userNotFound(userId);
    }
    return user;
  }

  async teamList(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
    },
  ): Promise<{ list: TeamV3ResponseType[] }> {
    // For now, assume it's a workspace ID (can be enhanced later to detect org vs workspace)
    const filterParam = { fk_workspace_id: param.workspaceOrOrgId };

    const teams = await Team.list(context, filterParam);

    // Get teams with member counts using optimized query
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => {
        const [membersCount, menagersCount] = await Promise.all([
          this.getTeamMembersCount(context, team.id),
          this.getTeamManagersCount(context, team.id),
        ]);

        return {
          ...team,
          members_count: membersCount,
          managers_count: menagersCount,
        };
      }),
    );

    // Transform to v3 response format
    const teamsV3: TeamV3ResponseType[] = teamsWithCounts.map((team) => {
      const meta = parseMetaProp(team);
      return {
        id: team.id,
        title: team.title,
        icon: meta.icon || undefined,
        icon_type: meta.icon_type || undefined,
        badge_color: meta.badge_color || undefined,
        members_count: team.members_count,
        managers_count: team.managers_count,
        created_at: team.created_at,
        updated_at: team.updated_at,
      };
    });

    return { list: teamsV3 };
  }

  async teamGet(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
    },
  ): Promise<TeamDetailV3Type> {
    const team = await Team.get(context, param.teamId);

    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Verify team belongs to the workspace/org
    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Get team members with user details using optimized query
    const teamUsers = await TeamUser.listByTeam(context, param.teamId);
    const membersWithUsers = await Promise.all(
      teamUsers.map(async (teamUser) => {
        const user = await User.get(teamUser.fk_user_id);
        return {
          teamUser,
          user,
        };
      }),
    );

    // Transform members to v3 response format with email
    const members = membersWithUsers.map(({ teamUser, user }) => ({
      user_email: user.email,
      user_id: user.id,
      team_role: teamUser.roles as 'member' | 'manager',
    }));

    const meta =
      typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
    const teamDetail: TeamDetailV3Type = {
      title: team.title,
      icon: meta.icon || undefined,
      icon_type: meta.icon_type || undefined,
      badge_color: meta.badge_color || undefined,
      members,
    };

    return teamDetail;
  }

  async teamCreate(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      team: TeamCreateV3ReqType;
      req: NcRequest;
    },
  ): Promise<TeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/TeamCreateV3Req',
      param.team,
      true,
    );

    // Check for duplicate team name in the same workspace
    const existingTeams = await Team.list(context, {
      fk_workspace_id: param.workspaceOrOrgId,
    });

    const duplicateTeam = existingTeams.find(
      (team) => team.title?.trim() === param.team.title?.trim(),
    );

    if (duplicateTeam) {
      NcError.get(context).invalidRequestBody(
        `Team with title '${param.team.title}' already exists`,
      );
    }

    // Generate team ID
    const teamId = (await Noco.ncMeta.genNanoid(MetaTable.TEAMS)) as string;

    // Create team with enhanced fields
    const teamData = {
      id: teamId,
      title: param.team.title,
      meta: {
        icon: param.team.icon,
        icon_type: param.team.icon_type,
        badge_color: param.team.badge_color,
      },
      fk_workspace_id: param.workspaceOrOrgId,
    };

    const team = await Team.insert(context, teamData);

    // Add members if provided
    if (param.team.members && param.team.members.length > 0) {
      for (const member of param.team.members) {
        // Verify user exists and belongs to workspace/org
        const user = await User.get(member.user_id);
        if (!user) {
          NcError.get(context).userNotFound(member.user_id);
        }

        // Add user to team
        await TeamUser.insert(context, {
          fk_team_id: teamId,
          fk_user_id: member.user_id,
          roles: member.team_role,
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
          roles: 'manager',
        });
      }
    }

    // Get member count for the created team
    const [teamUsers, teamManagersCount] = await Promise.all([
      this.getTeamMembersCount(context, team.id),
      this.getTeamManagersCount(context, team.id),
    ]);

    // Transform to v3 response format
    const meta = parseMetaProp(team);

    return {
      id: team.id,
      title: team.title,
      icon: meta.icon || undefined,
      icon_type: meta.icon_type || undefined,
      badge_color: meta.badge_color || undefined,
      members_count: teamUsers,
      managers_count: teamManagersCount,
      created_at: team.created_at,
      updated_at: team.updated_at,
    };
  }

  async teamUpdate(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      team: TeamUpdateV3ReqType;
      req: NcRequest;
    },
  ): Promise<TeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/TeamUpdateV3Req',
      param.team,
    );

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'manager') {
        NcError.get(context).forbidden(
          'Only team managers can update team information',
        );
      }
    }

    const updateData: any = {};
    if (param.team.title !== undefined) updateData.title = param.team.title;
    if (param.team.icon !== undefined || param.team.badge_color !== undefined) {
      const existingMeta =
        typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
      updateData.meta = {
        ...existingMeta,
        ...(param.team.icon !== undefined && { icon: param.team.icon }),
        ...(param.team.icon_type !== undefined && {
          icon_type: param.team.icon_type,
        }),
        ...(param.team.badge_color !== undefined && {
          badge_color: param.team.badge_color,
        }),
      };
    }

    const updatedTeam = await Team.update(context, param.teamId, updateData);

    // Get member count for the updated team
    const [teamUsers, teamManagersCount] = await Promise.all([
      this.getTeamMembersCount(context, updatedTeam.id),
      this.getTeamManagersCount(context, updatedTeam.id),
    ]);

    // Transform to v3 response format
    const meta = parseMetaProp(updatedTeam);

    return {
      id: updatedTeam.id,
      title: updatedTeam.title,
      icon: meta.icon || undefined,
      icon_type: meta.icon_type || undefined,
      badge_color: meta.badge_color || undefined,
      members_count: teamUsers,
      managers_count: teamManagersCount,
      created_at: updatedTeam.created_at,
      updated_at: updatedTeam.updated_at,
    };
  }

  async teamDelete(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team owner or org owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      const isTeamManager = teamUser && teamUser.roles === 'manager';

      // TODO: Add org owner check when org ownership is implemented
      if (!isTeamManager) {
        NcError.get(context).forbidden('Only team managers can delete teams');
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
      workspaceOrOrgId: string;
      teamId: string;
      members: TeamMembersAddV3ReqType[];
      req: NcRequest;
    },
  ): Promise<TeamMemberV3ResponseType[]> {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'manager') {
        NcError.get(context).forbidden('Only team managers can add members');
      }
    }

    const addedMembers = [];

    for (const member of param.members) {
      // Check if user exists
      const user = await User.get(member.user_id);
      if (!user) {
        NcError.get(context).userNotFound(member.user_id);
      }

      // Check if user is already in team
      const existingTeamUser = await TeamUser.get(
        context,
        param.teamId,
        member.user_id,
      );
      if (existingTeamUser) {
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} is already a member of this team`,
        );
      }

      const teamUser = await TeamUser.insert(context, {
        fk_team_id: param.teamId,
        fk_user_id: member.user_id,
        roles: member.team_role === 'manager' ? 'manager' : member.team_role,
      });

      addedMembers.push(teamUser);
    }

    // Transform to v3 response format with email
    const members = await Promise.all(
      addedMembers.map(async (teamUser) => {
        const user = await this.getUserById(context, teamUser.fk_user_id);
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: teamUser.roles as 'member' | 'manager',
        };
      }),
    );

    return members;
  }

  async teamMembersRemove(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      members: TeamMembersRemoveV3ReqType[];
      req: NcRequest;
    },
  ) {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
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
        NcError.get(context).userNotFound(member.user_id);
      }

      // Check permissions: team owner or user removing themselves
      const isTeamOwner =
        (userId &&
          (await TeamUser.get(context, param.teamId, userId).then(
            (tu) => tu?.roles === 'manager',
          ))) ||
        false;
      const isSelfRemoval = userId === member.user_id;

      if (!isTeamOwner && !isSelfRemoval) {
        NcError.get(context).forbidden(
          'Only team managers can remove members or users can remove themselves',
        );
      }

      // If removing the last manager, prevent it
      if (teamUser.roles === 'manager') {
        const managersCount = await this.getTeamManagersCount(
          context,
          param.teamId,
        );

        if (managersCount === 1) {
          NcError.get(context).invalidRequestBody(
            'Cannot remove the last manager',
          );
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
      workspaceOrOrgId: string;
      teamId: string;
      members: TeamMembersUpdateV3ReqType[];
      req: NcRequest;
    },
  ): Promise<TeamMemberV3ResponseType[]> {
    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team owner
    const userId = param.req.user?.id;
    if (userId) {
      const teamUser = await TeamUser.get(context, param.teamId, userId);
      if (!teamUser || teamUser.roles !== 'manager') {
        NcError.get(context).forbidden(
          'Only team managers can update member roles',
        );
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
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} not found in this team`,
        );
      }

      const updatedTeamUser = await TeamUser.update(
        context,
        param.teamId,
        member.user_id,
        { roles: member.team_role },
      );

      updatedMembers.push(updatedTeamUser);
    }

    // Transform to v3 response format with email
    const members = await Promise.all(
      updatedMembers.map(async (teamUser) => {
        const user = await this.getUserById(context, teamUser.fk_user_id);
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: teamUser.roles as 'member' | 'manager',
        };
      }),
    );

    return members;
  }
}
