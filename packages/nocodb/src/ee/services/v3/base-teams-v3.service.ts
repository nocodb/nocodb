import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  PlanFeatureTypes,
  ProjectRoles,
  TeamUserRoles,
} from 'nocodb-sdk';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  BaseTeamCreateV3BulkReqType,
  BaseTeamCreateV3ReqType,
  BaseTeamDeleteV3BulkReqType,
  BaseTeamDeleteV3ReqType,
  BaseTeamDetailV3Type,
  BaseTeamListV3Type,
  BaseTeamUpdateV3ReqType,
  BaseTeamV3ResponseType,
} from './base-teams-v3.types';
import type {
  BaseTeamDeleteEvent,
  BaseTeamInviteEvent,
  BaseTeamUpdateEvent,
} from '~/services/app-hooks/interfaces';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { PaymentService } from '~/ee/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { Base, PrincipalAssignment, Team, User } from '~/models';
import { PrincipalType, ResourceType } from '~/utils/globals';
import { validatePayload } from '~/helpers';
import { parseMetaProp } from '~/utils/modelUtils';
import { getFeature } from '~/helpers/paymentHelpers';
import { getProjectRolePower } from '~/utils/roleHelper';
import Noco from '~/Noco';

@Injectable()
export class BaseTeamsV3Service {
  protected readonly logger = new Logger(BaseTeamsV3Service.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly paymentService: PaymentService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Validates if the user has access to the Teams API.
   * This method checks if the feature is enabled for the workspace.
   * If not, it throws an error indicating that the feature is only available on paid plans.
   */
  private async validateFeatureAccess(context: NcContext) {
    if (
      !(await getFeature(
        PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
        context.workspace_id,
      ))
    ) {
      NcError.get(context).forbidden(
        'Accessing Teams API is only available on paid plans. Please upgrade your workspace plan to enable this feature. Your current plan is not sufficient.',
      );
    }
  }

  async teamList(
    context: NcContext,
    param: { baseId: string },
  ): Promise<BaseTeamListV3Type> {
    await this.validateFeatureAccess(context);

    // Get base to access workspace_id
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    // Get all team assignments for this base
    const baseTeamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.BASE,
      resource_id: param.baseId,
      principal_type: PrincipalType.TEAM,
    });

