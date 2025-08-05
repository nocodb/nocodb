import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Team, TeamUser, User } from '~/models';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

export interface TeamCreateReqType {
  title: string;
  fk_org_id?: string;
  fk_workspace_id?: string;
}

export interface TeamUpdateReqType {
  title?: string;
  fk_org_id?: string;
  fk_workspace_id?: string;
}

export interface TeamUserAddReqType {
  fk_user_id: string;
  is_owner?: boolean;
}

export interface TeamUserUpdateReqType {
  is_owner?: boolean;
}

export interface InviteCreateReqType {
  type: 'user' | 'team';
  email?: string;
  team_id?: string;
  resource_type: 'org' | 'workspace' | 'base';
  resource_id: string;
  roles: string;
}

@Injectable()
export class TeamsService {
  protected readonly logger = new Logger(TeamsService.name);

  async teamList(
    context: NcContext,
    param: {
      fk_org_id?: string;
      fk_workspace_id?: string;
    } = {},
  ) {
    const teams = await Team.list(context, param);

    return new PagedResponseImpl(teams, {
      count: teams.length,
    });
  }

  async teamGet(
    context: NcContext,
    param: { teamId: string },
  ) {
    const team = await Team.get(context, param.teamId);

    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    return team;
  }

  async teamCreate(
    context: NcContext,
    param: {
      team: TeamCreateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/TeamCreateReq',
      param.team,
    );

    // Generate team ID
    const teamId = await Noco.ncMeta.genNanoid(MetaTable.TEAMS);

    const team = await Team.insert(context, {
      id: teamId,
      ...param.team,
    });

    return team;
  }

  async teamUpdate(
    context: NcContext,
    param: {
      teamId: string;
      team: TeamUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/TeamUpdateReq',
      param.team,
    );

    const team = await Team.update(context, param.teamId, param.team);

    return team;
  }

  async teamDelete(
    context: NcContext,
    param: {
      teamId: string;
      req: NcRequest;
    },
  ) {
    // Check if team exists
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
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

  async teamUserList(
    context: NcContext,
    param: { teamId: string },
  ) {
    const teamUsers = await TeamUser.listByTeam(context, param.teamId);

    // Get user details for each team user
    const teamUsersWithDetails = await Promise.all(
      teamUsers.map(async (teamUser) => {
        const user = await User.get(teamUser.fk_user_id);
        return {
          ...teamUser,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
          },
        };
      }),
    );

    return new PagedResponseImpl(teamUsersWithDetails, {
      count: teamUsersWithDetails.length,
    });
  }

  async teamUserAdd(
    context: NcContext,
    param: {
      teamId: string;
      teamUser: TeamUserAddReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/TeamUserAddReq',
      param.teamUser,
    );

    // Check if team exists
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.notFound(`Team with id ${param.teamId} not found`);
    }

    // Check if user exists
    const user = await User.get(param.teamUser.fk_user_id);
    if (!user) {
      NcError.notFound(`User with id ${param.teamUser.fk_user_id} not found`);
    }

    // Check if user is already in team
    const existingTeamUser = await TeamUser.get(
      context,
      param.teamId,
      param.teamUser.fk_user_id,
    );
    if (existingTeamUser) {
      NcError.badRequest('User is already a member of this team');
    }

    const teamUser = await TeamUser.insert(context, {
      fk_team_id: param.teamId,
      fk_user_id: param.teamUser.fk_user_id,
      is_owner: param.teamUser.is_owner || false,
    });

