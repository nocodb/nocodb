import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, PlanFeatureTypes, TeamUserRoles } from 'nocodb-sdk';
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
import type {
  TeamDeleteEvent,
  TeamMemberAddEvent,
  TeamMemberDeleteEvent,
  TeamMemberUpdateEvent,
  TeamUpdateEvent,
} from '~/services/app-hooks/interfaces';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PaymentService } from '~/ee/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { PrincipalAssignment, Team } from '~/models';
import { User, Workspace } from '~/models';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import { getFeature } from '~/helpers/paymentHelpers';

@Injectable()
export class TeamsV3Service {
  protected readonly logger = new Logger(TeamsV3Service.name);

  constructor(
    private readonly appHooksService: AppHooksService,
    private readonly paymentService: PaymentService,
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

  async getTeamMembersCount(
    context: NcContext,
    teamId: string,
  ): Promise<number> {
    return await PrincipalAssignment.countByResource(
      context,
      ResourceType.TEAM,
      teamId,
    );
  }

  async getTeamOwnersCount(
    context: NcContext,
    teamId: string,
  ): Promise<number> {
    return await PrincipalAssignment.countByResourceAndRole(
      context,
      ResourceType.TEAM,
      teamId,
      TeamUserRoles.OWNER,
    );
  }

  async getTeamOwners(context: NcContext, teamId: string): Promise<string[]> {
    const teamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.TEAM,
      teamId,
    );

    // Filter only manager assignments
    const managerAssignments = teamAssignments.filter(
      (assignment) =>
        assignment.principal_type === PrincipalType.USER &&
        assignment.roles === TeamUserRoles.OWNER,
    );

    return managerAssignments.map((assignment) => assignment.principal_ref_id);
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
    await this.validateFeatureAccess(context);

    // For now, assume it's a workspace ID (can be enhanced later to detect org vs workspace)
    const filterParam = { fk_workspace_id: param.workspaceOrOrgId };

    const teams = await Team.list(context, filterParam);

    // Get the current user ID from context
    const currentUserId = context.user?.id;

    // Get teams with member counts using optimized query
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => {
        const [membersCount, managersCount, managers] = await Promise.all([
          this.getTeamMembersCount(context, team.id),
          this.getTeamOwnersCount(context, team.id),
          this.getTeamOwners(context, team.id),
        ]);

        // Check if current user is a member of this team
        let isMember = false;
        if (currentUserId) {
          const assignment = await PrincipalAssignment.get(
            context,
            ResourceType.TEAM,
            team.id,
            PrincipalType.USER,
            currentUserId,
          );
          isMember = assignment !== null;
        }

        return {
          ...team,
          members_count: membersCount,
          managers_count: managersCount,
          managers: managers,
          is_member: isMember,
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
        managers: team.managers,
        created_by: team.created_by,
        created_at: team.created_at,
        updated_at: team.updated_at,
        is_member: team.is_member,
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
    await this.validateFeatureAccess(context);

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
    const teamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.TEAM,
      param.teamId,
    );

    // Filter only user assignments
    const userAssignments = teamAssignments.filter(
      (assignment) => assignment.principal_type === PrincipalType.USER,
    );

    const membersWithUsers = await Promise.all(
      userAssignments.map(async (assignment) => {
        const user = await User.get(assignment.principal_ref_id);
        if (!user) {
          return null;
        }
        return {
          assignment,
          user,
        };
      }),
    );

    // Filter out null entries and transform to v3 response format with email
    const members = membersWithUsers
      .filter((item) => item !== null)
      .map(({ assignment, user }) => ({
        user_email: user.email,
        user_id: user.id,
        team_role: assignment.roles as TeamUserRoles,
      }));

    const meta =
      typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
    const teamDetail: TeamDetailV3Type = {
      title: team.title,
      icon: meta.icon || null,
      icon_type: meta.icon_type || null,
      badge_color: meta.badge_color || null,
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
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/TeamCreateV3Req',
      param.team,
      true,
    );

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

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
      created_by: param.req.user.id,
    };

    const team = await Team.insert(context, teamData);

    // Add members if provided
    if (param.team.members && param.team.members.length > 0) {
      for (const member of param.team.members ?? []) {
        // Verify user exists and belongs to workspace/org
        const user = await User.get(member.user_id);
        if (!user) {
          NcError.get(context).userNotFound(member.user_id);
        }

        // Add user to team via principal assignment
        await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.TEAM,
          resource_id: teamId,
          principal_type: PrincipalType.USER,
          principal_ref_id: member.user_id,
          roles: member.team_role,
        });
      }
    }

    // Add creator as team manager if not already added
    const creatorId = param.req.user?.id;
    if (creatorId) {
      // Check if creator is already assigned to team
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        teamId,
        PrincipalType.USER,
        creatorId,
      );
      if (!existingAssignment) {
        await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.TEAM,
          resource_id: teamId,
          principal_type: PrincipalType.USER,
          principal_ref_id: creatorId,
          roles: TeamUserRoles.OWNER,
        });
      }
    }

    // Get member count for the created team
    const [teamUsers, teamManagersCount, managers] = await Promise.all([
      this.getTeamMembersCount(context, team.id),
      this.getTeamOwnersCount(context, team.id),
      this.getTeamOwners(context, team.id),
    ]);

    // Transform to v3 response format
    const meta = parseMetaProp(team);

    const response = {
      id: team.id,
      title: team.title,
      icon: meta.icon || null,
      icon_type: meta.icon_type || null,
      badge_color: meta.badge_color || null,
      members_count: teamUsers,
      managers_count: teamManagersCount,
      managers: managers,
      created_by: team.created_by,
      created_at: team.created_at,
      updated_at: team.updated_at,
    };

    // Emit team create event
    this.appHooksService.emit(AppEvents.TEAM_CREATE, {
      context,
      req: param.req,
      team: team,
      workspace,
    });

    // Recalculate seat count after team creation
    await this.paymentService.reseatSubscription(workspace.id);

    return response;
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
    await this.validateFeatureAccess(context);

    validatePayload(
      'swagger-v3.json#/components/schemas/TeamUpdateV3Req',
      param.team,
    );

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to workspace/org
    const oldTeam = await Team.get(context, param.teamId);
    if (!oldTeam) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = oldTeam.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team manager
    const userId = param.req.user?.id;
    if (userId) {
      // Check if user is assigned as manager to this team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        userId,
      );
      if (!assignment || assignment.roles !== TeamUserRoles.OWNER) {
        NcError.get(context).forbidden(
          'Only team managers can update team information',
        );
      }
    }

    const updateData: any = {};
    if (param.team.title !== undefined) updateData.title = param.team.title;
    if (param.team.icon !== undefined || param.team.badge_color !== undefined) {
      const existingMeta =
        typeof oldTeam.meta === 'string'
          ? JSON.parse(oldTeam.meta)
          : oldTeam.meta || {};
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
    const [teamUsers, teamManagersCount, managers] = await Promise.all([
      this.getTeamMembersCount(context, updatedTeam.id),
      this.getTeamOwnersCount(context, updatedTeam.id),
      this.getTeamOwners(context, updatedTeam.id),
    ]);

    // Transform to v3 response format
    const meta = parseMetaProp(updatedTeam);

    const response = {
      id: updatedTeam.id,
      title: updatedTeam.title,
      icon: meta.icon || null,
      icon_type: meta.icon_type || null,
      badge_color: meta.badge_color || null,
      members_count: teamUsers,
      managers_count: teamManagersCount,
      managers: managers,
      created_by: updatedTeam.created_by,
      created_at: updatedTeam.created_at,
      updated_at: updatedTeam.updated_at,
    };

    // Emit team update event
    this.appHooksService.emit(AppEvents.TEAM_UPDATE, {
      context,
      req: param.req,
      team: updatedTeam,
      oldTeam,
      workspace,
    } as TeamUpdateEvent);

    // Recalculate seat count after team update
    await this.paymentService.reseatSubscription(workspace.id);

    return response;
  }

  async teamDelete(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      req: NcRequest;
    },
  ) {
    await this.validateFeatureAccess(context);

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team manager or org owner
    const userId = param.req.user?.id;
    if (userId) {
      // Check if user is assigned as manager to this team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        userId,
      );
      const isTeamManager =
        assignment && assignment.roles === TeamUserRoles.OWNER;

      // TODO: Add org owner check when org ownership is implemented
      if (!isTeamManager) {
        NcError.get(context).forbidden('Only team managers can delete teams');
      }
    }

    // Delete all team assignments first
    const teamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.TEAM,
      param.teamId,
    );
    for (const assignment of teamAssignments) {
      await PrincipalAssignment.delete(
        context,
        ResourceType.TEAM,
        param.teamId,
        assignment.principal_type,
        assignment.principal_ref_id,
      );
    }

    // Delete the team
    await Team.delete(context, param.teamId);

    // Emit team delete event
    this.appHooksService.emit(AppEvents.TEAM_DELETE, {
      context,
      req: param.req,
      team,
      workspace,
    } as TeamDeleteEvent);

    // Recalculate seat count after team deletion
    await this.paymentService.reseatSubscription(workspace.id);

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
    await this.validateFeatureAccess(context);

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team manager
    const userId = param.req.user?.id;
    if (userId) {
      // Check if user is assigned as manager to this team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        userId,
      );
      if (!assignment || assignment.roles !== TeamUserRoles.OWNER) {
        NcError.get(context).forbidden('Only team managers can add members');
      }
    }

    const addedMembers = [];

    for (const member of param.members ?? []) {
      // Check if user exists
      const user = await User.get(member.user_id);
      if (!user) {
        NcError.get(context).userNotFound(member.user_id);
      }

      // Check if user is already assigned to team
      const existingAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        member.user_id,
      );
      if (existingAssignment) {
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} is already a member of this team`,
        );
      }

      const assignment = await PrincipalAssignment.insert(context, {
        resource_type: ResourceType.TEAM,
        resource_id: param.teamId,
        principal_type: PrincipalType.USER,
        principal_ref_id: member.user_id,
        roles:
          member.team_role === TeamUserRoles.OWNER
            ? TeamUserRoles.OWNER
            : member.team_role,
      });

      // Emit team member add event
      this.appHooksService.emit(AppEvents.TEAM_MEMBER_ADD, {
        context,
        req: param.req,
        team: team,
        workspace,
        user, // Include user info
        teamRole: assignment.roles || '', // Include team role
      } as TeamMemberAddEvent);

      addedMembers.push(assignment);
    }

    // Recalculate seat count after adding team members
    await this.paymentService.reseatSubscription(workspace.id);

    // Transform to v3 response format with email
    const members = await Promise.all(
      addedMembers.map(async (assignment) => {
        const user = await this.getUserById(
          context,
          assignment.principal_ref_id,
        );
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: assignment.roles as TeamUserRoles,
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
    await this.validateFeatureAccess(context);

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

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

    for (const member of param.members ?? []) {
      const user = await User.get(member.user_id);
      // Check if user is assigned to team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        member.user_id,
      );
      if (!assignment) {
        NcError.get(context).userNotFound(member.user_id);
      }

      // Check permissions: team manager or user removing themselves
      const isTeamManager = userId
        ? (await PrincipalAssignment.get(
            context,
            ResourceType.TEAM,
            param.teamId,
            PrincipalType.USER,
            userId,
          ).then((a) => a?.roles === TeamUserRoles.OWNER)) || false
        : false;
      const isSelfRemoval = userId === member.user_id;

      if (!isTeamManager && !isSelfRemoval) {
        NcError.get(context).forbidden(
          'Only team managers can remove members or users can remove themselves',
        );
      }

      // If removing the last manager, prevent it
      if (assignment!.roles === TeamUserRoles.OWNER) {
        const managersCount = await this.getTeamOwnersCount(
          context,
          param.teamId,
        );
        if (managersCount === 1) {
          NcError.get(context).invalidRequestBody(
            'Cannot remove the last manager',
          );
        }
      }

      await PrincipalAssignment.delete(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        member.user_id,
      );
      removedMembers.push({ user_id: member.user_id });

      // Emit team member remove event
      this.appHooksService.emit(AppEvents.TEAM_MEMBER_DELETE, {
        context,
        req: param.req,
        team,
        workspace,
        user: user,
        teamRole: assignment.roles,
      } as TeamMemberDeleteEvent);
    }

    // Recalculate seat count after removing team members
    await this.paymentService.reseatSubscription(workspace.id);

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
    await this.validateFeatureAccess(context);

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope = team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Check if user is team manager
    const userId = param.req.user?.id;
    if (userId) {
      // Check if user is assigned as manager to this team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        userId,
      );
      if (!assignment || assignment.roles !== TeamUserRoles.OWNER) {
        NcError.get(context).forbidden(
          'Only team managers can update member roles',
        );
      }
    }

    const updatedMembers = [];

    for (const member of param.members ?? []) {
      // check user exists
      const user = await User.get(member.user_id);

      // Check if user is assigned to team
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        member.user_id,
      );
      if (!assignment) {
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} not found in this team`,
        );
      }

      const updatedAssignment = await PrincipalAssignment.update(
        context,
        ResourceType.TEAM,
        param.teamId,
        PrincipalType.USER,
        member.user_id,
        { roles: member.team_role },
      );

      updatedMembers.push(updatedAssignment);

      // Emit team member update event
      this.appHooksService.emit(AppEvents.TEAM_MEMBER_UPDATE, {
        context,
        req: param.req,
        team,
        workspace,
        user,
        oldTeamRole: assignment.roles, // Include old team role
        teamRole: member?.team_role || '', // Include new team role
      } as TeamMemberUpdateEvent);
    }

    // Recalculate seat count after updating team member roles
    await this.paymentService.reseatSubscription(workspace.id);

    // Transform to v3 response format with email
    const members = await Promise.all(
      updatedMembers.map(async (assignment) => {
        const user = await this.getUserById(
          context,
          assignment.principal_ref_id,
        );
        return {
          user_id: user.id,
          user_email: user.email,
          team_role: assignment.roles as TeamUserRoles,
        };
      }),
    );

    return members;
  }
}