    // Get all team assignments for the workspace
    const workspaceTeamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.WORKSPACE,
      resource_id: base.fk_workspace_id,
      principal_type: PrincipalType.TEAM,
    });

    // Create a map of team IDs that are already assigned to base
    const baseTeamIds = new Set(
      baseTeamAssignments.map((a) => a.principal_ref_id),
    );

    // Create a map of workspace assignments for quick lookup
    const workspaceAssignmentMap = new Map(
      workspaceTeamAssignments.map((a) => [a.principal_ref_id, a]),
    );

    // Get team details for base teams (including those also assigned to workspace)
    const baseTeams = await Promise.all(
      baseTeamAssignments.map(async (assignment) => {
        const team = await Team.get(context, assignment.principal_ref_id);
        if (!team) {
          return null;
        }

        const meta = parseMetaProp(team);
        const workspaceAssignment = workspaceAssignmentMap.get(
          assignment.principal_ref_id,
        );

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
          workspace_role:
            (workspaceAssignment?.roles as Exclude<
              WorkspaceUserRoles,
              WorkspaceUserRoles.OWNER
            >) || null,
          created_at: assignment.created_at!,
          updated_at: assignment.updated_at!,
        };
      }),
    );

    // Get team details for workspace teams that are NOT assigned to base
    const workspaceOnlyTeams = await Promise.all(
      workspaceTeamAssignments
        .filter((assignment) => !baseTeamIds.has(assignment.principal_ref_id))
        .map(async (assignment) => {
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
            base_role: null,
            workspace_role: assignment.roles as Exclude<
              WorkspaceUserRoles,
              WorkspaceUserRoles.OWNER
            >,
            created_at: assignment.created_at!,
            updated_at: assignment.updated_at!,
          };
        }),
    );

    // Filter out null results and combine both lists
    const validBaseTeams = baseTeams.filter((team) => team !== null);
    const validWorkspaceOnlyTeams = workspaceOnlyTeams.filter(
      (team) => team !== null,
    );
    const allTeams = [...validBaseTeams, ...validWorkspaceOnlyTeams];

    return { list: allTeams };
  }

  async teamAdd(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamCreateV3ReqType;
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType> {
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/BaseTeamCreate',
      param.team,
      true,
    );

    // Fetch base
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    // Check if team exists
    const team = await Team.get(context, param.team.team_id);
    if (!team) {
      NcError.get(context).teamNotFound(param.team.team_id);
    }

    // INHERIT role can only be assigned to individual users, not teams
    if (param.team.base_role === ProjectRoles.INHERIT) {
      NcError.get(context).badRequest(
        'INHERIT role can only be assigned to individual users, not teams',
      );
    }

    // Check if current user has sufficient privilege to assign this role
    if (
      getProjectRolePower({
        base_roles: { [param.team.base_role]: true },
      }) > getProjectRolePower(param.req.user)
    ) {
      NcError.get(context).forbidden(
        `Insufficient privilege to assign team with this role`,
      );
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

    // Check if team is already assigned to workspace, if not add with "no access"
    const existingWorkspaceAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      context.workspace_id,
      PrincipalType.TEAM,
      param.team.team_id,
    );

    if (!existingWorkspaceAssignment) {
      // Add team to workspace with "no access" role
      await PrincipalAssignment.insert(context, {
        resource_type: ResourceType.WORKSPACE,
        resource_id: context.workspace_id,
        principal_type: PrincipalType.TEAM,
        principal_ref_id: param.team.team_id,
        roles: WorkspaceUserRoles.NO_ACCESS,
      });
    }

    const meta = parseMetaProp(team);

    const response = {
      team_id: team.id,
      team_title: team.title,
      team_icon: meta.icon || null,
      team_icon_type: meta.icon_type || null,
      team_badge_color: meta.badge_color || null,
      base_role: assignment.roles as Exclude<ProjectRoles, ProjectRoles.OWNER>,
      created_at: assignment.created_at!,
      updated_at: assignment.updated_at!,
    };

    // Emit base team invite event
    this.appHooksService.emit(AppEvents.PROJECT_TEAM_INVITE, {
      context,
      req: param.req,
      team: team,
      base,
      role: assignment.roles,
    } as BaseTeamInviteEvent);

    // Recalculate seat count after adding team to base
    await this.paymentService.reseatSubscription(base.fk_workspace_id!);

    // Notify team owners via email
    const teamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.TEAM,
      resource_id: team.id,
      principal_type: PrincipalType.USER,
    });
    const ownerAssignments = teamAssignments.filter(
      (assignment) => assignment.roles === TeamUserRoles.OWNER,
    );
    for (const ownerAssignment of ownerAssignments) {
      const owner = await User.get(ownerAssignment.principal_ref_id);
      if (owner) {
        await this.mailService.sendMail(
          {
            mailEvent: MailEvent.TEAM_ASSIGNED_TO_BASE,
            payload: {
              req: param.req,
              owner,
              team,
              base,
              baseRole: assignment.roles,
            },
          },
          Noco.ncMeta,
        );
      }
    }

    return response;
  }

  async teamUpdate(
    context: NcContext,
    param: {
      baseId: string;
      team: BaseTeamUpdateV3ReqType | BaseTeamUpdateV3ReqType[];
      req: NcRequest;
    },
  ): Promise<BaseTeamV3ResponseType | BaseTeamV3ResponseType[]> {
    await this.validateFeatureAccess(context);

    // Fetch base
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

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

      // INHERIT role can only be assigned to individual users, not teams
      if (team.base_role === ProjectRoles.INHERIT) {
        NcError.get(context).badRequest(
          'INHERIT role can only be assigned to individual users, not teams',
        );
      }

      // Check if current user has sufficient privilege to assign this role
      if (
        getProjectRolePower({
          base_roles: { [team.base_role]: true },
        }) > getProjectRolePower(param.req.user)
      ) {
        NcError.get(context).forbidden(
          `Insufficient privilege to assign team with this role`,
        );
      }

      // Check if team is assigned to base
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        team.team_id,
      );

      // Check if current user has sufficient privilege to update this team's role
      if (existingAssignment) {
        if (
          getProjectRolePower({
            base_roles: { [existingAssignment.roles as string]: true },
          }) > getProjectRolePower(param.req.user)
        ) {
          NcError.get(context).forbidden(
            `Insufficient privilege to update team with this role`,
          );
        }
      }

      let updatedAssignment;

      if (existingAssignment) {
        // Team is directly assigned to base - update the assignment
        updatedAssignment = await PrincipalAssignment.update(
          context,
          ResourceType.BASE,
          param.baseId,
          PrincipalType.TEAM,
          team.team_id,
          { roles: team.base_role },
        );
      } else {
        // Team is not directly assigned to base - check if it's assigned to workspace
        const workspaceAssignment = await PrincipalAssignment.get(
          context,
          ResourceType.WORKSPACE,
          base.fk_workspace_id!,
          PrincipalType.TEAM,
          team.team_id,
        );

        if (!workspaceAssignment) {
          NcError.get(context).invalidRequestBody(
            `Team ${team.team_id} is not assigned to this workspace or base`,
          );
        }

        // Team is workspace-assigned - create a base assignment with the new role
        // Use insert method which handles both creating new assignments and restoring soft-deleted ones
        updatedAssignment = await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.BASE,
          resource_id: param.baseId,
          principal_type: PrincipalType.TEAM,
          principal_ref_id: team.team_id,
          roles: team.base_role,
        });

        if (!updatedAssignment) {
          throw new Error(
            `Failed to create base assignment for team ${team.team_id}`,
          );
        }
      }

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

      // Notify all team owners via email about role update
      const teamAssignments = await PrincipalAssignment.list(context, {
        resource_type: ResourceType.TEAM,
        resource_id: teamData.id,
        principal_type: PrincipalType.USER,
      });
      const ownerAssignments = teamAssignments.filter(
        (assignment) => assignment.roles === TeamUserRoles.OWNER,
      );
      for (const ownerAssignment of ownerAssignments) {
        const owner = await User.get(ownerAssignment.principal_ref_id);
        if (owner) {
          await this.mailService.sendMail(
            {
              mailEvent: MailEvent.BASE_TEAM_ROLE_UPDATE,
              payload: {
                req: param.req,
                owner,
                team: teamData,
                base,
                oldBaseRole: existingAssignment?.roles || '',
                baseRole: updatedAssignment.roles || '',
              },
            },
            Noco.ncMeta,
          );
        }
      }

      // Emit base team update event
      this.appHooksService.emit(AppEvents.PROJECT_TEAM_UPDATE, {
        context,
        req: param.req,
        team: Array.isArray(param.team) ? results : results[0],
        oldRole: existingAssignment?.roles,
        role: updatedAssignment.roles,
        base,
      } as BaseTeamUpdateEvent);
    }

    // Recalculate seat count after updating team roles in base
    await this.paymentService.reseatSubscription(base.fk_workspace_id!);

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
    await this.validateFeatureAccess(context);

    // Fetch base
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    const teams = Array.isArray(param.team) ? param.team : [param.team];

    for (const teamIdObj of teams) {
      validatePayload(
        'swagger-v3.json#/components/schemas/BaseTeamDelete',
        teamIdObj,
        true,
      );

      const team = await Team.get(context, teamIdObj.team_id);

      // Check if team is assigned to base
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        teamIdObj.team_id,
      );
      if (!existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `Team ${teamIdObj.team_id} is not assigned to this base`,
        );
      }

      // Check if current user has sufficient privilege to remove this team
      if (
        getProjectRolePower({
          base_roles: { [existingAssignment.roles as string]: true },
        }) > getProjectRolePower(param.req.user)
      ) {
        NcError.get(context).forbidden(
          `Insufficient privilege to remove team with this role`,
        );
      }

      // Get all users in the team before deleting the assignment
      const teamUsers = await PrincipalAssignment.list(context, {
        resource_type: ResourceType.TEAM,
        resource_id: teamIdObj.team_id,
        principal_type: PrincipalType.USER,
      });

      // Delete the assignment
      await PrincipalAssignment.delete(
        context,
        ResourceType.BASE,
        param.baseId,
        PrincipalType.TEAM,
        teamIdObj.team_id,
      );

      // Clear user cache for all users in the team
      for (const userAssignment of teamUsers) {
        await User.clearCache(userAssignment.principal_ref_id);
      }

      // Notify all team owners via email about removal
      const teamAssignments = await PrincipalAssignment.list(context, {
        resource_type: ResourceType.TEAM,
        resource_id: teamIdObj.team_id,
        principal_type: PrincipalType.USER,
      });
      const ownerAssignments = teamAssignments.filter(
        (assignment) => assignment.roles === TeamUserRoles.OWNER,
      );
      for (const ownerAssignment of ownerAssignments) {
        const owner = await User.get(ownerAssignment.principal_ref_id);
        if (owner) {
          await this.mailService.sendMail(
            {
              mailEvent: MailEvent.BASE_TEAM_REMOVED,
              payload: {
                req: param.req,
                owner,
                team,
                base,
                baseRole: existingAssignment.roles || '',
              },
            },
            Noco.ncMeta,
          );
        }
      }

      // Emit base team delete event for each team
      this.appHooksService.emit(AppEvents.PROJECT_TEAM_DELETE, {
        context,
        req: param.req,
        team,
        base,
        role: existingAssignment.roles || '', // Include the role
      } as BaseTeamDeleteEvent);
    }

    // Recalculate seat count after removing team from base
    await this.paymentService.reseatSubscription(base.fk_workspace_id!);

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
    await this.validateFeatureAccess(context);

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
    await this.validateFeatureAccess(context);

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
    await this.validateFeatureAccess(context);

    // Get base to access workspace_id
    const base = await Base.get(context, param.baseId);
    if (!base) {
      NcError.get(context).baseNotFound(param.baseId);
    }

    // Check if team is assigned to base
    const baseAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.BASE,
      param.baseId,
      PrincipalType.TEAM,
      param.teamId,
    );

    // Check if team is assigned to workspace
    const workspaceAssignment = await PrincipalAssignment.get(
      context,
      ResourceType.WORKSPACE,
      base.fk_workspace_id!,
      PrincipalType.TEAM,
      param.teamId,
    );

    if (!baseAssignment && !workspaceAssignment) {
      NcError.get(context).invalidRequestBody(
        `Team ${param.teamId} is not assigned to this base or workspace`,
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
      base_role:
        (baseAssignment?.roles as Exclude<ProjectRoles, ProjectRoles.OWNER>) ||
        null,
      workspace_role:
        (workspaceAssignment?.roles as Exclude<
          WorkspaceUserRoles,
          WorkspaceUserRoles.OWNER
        >) || null,
      created_at: (baseAssignment || workspaceAssignment)!.created_at!,
      updated_at: (baseAssignment || workspaceAssignment)!.updated_at!,
    };
  }
}