    return teamUser;
  }

  async teamUserUpdate(
    context: NcContext,
    param: {
      teamId: string;
      userId: string;
      teamUser: TeamUserUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/TeamUserUpdateReq',
      param.teamUser,
    );

    const teamUser = await TeamUser.update(
      context,
      param.teamId,
      param.userId,
      param.teamUser,
    );

    return teamUser;
  }

  async teamUserRemove(
    context: NcContext,
    param: {
      teamId: string;
      userId: string;
      req: NcRequest;
    },
  ) {
    // Check if team user exists
    const teamUser = await TeamUser.get(
      context,
      param.teamId,
      param.userId,
    );
    if (!teamUser) {
      NcError.notFound('Team user not found');
    }

    await TeamUser.delete(context, param.teamId, param.userId);

    return { msg: 'User has been removed from team successfully' };
  }

  // Generic invite functionality using principals system
  async inviteCreate(
    context: NcContext,
    param: {
      invite: InviteCreateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/InviteCreateReq',
      param.invite,
    );

    const { type, email, team_id, resource_type, resource_id, roles } = param.invite;

    let principalId: string;
    let refId: string;

    if (type === 'user') {
      if (!email) {
        NcError.badRequest('Email is required for user invites');
      }

      // Find or create user by email
      const user = await User.getByEmail(email);
      if (!user) {
        NcError.notFound(`User with email ${email} not found`);
      }
      refId = user.id;
    } else if (type === 'team') {
      if (!team_id) {
        NcError.badRequest('Team ID is required for team invites');
      }

      // Check if team exists
      const team = await Team.get(context, team_id);
      if (!team) {
        NcError.notFound(`Team with id ${team_id} not found`);
      }
      refId = team_id;
    } else {
      NcError.badRequest('Invalid invite type. Must be "user" or "team"');
    }

    // Create principal
    principalId = await Noco.ncMeta.genNanoid(MetaTable.PRINCIPALS);
    await Noco.ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      {
        id: principalId,
        principal_type: type,
        ref_id: refId,
      },
      true,
    );

    // Create principal assignment
    await Noco.ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        resource_type,
        resource_id,
        fk_principal_id: principalId,
        roles,
      },
      true,
    );

    return {
      id: principalId,
      type,
      ref_id: refId,
      resource_type,
      resource_id,
      roles,
    };
  }

  async inviteList(
    context: NcContext,
    param: {
      resource_type?: string;
      resource_id?: string;
    } = {},
  ) {
    const condition: any = {};
    if (param.resource_type) condition.resource_type = param.resource_type;
    if (param.resource_id) condition.resource_id = param.resource_id;

    const assignments = await Noco.ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      { condition },
    );

    // Get principal details for each assignment
    const invitesWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const principal = await Noco.ncMeta.metaGet(
          context.workspace_id,
          context.base_id,
          MetaTable.PRINCIPALS,
          assignment.fk_principal_id,
        );

        let details: any = {};
        if (principal.principal_type === 'user') {
          const user = await User.get(principal.ref_id);
          details = {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
          };
        } else if (principal.principal_type === 'team') {
          const team = await Team.get(context, principal.ref_id);
          details = {
            id: team.id,
            title: team.title,
          };
        }

        return {
          id: assignment.fk_principal_id,
          type: principal.principal_type,
          ref_id: principal.ref_id,
          resource_type: assignment.resource_type,
          resource_id: assignment.resource_id,
          roles: assignment.roles,
          details,
        };
      }),
    );

    return new PagedResponseImpl(invitesWithDetails, {
      count: invitesWithDetails.length,
    });
  }

  async inviteDelete(
    context: NcContext,
    param: {
      inviteId: string;
      req: NcRequest;
    },
  ) {
    // Check if principal exists
    const principal = await Noco.ncMeta.metaGet(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      param.inviteId,
    );

    if (!principal) {
      NcError.notFound('Invite not found');
    }

    // Delete all assignments for this principal
    const assignments = await Noco.ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPAL_ASSIGNMENTS,
      {
        condition: { fk_principal_id: param.inviteId },
      },
    );

    for (const assignment of assignments) {
      await Noco.ncMeta.metaDelete(
        context.workspace_id,
        context.base_id,
        MetaTable.PRINCIPAL_ASSIGNMENTS,
        {
          resource_type: assignment.resource_type,
          resource_id: assignment.resource_id,
          fk_principal_id: param.inviteId,
        },
      );
    }

    // Delete the principal
    await Noco.ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.PRINCIPALS,
      { id: param.inviteId },
    );

    return { msg: 'Invite has been deleted successfully' };
  }
} 