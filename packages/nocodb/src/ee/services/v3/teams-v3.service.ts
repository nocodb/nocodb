import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  extractRolesObj,
  PlanFeatureTypes,
  TeamUserRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  TeamCreateV3ReqType,
  TeamDetailV3Type,
  TeamMembersAddV3ReqType,
  TeamMembersRemoveV3ReqType,
  TeamMembersUpdateV3ReqType,
  TeamMemberV3ResponseType,
  TeamMoveV3ReqType,
  TeamTreeNodeV3Type,
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
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import { PaymentService } from '~/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { PrincipalAssignment, Team } from '~/models';
import { User, Workspace } from '~/models';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import {
  checkLimit,
  getFeature,
  PlanLimitTypes,
} from '~/helpers/paymentHelpers';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class TeamsV3Service {
  protected readonly logger = new Logger(TeamsV3Service.name);

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

  /**
   * Check if a user is a workspace owner (can bypass team hierarchy ACL)
   */
  private async isUserWorkspaceOwner(
    context: NcContext,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!userId) return false;
    try {
      const assignment = await PrincipalAssignment.get(
        context,
        ResourceType.WORKSPACE,
        workspaceId,
        PrincipalType.USER,
        userId,
      );
      return assignment?.roles === WorkspaceUserRoles.OWNER;
    } catch {
      return false;
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
    const teamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.TEAM,
      resource_id: teamId,
      principal_type: PrincipalType.USER,
    });

    // Filter only manager assignments
    const managerAssignments = teamAssignments.filter(
      (assignment) => assignment.roles === TeamUserRoles.OWNER,
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

    // Fetch all assignments for all teams in one query
    const teamIds = teams.map((t) => t.id);
    const allAssignments = await PrincipalAssignment.listByResourceIds(
      context,
      ResourceType.TEAM,
      teamIds,
      { principal_type: PrincipalType.USER },
    );

    // Build per-team lookup maps from the batch result
    const memberCountMap = new Map<string, number>();
    const ownerCountMap = new Map<string, number>();
    const ownersMap = new Map<string, string[]>();
    const currentUserMemberMap = new Map<string, boolean>();
    const currentUserOwnerMap = new Map<string, boolean>();

    for (const id of teamIds) {
      memberCountMap.set(id, 0);
      ownerCountMap.set(id, 0);
      ownersMap.set(id, []);
    }

    for (const assignment of allAssignments) {
      const tid = assignment.resource_id;
      memberCountMap.set(tid, (memberCountMap.get(tid) ?? 0) + 1);

      if (assignment.roles === TeamUserRoles.OWNER) {
        ownerCountMap.set(tid, (ownerCountMap.get(tid) ?? 0) + 1);
        ownersMap.get(tid)?.push(assignment.principal_ref_id);
      }

      if (currentUserId && assignment.principal_ref_id === currentUserId) {
        currentUserMemberMap.set(tid, true);
        if (assignment.roles === TeamUserRoles.OWNER) {
          currentUserOwnerMap.set(tid, true);
        }
      }
    }

    const teamsWithCounts = teams.map((team) => ({
      ...team,
      members_count: memberCountMap.get(team.id) ?? 0,
      managers_count: ownerCountMap.get(team.id) ?? 0,
      managers: ownersMap.get(team.id) ?? [],
      is_member: currentUserMemberMap.get(team.id) ?? false,
      is_owner: currentUserOwnerMap.get(team.id) ?? false,
    }));

    // Transform to v3 response format
    const teamsV3: TeamV3ResponseType[] = teamsWithCounts.map((team) => {
      const meta = parseMetaProp(team) ?? {};
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
        is_owner: team.is_owner,
        fk_parent_team_id: team.fk_parent_team_id || null,
        depth: team.depth ?? 0,
        path: team.path || undefined,
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

    // check if the current user have access to this team
    // user should be member of the team or workspace owner
    const currentUserId = context.user?.id;
    if (currentUserId) {
      const isWsOwner = !!extractRolesObj(context.user?.workspace_roles)?.[
        WorkspaceUserRoles.OWNER
      ];

      if (!isWsOwner) {
        const assignment = await PrincipalAssignment.get(
          context,
          ResourceType.TEAM,
          param.teamId,
          PrincipalType.USER,
          currentUserId,
        );

        if (!assignment) {
          NcError.get(context).forbidden(
            'You do not have access to view this team details',
          );
        }
      }
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

    // Load all direct member users in one query
    const directUserIds = userAssignments.map((a) => a.principal_ref_id);
    const directUsersMap = await User.getByIds(directUserIds);

    // Filter out missing users and transform to v3 response format
    const members = userAssignments
      .filter((a) => directUsersMap.has(a.principal_ref_id))
      .map((assignment) => {
        const user = directUsersMap.get(assignment.principal_ref_id)!;
        return {
          user_email: user.email,
          user_id: user.id,
          team_role: assignment.roles as TeamUserRoles,
        };
      });

    // Load inherited members from ancestor teams (path = /rootId/.../parentId/teamId)
    const directMemberIds = new Set(members.map((m) => m.user_id));
    const ancestorIds = (team.path || '')
      .split('/')
      .filter(Boolean)
      .slice(0, -1); // remove own ID — leaves ancestor IDs root-first

    const inheritedMembers: TeamDetailV3Type['inherited_members'] = [];

    if (ancestorIds.length) {
      // Load all ancestor teams + their assignments in parallel
      const [ancestorTeamsMap, ancestorAssignments] = await Promise.all([
        Team.getByIds(context, ancestorIds),
        PrincipalAssignment.listByResourceIds(
          context,
          ResourceType.TEAM,
          ancestorIds,
          { principal_type: PrincipalType.USER },
        ),
      ]);

      // Collect all ancestor member user IDs and batch-load
      const ancestorUserIds = ancestorAssignments
        .map((a) => a.principal_ref_id)
        .filter((id) => !directMemberIds.has(id));
      const ancestorUsersMap = await User.getByIds([
        ...new Set(ancestorUserIds),
      ]);

      for (const assignment of ancestorAssignments) {
        if (directMemberIds.has(assignment.principal_ref_id)) continue;

        const user = ancestorUsersMap.get(assignment.principal_ref_id);
        if (!user) continue;

        const ancestorTeam = ancestorTeamsMap.get(assignment.resource_id);
        if (!ancestorTeam) continue;

        inheritedMembers.push({
          user_email: user.email,
          user_id: user.id,
          team_role: assignment.roles as TeamUserRoles,
          inherited_from_team_id: assignment.resource_id,
          inherited_from_team_title: ancestorTeam.title,
        });
      }
    }

    const meta =
      typeof team.meta === 'string' ? JSON.parse(team.meta) : team.meta || {};
    const teamDetail: TeamDetailV3Type = {
      title: team.title,
      icon: meta.icon || null,
      icon_type: meta.icon_type || null,
      badge_color: meta.badge_color || null,
      members,
      inherited_members: inheritedMembers.length ? inheritedMembers : undefined,
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

    await checkLimit({
      workspace: workspace,
      delta: 1, // increase count by 1 for the new team
      type: PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} teams for your plan.`,
    });

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

    // Handle parent team hierarchy
    let parentTeam: any = null;
    let depth = 0;
    let path = `/${teamId}`;

    if (param.team.parent_team_id) {
      parentTeam = await Team.get(context, param.team.parent_team_id);
      if (!parentTeam) {
        NcError.get(context).teamNotFound(param.team.parent_team_id);
      }

      // Verify parent belongs to the same workspace
      if (parentTeam.fk_workspace_id !== param.workspaceOrOrgId) {
        NcError.get(context).invalidRequestBody(
          'Parent team must belong to the same workspace',
        );
      }

      // Only managers of the parent team can create sub-teams (unless user is workspace owner)
      const userId = param.req.user?.id;
      if (userId) {
        const isOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isOwner) {
          const parentAssignment = await PrincipalAssignment.get(
            context,
            ResourceType.TEAM,
            param.team.parent_team_id,
            PrincipalType.USER,
            userId,
          );
          if (
            !parentAssignment ||
            parentAssignment.roles !== TeamUserRoles.OWNER
          ) {
            NcError.get(context).forbidden(
              'Only managers of the parent team can create sub-teams',
            );
          }
        }
      }

      depth = (parentTeam.depth ?? 0) + 1;

      // Enforce max depth of 3
      if (depth > 3) {
        NcError.get(context).invalidRequestBody(
          'Maximum team hierarchy depth of 3 levels exceeded',
        );
      }

      path = `${parentTeam.path}/${teamId}`;
    }

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
      fk_parent_team_id: param.team.parent_team_id || null,
      depth,
      path,
      created_by: param.req.user.id,
    };

    const team = await Team.insert(context, teamData);

    // Add members if provided
    if (param.team.members && param.team.members.length > 0) {
      // Batch-validate all users exist
      const memberUserIds = param.team.members.map((m) => m.user_id);
      const usersMap = await User.getByIds(memberUserIds);
      for (const member of param.team.members) {
        if (!usersMap.has(member.user_id)) {
          NcError.get(context).userNotFound(member.user_id);
        }
      }

      // Insert all member assignments
      for (const member of param.team.members) {
        await PrincipalAssignment.insert(context, {
          resource_type: ResourceType.TEAM,
          resource_id: teamId,
          principal_type: PrincipalType.USER,
          principal_ref_id: member.user_id,
          roles: member.team_role,
        });
      }
    }

    let isMember = false;

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

        isMember = true;
      }
    }

    // Get member count for the created team
    const postCreateAssignments =
      await PrincipalAssignment.listByResourceIds(
        context,
        ResourceType.TEAM,
        [team.id],
        { principal_type: PrincipalType.USER },
      );
    const teamUsers = postCreateAssignments.length;
    const managers = postCreateAssignments
      .filter((a) => a.roles === TeamUserRoles.OWNER)
      .map((a) => a.principal_ref_id);
    const teamManagersCount = managers.length;

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
      is_member: isMember,
      is_owner: isMember, // creator is always added as owner
      fk_parent_team_id: team.fk_parent_team_id || null,
      depth: team.depth ?? 0,
      path: team.path || undefined,
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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: response.id,
          action: 'teamCreate',
          payload: response as TeamV3ResponseType,
        },
      },
      context.socket_id,
    );

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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: response.id,
          action: 'teamUpdate',
          payload: response as TeamV3ResponseType,
        },
      },
      context.socket_id,
    );

    return response;
  }

  async teamDelete(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      force?: boolean;
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

    // Check for child teams
    const children = await Team.getChildren(context, param.teamId);
    if (children.length > 0) {
      if (!param.force) {
        NcError.get(context).invalidRequestBody(
          `Cannot delete team "${team.title}" — it has ${children.length} sub-team(s). Use force=true to reparent children.`,
        );
      }

      // Reparent children to the deleted team's parent
      for (const child of children) {
        await Team.reparent(context, child.id, team.fk_parent_team_id || null);
      }
    }

    // Fetch both assignment directions in parallel
    const [teamAssignments, teamPrincipalAssignments] = await Promise.all([
      PrincipalAssignment.listByResource(context, ResourceType.TEAM, param.teamId),
      PrincipalAssignment.listByPrincipal(context, PrincipalType.TEAM, param.teamId),
    ]);

    // Delete all assignments (sequential — each delete does soft-delete + cache clear)
    for (const assignment of [
      ...teamAssignments,
      ...teamPrincipalAssignments,
    ]) {
      await PrincipalAssignment.delete(
        context,
        assignment.resource_type,
        assignment.resource_id,
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

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: team.id,
          action: 'teamDelete',
        },
      },
      context.socket_id,
    );

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

    if (!Array.isArray(param.members)) {
      NcError.get(context).invalidRequestBody(
        'Request body must be an array of {user_id, team_role} objects',
      );
    }

    // validate: all users exist
    const memberUserIds = param.members.map((m) => m.user_id);
    const usersMap = await User.getByIds(memberUserIds);
    for (const member of param.members) {
      if (!usersMap.has(member.user_id)) {
        NcError.get(context).userNotFound(member.user_id);
      }
    }

    // check: no user is already a member
    const existingAssignments = await PrincipalAssignment.listByResourceIds(
      context,
      ResourceType.TEAM,
      [param.teamId],
      { principal_type: PrincipalType.USER },
    );
    const existingMemberIds = new Set(
      existingAssignments.map((a) => a.principal_ref_id),
    );
    for (const member of param.members) {
      if (existingMemberIds.has(member.user_id)) {
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} is already a member of this team`,
        );
      }
    }

    // Insert assignments and emit events (inserts are sequential due to individual event/mail needs)
    const addedMembers = [];

    for (const member of param.members) {
      const user = usersMap.get(member.user_id)!;

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

      // Send email notification to the added user
      await this.mailService.sendMail(
        {
          mailEvent: MailEvent.TEAM_MEMBER_INVITE,
          payload: {
            req: param.req,
            user,
            team,
            workspace,
            teamRole: assignment.roles,
          },
        },
        Noco.ncMeta,
      );

      addedMembers.push(assignment);
    }

    // Recalculate seat count after adding team members
    await this.paymentService.reseatSubscription(workspace.id);

    // Transform to v3 response format — reuse already-loaded users
    const members = addedMembers.map((assignment) => {
      const user = usersMap.get(assignment.principal_ref_id)!;
      return {
        user_id: user.id,
        user_email: user.email,
        team_role: assignment.roles as TeamUserRoles,
      };
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: team.id,
          action: 'teamMembersAdd',
          payload: members as TeamMemberV3ResponseType[],
        },
      },
      context.socket_id,
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
    if (!Array.isArray(param.members)) {
      NcError.get(context).invalidRequestBody(
        'Request body must be an array of {user_id} objects',
      );
    }

    // load all users and current team assignments upfront
    const memberUserIds = param.members.map((m) => m.user_id);
    const [usersMap, currentAssignments] = await Promise.all([
      User.getByIds(memberUserIds),
      PrincipalAssignment.listByResourceIds(
        context,
        ResourceType.TEAM,
        [param.teamId],
        { principal_type: PrincipalType.USER },
      ),
    ]);

    const assignmentsByUserId = new Map(
      currentAssignments.map((a) => [a.principal_ref_id, a]),
    );

    // Hoist manager check outside the loop — only need to check once
    const isTeamManager = userId
      ? assignmentsByUserId.get(userId)?.roles === TeamUserRoles.OWNER
      : false;

    // Count current managers for last-manager protection
    let managersCount = currentAssignments.filter(
      (a) => a.roles === TeamUserRoles.OWNER,
    ).length;

    // Validate all members before making any changes
    for (const member of param.members) {
      const assignment = assignmentsByUserId.get(member.user_id);
      if (!assignment) {
        NcError.get(context).userNotFound(member.user_id);
      }

      const isSelfRemoval = userId === member.user_id;
      if (!isTeamManager && !isSelfRemoval) {
        NcError.get(context).forbidden(
          'Only team managers can remove members or users can remove themselves',
        );
      }

      // If removing the last manager, prevent it
      if (assignment!.roles === TeamUserRoles.OWNER) {
        if (managersCount === 1) {
          NcError.get(context).invalidRequestBody(
            'Cannot remove the last manager',
          );
        }
        managersCount--;
      }
    }

    // Execute deletions and emit events
    const removedMembers = [];

    for (const member of param.members) {
      const user = usersMap.get(member.user_id);
      const assignment = assignmentsByUserId.get(member.user_id)!;

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

      // Send email notification to the removed user
      await this.mailService.sendMail(
        {
          mailEvent: MailEvent.TEAM_MEMBER_REMOVED,
          payload: {
            req: param.req,
            user,
            team,
            workspace,
            teamRole: assignment.roles,
          },
        },
        Noco.ncMeta,
      );
    }

    // Recalculate seat count after removing team members
    await this.paymentService.reseatSubscription(workspace.id);

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: team.id,
          action: 'teamMembersRemove',
          payload: removedMembers as TeamMembersRemoveV3ReqType[],
        },
      },
      context.socket_id,
    );

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

    if (!Array.isArray(param.members)) {
      NcError.get(context).invalidRequestBody(
        'Request body must be an array of {user_id, team_role} objects',
      );
    }

    // load all users and current assignments upfront
    const memberUserIds = param.members.map((m) => m.user_id);
    const [usersMap, currentAssignments] = await Promise.all([
      User.getByIds(memberUserIds),
      PrincipalAssignment.listByResourceIds(
        context,
        ResourceType.TEAM,
        [param.teamId],
        { principal_type: PrincipalType.USER },
      ),
    ]);

    const assignmentsByUserId = new Map(
      currentAssignments.map((a) => [a.principal_ref_id, a]),
    );

    // Validate all members exist in team before making changes
    for (const member of param.members) {
      if (!assignmentsByUserId.has(member.user_id)) {
        NcError.get(context).invalidRequestBody(
          `User ${member.user_id} not found in this team`,
        );
      }
    }

    // Execute updates and emit events
    const updatedMembers = [];

    for (const member of param.members) {
      const user = usersMap.get(member.user_id);
      const oldAssignment = assignmentsByUserId.get(member.user_id)!;

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
        oldTeamRole: oldAssignment.roles, // Include old team role
        teamRole: member?.team_role || '', // Include new team role
      } as TeamMemberUpdateEvent);

      await this.mailService.sendMail(
        {
          mailEvent: MailEvent.TEAM_MEMBER_ROLE_UPDATE,
          payload: {
            req: param.req,
            user,
            team,
            workspace,
            oldTeamRole: oldAssignment.roles,
            teamRole: member.team_role,
          },
        },
        Noco.ncMeta,
      );
    }

    // Recalculate seat count after updating team member roles
    await this.paymentService.reseatSubscription(workspace.id);

    // Transform to v3 response format — reuse already-loaded users
    const members = updatedMembers.map((assignment) => {
      const user = usersMap.get(assignment.principal_ref_id)!;
      return {
        user_id: user.id,
        user_email: user.email,
        team_role: assignment.roles as TeamUserRoles,
      };
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: team.id,
          action: 'teamMembersUpdate',
          payload: members as TeamMemberV3ResponseType[],
        },
      },
      context.socket_id,
    );

    return members;
  }

  // ── Hierarchy endpoints ─────────────────────────────────────────

  async teamTree(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
    },
  ): Promise<{ list: TeamTreeNodeV3Type[] }> {
    await this.validateFeatureAccess(context);

    const treeRoots = await Team.getTree(context, param.workspaceOrOrgId);
    const currentUserId = context.user?.id;

    // Collect all team IDs from the tree
    const allNodeIds: string[] = [];
    const collectIds = (nodes: any[]) => {
      for (const node of nodes) {
        allNodeIds.push(node.id);
        if (node.children?.length) collectIds(node.children);
      }
    };
    collectIds(treeRoots);

    // Fetch all assignments for the entire tree in one query
    const allAssignments = await PrincipalAssignment.listByResourceIds(
      context,
      ResourceType.TEAM,
      allNodeIds,
      { principal_type: PrincipalType.USER },
    );

    // Build per-team lookup maps
    const memberCountMap = new Map<string, number>();
    const ownerCountMap = new Map<string, number>();
    const ownersMap = new Map<string, string[]>();
    const currentUserMemberMap = new Map<string, boolean>();
    const currentUserOwnerMap = new Map<string, boolean>();

    for (const id of allNodeIds) {
      memberCountMap.set(id, 0);
      ownerCountMap.set(id, 0);
      ownersMap.set(id, []);
    }

    for (const assignment of allAssignments) {
      const tid = assignment.resource_id;
      memberCountMap.set(tid, (memberCountMap.get(tid) ?? 0) + 1);

      if (assignment.roles === TeamUserRoles.OWNER) {
        ownerCountMap.set(tid, (ownerCountMap.get(tid) ?? 0) + 1);
        ownersMap.get(tid)?.push(assignment.principal_ref_id);
      }

      if (currentUserId && assignment.principal_ref_id === currentUserId) {
        currentUserMemberMap.set(tid, true);
        if (assignment.roles === TeamUserRoles.OWNER) {
          currentUserOwnerMap.set(tid, true);
        }
      }
    }

    // Enrich tree nodes synchronously using pre-fetched data
    const enrichNode = (node: any): TeamTreeNodeV3Type => {
      const meta = parseMetaProp(node) ?? {};

      return {
        id: node.id,
        title: node.title,
        icon: meta.icon || undefined,
        icon_type: meta.icon_type || undefined,
        badge_color: meta.badge_color || undefined,
        members_count: memberCountMap.get(node.id) ?? 0,
        managers_count: ownerCountMap.get(node.id) ?? 0,
        managers: ownersMap.get(node.id) ?? [],
        created_by: node.created_by,
        created_at: node.created_at,
        updated_at: node.updated_at,
        is_member: currentUserMemberMap.get(node.id) ?? false,
        is_owner: currentUserOwnerMap.get(node.id) ?? false,
        fk_parent_team_id: node.fk_parent_team_id || null,
        depth: node.depth ?? 0,
        path: node.path || undefined,
        children: (node.children || []).map(enrichNode),
      };
    };

    return { list: treeRoots.map(enrichNode) };
  }

  async teamMove(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      teamId: string;
      body: TeamMoveV3ReqType;
      req: NcRequest;
    },
  ): Promise<TeamV3ResponseType> {
    await this.validateFeatureAccess(context);

    // Validate payload has required field
    if (
      param.body === undefined ||
      param.body === null ||
      !('parent_team_id' in param.body)
    ) {
      NcError.get(context).invalidRequestBody(
        'parent_team_id is required (use null to move to root)',
      );
    }

    // Fetch workspace
    const workspace = await Workspace.get(param.workspaceOrOrgId);
    if (!workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to workspace
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }
    if (team.fk_workspace_id !== param.workspaceOrOrgId) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const userId = param.req.user?.id;
    const newParentId = param.body.parent_team_id;

    // Cannot move to self
    if (newParentId === param.teamId) {
      NcError.get(context).invalidRequestBody(
        'Cannot move a team to be its own parent',
      );
    }

    // Validate new parent
    if (newParentId) {
      const newParent = await Team.get(context, newParentId);
      if (!newParent) {
        NcError.get(context).teamNotFound(newParentId);
      }
      if (newParent.fk_workspace_id !== param.workspaceOrOrgId) {
        NcError.get(context).invalidRequestBody(
          'Parent team must belong to the same workspace',
        );
      }

      // Only managers of the new parent team can move teams under it (unless user is workspace owner)
      if (userId) {
        const isOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isOwner) {
          const parentAssignment = await PrincipalAssignment.get(
            context,
            ResourceType.TEAM,
            newParentId,
            PrincipalType.USER,
            userId,
          );
          if (
            !parentAssignment ||
            parentAssignment.roles !== TeamUserRoles.OWNER
          ) {
            NcError.get(context).forbidden(
              'Only managers of the target parent team can move teams under it',
            );
          }
        }
      }

      // Circular reference check: prevent moving team under one of its descendants
      // isAncestor(ancestorId, descendantId) returns true if ancestorId is ancestor of descendantId
      const wouldCreateCircle = await Team.isAncestor(
        context,
        param.teamId, // potential ancestor (team being moved)
        newParentId, // potential descendant (new parent)
      );
      if (wouldCreateCircle) {
        NcError.get(context).invalidRequestBody(
          'Cannot move a team under one of its own descendants (circular reference)',
        );
      }

      // Depth limit check — get max depth in source subtree
      const descendants = await Team.getDescendants(context, param.teamId);
      const maxSubtreeDepth = descendants.length
        ? Math.max(...descendants.map((d) => d.depth)) - team.depth
        : 0;
      const newDepth = (newParent.depth ?? 0) + 1;

      if (newDepth + maxSubtreeDepth > 3) {
        NcError.get(context).invalidRequestBody(
          'Moving this team would exceed the maximum hierarchy depth of 3 levels',
        );
      }
    }

    // Fetch old parent before reparenting for audit
    const oldParentTeam = team.fk_parent_team_id
      ? await Team.get(context, team.fk_parent_team_id)
      : null;

    // Perform the reparent
    await Team.reparent(context, param.teamId, newParentId);

    // Get updated team
    const updatedTeam = await Team.get(context, param.teamId);

    const [membersCount, managersCount, managers] = await Promise.all([
      this.getTeamMembersCount(context, updatedTeam.id),
      this.getTeamOwnersCount(context, updatedTeam.id),
      this.getTeamOwners(context, updatedTeam.id),
    ]);

    const meta = parseMetaProp(updatedTeam);

    const response: TeamV3ResponseType = {
      id: updatedTeam.id,
      title: updatedTeam.title,
      icon: meta.icon || undefined,
      icon_type: meta.icon_type || undefined,
      badge_color: meta.badge_color || undefined,
      members_count: membersCount,
      managers_count: managersCount,
      managers,
      created_by: updatedTeam.created_by,
      created_at: updatedTeam.created_at,
      updated_at: updatedTeam.updated_at,
      fk_parent_team_id: updatedTeam.fk_parent_team_id || null,
      depth: updatedTeam.depth ?? 0,
      path: updatedTeam.path || undefined,
    };

    // Emit team move event
    this.appHooksService.emit(AppEvents.TEAM_MOVE, {
      context,
      req: param.req,
      team: updatedTeam,
      oldParentTeam: oldParentTeam ?? null,
      newParentTeam: newParentId ? await Team.get(context, newParentId) : null,
      workspace,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.TEAM_EVENT,
        payload: {
          id: response.id,
          action: 'teamMove',
          payload: response,
        },
      },
      context.socket_id,
    );

    return response;
  }
}
