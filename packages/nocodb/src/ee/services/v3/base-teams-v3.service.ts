import { Injectable, Logger } from '@nestjs/common';
import type { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  BaseTeamCreateV3ReqType,
  BaseTeamCreateV3BulkReqType,
  BaseTeamDeleteV3ReqType,
  BaseTeamDeleteV3BulkReqType,
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamUpdateV3ReqType,
  BaseTeamV3ResponseType,
} from './base-teams-v3.types';
import { NcError } from '~/helpers/catchError';
import { PrincipalAssignment, Team, User } from '~/models';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import { validatePayload } from '~/helpers';
import { parseMetaProp } from '~/utils/modelUtils';
import Noco from '~/Noco';

@Injectable()
export class BaseTeamsV3Service {
  protected readonly logger = new Logger(BaseTeamsV3Service.name);

  async teamList(
    context: NcContext,
    param: { baseId: string },
  ): Promise<BaseTeamListV3Type> {



    // Get all team assignments for this base
    const assignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.BASE,
      param.baseId,
    );

    // Filter only team assignments
    const teamAssignments = assignments.filter(
      (assignment) => assignment.principal_type === PrincipalType.TEAM,
    );

    // Get team details
    const teams = await Promise.all(
      teamAssignments.map(async (assignment) => {
        const team = await Team.get(context, assignment.principal_ref_id);
        if (!team) {
          return null;
        }

        const meta = parseMetaProp(team);

        return {
          team_id: team.id,
          team_title: team.title,
          team_icon: meta.icon || null,
          team_icon_type: meta.icon_type || null,
          team_badge_color: meta.badge_color || null,
          base_role: assignment.roles as Exclude<
            ProjectRoles,
            ProjectRoles.OWNER
          >,
          created_at: assignment.created_at!,
          updated_at: assignment.updated_at!,
        };
      }),
    );

    // Filter out null results
    const validTeams = teams.filter((team) => team !== null);

    return { list: validTeams };
  }

  async teamAdd(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamCreateV3ReqType;
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamCreate',
      param.team,
      true,
    );

    // Check if team exists
    const team = await Team.get(context, param.team.team_id);
    if (!team) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // Check if team is already assigned to base
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      PrincipalType.TEAM,
      param.team.team_id,
    );
    if (existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is already assigned to this base`,
      );
    }

    // Create the assignment
    const assignment = await PrincipalAssignment.insert(context, {
      resource_type: ResourceType.BASE,
      resource_id: param.baseId,
      principal_type: PrincipalType.TEAM,
      principal_ref_id: param.team.team_id,
      roles: param.team.base_role,
    });

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_icon_type: meta.icon_type || null,
      team_badge_color: meta.badge_color || null,
      base_role: assignment.roles as Exclude<ProjectRoles, ProjectRoles.OWNER>,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }

  async teamUpdate(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamUpdateV3ReqType | BaseTeamUpdateV3ReqType[];
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType | BaseTeamV3ResponseType[]> {
    const teams = Array.isArray(param.team) ? param.team : [param.team];
    const results = [];

    for (const team of teams) {
      validatePayload(
        'swagger-v3.json#/components/schemas/BaseTeamUpdate',
        team,
        true,
      );

      // Check if team exists
      const teamData = await Team.get(context, team.team_id);
      if (!teamData) {
        NcError.get(context).teamNotFound(team.team_id);
      }

      // Check if team is assigned to base
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        team.team_id,
      );
      if (!existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `Team ${team.team_id} is not assigned to this base`,
        );
      }

      // Update the assignment
      const updatedAssignment = await PrincipalAssignment.update(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        team.team_id,
        { roles: team.base_role },
      );

      const meta = parseMetaProp(teamData);

      results.push({
        team_id: teamData.id,
        team_title: teamData.title,
        team_icon: meta.icon || null,
        team_icon_type: meta.icon_type || null,
        team_badge_color: meta.badge_color || null,
          base_role: updatedAssignment.roles as Exclude<
              ProjectRoles,
              ProjectRoles.OWNER
          >,
        created_at: updatedAssignment.created_at!,
        updated_at: updatedAssignment.updated_at!,
      });
    }

    return Array.isArray(param.team) ? results : results[0];
  }

  async teamRemove(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamDeleteV3ReqType | BaseTeamDeleteV3ReqType[];
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    const teams = Array.isArray(param.team) ? param.team : [param.team];

    for (const team of teams) {
      validatePayload(
        'swagger-v3.json#/components/schemas/BaseTeamDelete',
        team,
        true,
      );

      // Check if team is assigned to base
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        team.team_id,
      );
      if (!existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `Team ${team.team_id} is not assigned to this base`,
        );
      }

      // Get all users in the team before deleting the assignment
      const teamUsers = await PrincipalAssignment.list(
        context,
        {
          resource_type: ResourceType.TEAM,
          resource_id: team.team_id,
          principal_type: PrincipalType.USER,
        },
      );

      // Delete the assignment
      await PrincipalAssignment.delete(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        team.team_id,
      );

      // Clear user cache for all users in the team
      for (const userAssignment of teamUsers) {
        await User.clearCache(userAssignment.principal_ref_id);
      }
    }

    return { msg: 'Team has been removed from base successfully' };
  }

  async teamAddBulk(
    context: NcContext,
    param: {
      baseId: string;
      teams: BaseTeamCreateV3BulkReqType;
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType[]> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamCreateBulk',
      param.teams,
      true,
    );

    const results = [];

    for (const team of param.teams.teams) {
      const result = await this.teamAdd(context, {
        baseId: param.baseId,
        team,
        req: param.req,
      });
      results.push(result);
    }

    return results;
  }

  async teamRemoveBulk(
    context: NcContext,
    param: {
      baseId: string;
      teams: BaseTeamDeleteV3BulkReqType;
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamDeleteBulk',
      param.teams,
      true,
    );

    for (const team of param.teams.teams) {
      await this.teamRemove(context, {
        baseId: param.baseId,
        team,
        req: param.req,
      });
    }

    return { msg: 'Teams have been removed from base successfully' };
  }

  async teamDetail(
    context: NcContext,
    param: { baseId: string; teamId: string },
  ): Promise<BaseTeamDetailV3Type> {
    // Check if team is assigned to base
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      PrincipalType.TEAM,
      param.teamId,
    );
    if (!assignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.teamId} is not assigned to this base`,
      );
    }

    // Get team details
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_icon_type: meta.icon_type || null,
      team_badge_color: meta.badge_color || null,
      base_role: assignment.roles as Exclude<ProjectRoles, ProjectRoles.OWNER>,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }
}
