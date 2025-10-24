import { Injectable, Logger } from '@nestjs/common';
import type { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  WorkspaceTeamCreateV3BulkReqType,
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamDeleteV3BulkReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamUpdateV3ReqType,
  WorkspaceTeamV3ResponseType,
} from './workspace-teams-v3.types';
import { NcError } from '~/helpers/catchError';
import { PrincipalAssignment, Team, User } from '~/models';
import { PrincipalType, ResourceType } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import { validatePayload } from '~/helpers';

@Injectable()
export class WorkspaceTeamsV3Service {
  protected readonly logger = new Logger(WorkspaceTeamsV3Service.name);

  async teamList(
    context: NcContext,
    param: { workspaceId: string },
  ): Promise<WorkspaceTeamListV3Type> {
    // Get all team assignments for this workspace
    const assignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
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
          workspace_role: assignment.roles as Exclude<
            WorkspaceUserRoles,
            WorkspaceUserRoles.OWNER
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
      workspaceId: string;
      team: WorkspaceTeamCreateV3ReqType;
      req: NcRequest;
    },
  ): Promise<WorkspaceTeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceTeamCreate',
      param.team,
      true,
    );

    // Check if team exists
    const team = await Team.get(context, param.team.team_id);
    if (!team) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // Check if team is already assigned to workspace
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      PrincipalType.TEAM,
      param.team.team_id,
    );
    if (existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is already assigned to this workspace`,
      );
    }

    // Create the assignment
    const assignment = await PrincipalAssignment.insert(context, {
      resource_type: ResourceType.WORKSPACE,
      resource_id: param.workspaceId,
      principal_type: PrincipalType.TEAM,
      principal_ref_id: param.team.team_id,
      roles: param.team.workspace_role,
    });

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_icon_type: meta.icon_type || null,
      team_badge_color: meta.badge_color || null,
      workspace_role: assignment.roles as Exclude<
        WorkspaceUserRoles,
        WorkspaceUserRoles.OWNER
      >,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }

  async teamUpdate(
    context: NcContext,
    param: {
      workspaceId: string;
      team: WorkspaceTeamUpdateV3ReqType | WorkspaceTeamUpdateV3ReqType[];
      req: NcRequest;
    },
  ): Promise<WorkspaceTeamV3ResponseType | WorkspaceTeamV3ResponseType[]> {
    const teams = Array.isArray(param.team) ? param.team : [param.team];
    const results = [];

    for (const team of teams) {
      validatePayload(
        'swagger-v3.json#/components/schemas/WorkspaceTeamUpdate',
        team,
        true,
      );

      // Check if team exists
      const teamData = await Team.get(context, team.team_id);
      if (!teamData) {
        NcError.get(context).teamNotFound(team.team_id);
      }

      // Check if team is assigned to workspace
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.WORKSPACE,
        param.workspaceId,
        PrincipalType.TEAM,
        team.team_id,
      );
      if (!existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `Team ${team.team_id} is not assigned to this workspace`,
        );
      }

      // Update the assignment
      const updatedAssignment = await PrincipalAssignment.update(
        context,
        ResourceType.WORKSPACE,
        param.workspaceId,
        PrincipalType.TEAM,
        team.team_id,
        { roles: team.workspace_role },
      );

      const meta = parseMetaProp(teamData);

      results.push({
        team_id: teamData.id,
        team_title: teamData.title,
        team_icon: meta.icon || null,
        team_icon_type: meta.icon_type || null,
        team_badge_color: meta.badge_color || null,
        workspace_role: updatedAssignment.roles as Exclude<
          WorkspaceUserRoles,
          WorkspaceUserRoles.OWNER
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
      workspaceId: string;
      team: WorkspaceTeamDeleteV3ReqType | WorkspaceTeamDeleteV3ReqType[];
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    const teams = Array.isArray(param.team) ? param.team : [param.team];

    for (const team of teams) {
      validatePayload(
        'swagger-v3.json#/components/schemas/WorkspaceTeamDelete',
        team,
        true,
      );

      // Check if team is assigned to workspace
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.WORKSPACE,
        param.workspaceId,
        PrincipalType.TEAM,
        team.team_id,
      );
      if (!existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `Team ${team.team_id} is not assigned to this workspace`,
        );
      }

      // Get all users in the team before deleting the assignment
      const teamUsers = await PrincipalAssignment.list(context, {
        resource_type: ResourceType.TEAM,
        resource_id: team.team_id,
        principal_type: PrincipalType.USER,
      });

      // Delete the assignment
      await PrincipalAssignment.delete(
        context,
        ResourceType.WORKSPACE,
        param.workspaceId,
        PrincipalType.TEAM,
        team.team_id,
      );

      // Clear user cache for all users in the team
      for (const userAssignment of teamUsers) {
        await User.clearCache(userAssignment.principal_ref_id);
      }
    }

    return { msg: 'Team has been removed from workspace successfully' };
  }

  async teamAddBulk(
    context: NcContext,
    param: {
      workspaceId: string;
      teams: WorkspaceTeamCreateV3BulkReqType;
      req: NcRequest;
    },
  ): Promise<WorkspaceTeamV3ResponseType[]> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceTeamCreateBulk',
      param.teams,
      true,
    );

    const results = [];

    for (const team of param.teams.teams) {
      const result = await this.teamAdd(context, {
        workspaceId: param.workspaceId,
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
      workspaceId: string;
      teams: WorkspaceTeamDeleteV3BulkReqType;
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceTeamDeleteBulk',
      param.teams,
      true,
    );

    for (const team of param.teams.teams) {
      await this.teamRemove(context, {
        workspaceId: param.workspaceId,
        team,
        req: param.req,
      });
    }

    return { msg: 'Teams have been removed from workspace successfully' };
  }

  async teamDetail(
    context: NcContext,
    param: { workspaceId: string; teamId: string },
  ): Promise<WorkspaceTeamDetailV3Type> {
    // Check if team is assigned to workspace
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      PrincipalType.TEAM,
      param.teamId,
    );
    if (!assignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.teamId} is not assigned to this workspace`,
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
      workspace_role: assignment.roles as Exclude<
        WorkspaceUserRoles,
        WorkspaceUserRoles.OWNER
      >,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }
}
