import { Injectable, Logger } from '@nestjs/common';
import type { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  BaseTeamCreateV3ReqType,
  BaseTeamDeleteV3ReqType,
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamUpdateV3ReqType,
  BaseTeamV3ResponseType,
} from './base-teams-v3.types';
import { NcError } from '~/helpers/catchError';
import { Principal, PrincipalAssignment, Team } from '~/models';
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
      (assignment) => assignment.resource_type === ResourceType.BASE,
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
          base_role: assignment.roles as
            | ProjectRoles.CREATOR
            | ProjectRoles.EDITOR
            | ProjectRoles.VIEWER
            | ProjectRoles.COMMENTER
            | ProjectRoles.NO_ACCESS,
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

    // Check if team is already assigned to base
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
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
      fk_principal_id: teamPrincipal.id,
      roles: param.team.base_role,
    });

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_badge_color: meta.badge_color || null,
      base_role: assignment.roles as
        | ProjectRoles.CREATOR
        | ProjectRoles.EDITOR
        | ProjectRoles.VIEWER
        | ProjectRoles.COMMENTER
        | ProjectRoles.NO_ACCESS,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }

  async teamUpdate(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamUpdateV3ReqType;
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamUpdate',
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

    // Check if team is assigned to base
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
    );
    if (!existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is not assigned to this base`,
      );
    }

    // Update the assignment
    const updatedAssignment = await PrincipalAssignment.update(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
      { roles: param.team.base_role },
    );

    const meta = parseMetaProp(team);

    return {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_badge_color: meta.badge_color || null,
      base_role: updatedAssignment.roles as
        | ProjectRoles.CREATOR
        | ProjectRoles.EDITOR
        | ProjectRoles.VIEWER
        | ProjectRoles.COMMENTER
        | ProjectRoles.NO_ACCESS,
      created_at: updatedAssignment.created_at!,
      updated_at: updatedAssignment.updated_at!,
    };
  }

  async teamRemove(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamDeleteV3ReqType;
      req: NcRequest;
    },
  ): Promise<{ msg: string }> {
    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamDelete',
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

    // Check if team is assigned to base
    const existingAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
    );
    if (!existingAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.team.team_id} is not assigned to this base`,
      );
    }

    // Delete the assignment
    await PrincipalAssignment.delete(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
    );

    return { msg: 'Team has been removed from base successfully' };
  }

  async teamDetail(
    context: NcContext,
    param: { baseId: string; teamId: string },
  ): Promise<BaseTeamDetailV3Type> {
    // Get team principal
    const teamPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.TEAM,
      param.teamId,
    );
    if (!teamPrincipal) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if team is assigned to base
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      teamPrincipal.id,
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
      team_badge_color: meta.badge_color || null,
      base_role: assignment.roles as
        | ProjectRoles.CREATOR
        | ProjectRoles.EDITOR
        | ProjectRoles.VIEWER
        | ProjectRoles.COMMENTER
        | ProjectRoles.NO_ACCESS,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };
  }
}
