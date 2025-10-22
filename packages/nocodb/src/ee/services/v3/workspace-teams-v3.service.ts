import { Injectable, Logger } from '@nestjs/common';
import type { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  WorkspaceTeamCreateV3ReqType,
  WorkspaceTeamDeleteV3ReqType,
  WorkspaceTeamDetailV3Type,
  WorkspaceTeamListV3Type,
  WorkspaceTeamUpdateV3ReqType,
  WorkspaceTeamV3ResponseType,
} from './workspace-teams-v3.types';
import { NcError } from '~/helpers/catchError';
import { Principal, PrincipalAssignment, Team } from '~/models';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import {validatePayload} from "~/helpers";
import Noco from "~/Noco";

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
      (assignment) => assignment.resource_type === ResourceType.WORKSPACE,
    );

    // Get team principals and their details
    const teams = await Promise.all(
      teamAssignments.map(async (assignment) => {
        const principal = await Principal.get(
          context,
          assignment.fk_principal_id,
        );
        if (!principal || principal.principal_type !== PrincipalType.TEAM) {
          return null;
        }

        const team = await Team.get(context, principal.ref_id);
        if (!team) {
          return null;
        }

        const meta = parseMetaProp(team);

        return {
          team_id: team.id,
          team_title: team.title,
          team_icon: meta.icon || null,
          team_badge_color: meta.badge_color || null,
          workspace_role: assignment.roles as
            | WorkspaceUserRoles.CREATOR
            | WorkspaceUserRoles.EDITOR
            | WorkspaceUserRoles.VIEWER
            | WorkspaceUserRoles.COMMENTER
            | WorkspaceUserRoles.NO_ACCESS,
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

    // Create or get team principal
    let teamPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.TEAM,
      param.team.team_id,
    );
    if (!teamPrincipal) {
      teamPrincipal = await Principal.insert(context, {
        id: (await Noco.ncMeta.genNanoid(MetaTable.PRINCIPALS)) as string,
        principal_type: PrincipalType.TEAM,
        ref_id: param.team.team_id,
      });
    }

    // Check if team is already assigned to workspace
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
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
      fk_principal_id: teamPrincipal.id,
      roles: param.team.workspace_role,
    });

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_badge_color: meta.badge_color || null,
      workspace_role: assignment.roles as
        | WorkspaceUserRoles.CREATOR
        | WorkspaceUserRoles.EDITOR
        | WorkspaceUserRoles.VIEWER
        | WorkspaceUserRoles.COMMENTER
        | WorkspaceUserRoles.NO_ACCESS,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }

  async teamUpdate(
    context: NcContext,
    param: {
      workspaceId: string;
      team: WorkspaceTeamUpdateV3ReqType;
      req: NcRequest;
    },
  ): Promise<WorkspaceTeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceTeamUpdate',
      param.team,
      true,
    );

    // Check if team exists
    const team = await Team.get(context, param.team.team_id);
    if (!team) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // Get team principal
    const teamPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.TEAM,
      param.team.team_id,
    );
    if (!teamPrincipal) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // Check if team is assigned to workspace
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
    );
    if (!existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is not assigned to this workspace`,
      );
    }

    // Update the assignment
    const updatedAssignment = await PrincipalAssignment.update(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
      { roles: param.team.workspace_role },
    );

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_badge_color: meta.badge_color || null,
      workspace_role: updatedAssignment.roles as
        | WorkspaceUserRoles.CREATOR
        | WorkspaceUserRoles.EDITOR
        | WorkspaceUserRoles.VIEWER
        | WorkspaceUserRoles.COMMENTER
        | WorkspaceUserRoles.NO_ACCESS,
      created_at: updatedAssignment.created_at!,
      updated_at: updatedAssignment.updated_at!,
    };
  }

  async teamRemove(
    context: NcContext,
    param: {
      workspaceId: string;
      team: WorkspaceTeamDeleteV3ReqType;
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    validatePayload(
      'swagger-v3.json#/components/schemas/WorkspaceTeamDelete',
      param.team,
      true,
    );

    // Get team principal
    const teamPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.TEAM,
      param.team.team_id,
    );
    if (!teamPrincipal) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // Check if team is assigned to workspace
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
    );
    if (!existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is not assigned to this workspace`,
      );
    }

    // Delete the assignment
    await PrincipalAssignment.delete(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
    );

    return { msg: 'Team has been removed from workspace successfully' };
  }

  async teamDetail(
    context: NcContext,
    param: { workspaceId: string; teamId: string },
  ): Promise<WorkspaceTeamDetailV3Type> {
    // Get team principal
    const teamPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.TEAM,
      param.teamId,
    );
    if (!teamPrincipal) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if team is assigned to workspace
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      param.workspaceId,
      teamPrincipal.id,
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
      team_badge_color: meta.badge_color || null,
      workspace_role: assignment.roles as
        | WorkspaceUserRoles.CREATOR
        | WorkspaceUserRoles.EDITOR
        | WorkspaceUserRoles.VIEWER
        | WorkspaceUserRoles.COMMENTER
        | WorkspaceUserRoles.NO_ACCESS,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }
}
