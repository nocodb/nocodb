import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  EventType,
  extractRolesObj,
  PlanFeatureTypes,
  TeamUserRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
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
import { isOnPrem } from '~/utils';
import { PrincipalAssignment, Team } from '~/models';
import { User, Workspace } from '~/models';
import Org from '~/models/Org';
import OrgUser from '~/ee/models/OrgUser';
import WorkspaceUser from '~/models/WorkspaceUser';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import { parseMetaProp } from '~/utils/modelUtils';
import {
  checkGlobalSeatHeadroom,
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
    // Skip plan check for org-scoped requests (no workspace_id)
    if (!context.workspace_id) return;

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
   * Check if a user is a workspace owner (can bypass team hierarchy ACL).
   */
  private async isUserWorkspaceOwner(
    _context: NcContext,
    userId: string,
    workspaceId: string,
  ): Promise<boolean> {
    if (!userId) return false;
    try {
      const wsUser = await WorkspaceUser.get(workspaceId, userId);
      return wsUser?.roles === WorkspaceUserRoles.OWNER;
    } catch {
      return false;
    }
  }

  /**
   * Detect whether workspaceOrOrgId is a workspace or org.
   * Returns { scope, orgId?, workspaceId? }.
   */
  private async resolveScope(workspaceOrOrgId: string): Promise<{
    scope: 'org' | 'workspace';
    orgId?: string;
    workspaceId?: string;
  }> {
    // Check workspace first (more common)
    const workspace = await Workspace.get(workspaceOrOrgId);
    if (workspace) {
      return { scope: 'workspace', workspaceId: workspaceOrOrgId };
    }

    // Check org
    const org = await Org.get(workspaceOrOrgId);
    if (org) {
      return { scope: 'org', orgId: workspaceOrOrgId };
    }

    NcError.notFound('Workspace or Organization not found');
  }

  /**
   * Get team and verify it belongs to the given workspace/org scope.
   * Returns { team, workspace (null for org teams) }.
   */
  private async getTeamInScope(
    context: NcContext,
    workspaceOrOrgId: string,
    teamId: string,
  ) {
    const team = await Team.get(context, teamId);
    if (!team) {
      NcError.get(context).teamNotFound(teamId);
    }

    const belongsToScope =
      team.fk_workspace_id === workspaceOrOrgId ||
      team.fk_org_id === workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(teamId);
    }

    const workspace = team.fk_workspace_id
      ? await Workspace.get(team.fk_workspace_id)
      : null;

    return { team, workspace };
  }

  /**
   * Check if user is an org admin (ADMIN/OWNER role in nc_org_users).
   * Used for org-level team management authorization.
   */
  private async isUserOrgAdmin(
    orgId: string,
    userId: string,
  ): Promise<boolean> {
    if (!orgId || !userId) return false;
    const orgUser = await OrgUser.get(orgId, userId);
    if (!orgUser) return false;
    return (
      orgUser.roles === EnterpriseOrgUserRoles.ADMIN ||
      orgUser.roles === EnterpriseOrgUserRoles.OWNER
    );
  }

  /**
   * Broadcast a team event. For workspace teams, broadcasts to the workspace.
   * For org teams, broadcasts to ALL workspaces in the org so their team lists refresh.
   */
  private async broadcastTeamEvent(
    context: NcContext,
    team: { fk_workspace_id?: string; fk_org_id?: string },
    eventPayload: any,
  ) {
    if (context.workspace_id) {
      // Workspace team — single broadcast
      NocoSocket.broadcastEvent(context, eventPayload, context.socket_id);
    } else if (team.fk_org_id) {
      // Org team — broadcast to all workspaces in the org
      const orgWorkspaces = await Noco.ncMeta
        .knexConnection(MetaTable.WORKSPACE)
        .where('fk_org_id', team.fk_org_id)
        .whereNot('deleted', true)
        .select('id');

      for (const ws of orgWorkspaces) {
        const wsContext = { ...context, workspace_id: ws.id } as NcContext;
        NocoSocket.broadcastEvent(wsContext, eventPayload, context.socket_id);
      }
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
      scope?: 'workspace' | 'org';
    },
  ): Promise<{ list: TeamV3ResponseType[] }> {
    const scope =
      param.scope || (await this.resolveScope(param.workspaceOrOrgId)).scope;
    const workspaceId =
      scope === 'workspace' ? param.workspaceOrOrgId : undefined;
    const orgId = scope === 'org' ? param.workspaceOrOrgId : undefined;

    // For org scope, skip feature check entirely
    // For workspace scope, check if team management is available
    // but still allow loading org teams even when it's not
    let hasTeamFeature = true;

    if (scope === 'workspace' && context.workspace_id) {
      hasTeamFeature = await getFeature(
        PlanFeatureTypes.FEATURE_TEAM_MANAGEMENT,
        context.workspace_id,
      );
    }

    let teams;

    if (scope === 'org') {
      teams = await Team.list(context, { fk_org_id: orgId });
    } else {
      // Fetch workspace teams only if plan supports team management
      const wsTeams = hasTeamFeature
        ? await Team.list(context, { fk_workspace_id: workspaceId })
        : [];

      // Always fetch org teams if workspace belongs to an org
      const workspace = await Workspace.get(workspaceId);
      const wsOrgId = workspace?.fk_org_id;

      if (wsOrgId) {
        // Use a context with org_id (not workspace_id) for the org teams query
        // to avoid cache key collision — Team.list cache key uses context.workspace_id ?? context.org_id
        const orgContext = {
          ...context,
          workspace_id: undefined,
          org_id: wsOrgId,
        } as NcContext;
        const orgTeams = await Team.list(orgContext, {
          fk_org_id: wsOrgId,
        });
        teams = [...wsTeams, ...orgTeams];
      } else {
        // No org — if team feature is blocked, return empty
        if (!hasTeamFeature) {
          return { list: [] };
        }
        teams = wsTeams;
      }
    }

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
        fk_org_id: team.fk_org_id || undefined,
        fk_workspace_id: team.fk_workspace_id || undefined,
        scope: (team.fk_org_id && !team.fk_workspace_id
          ? 'org'
          : 'workspace') as 'org' | 'workspace',
        scim_managed: team.scim_managed ?? false,
      };
    });

    return { list: teamsV3 };
  }

  async teamGet(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
      teamId: string;
    },
  ): Promise<TeamDetailV3Type> {
    await this.validateFeatureAccess(context);

    const team = await Team.get(context, param.teamId);

    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Verify team belongs to the workspace/org
    const belongsToScope =
      param.scope === 'org'
        ? team.fk_org_id === param.workspaceOrOrgId
        : team.fk_workspace_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // check if the current user have access to this team
    const currentUserId = context.user?.id;
    if (currentUserId) {
      const isOrgTeam = param.scope === 'org';

      if (isOrgTeam) {
        // Org teams: org admins can view any team, otherwise must be a member
        if (
          !(await this.isUserOrgAdmin(param.workspaceOrOrgId, currentUserId))
        ) {
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
      } else {
        // Workspace teams: workspace owner or team member
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
      scope?: 'workspace' | 'org';
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

    const scope =
      param.scope || (await this.resolveScope(param.workspaceOrOrgId)).scope;
    const workspaceId =
      scope === 'workspace' ? param.workspaceOrOrgId : undefined;
    const orgId = scope === 'org' ? param.workspaceOrOrgId : undefined;

    // Org teams: only org admin can create
    if (scope === 'org') {
      const userId = param.req.user?.id;
      if (!userId || !(await this.isUserOrgAdmin(orgId, userId))) {
        NcError.get(context).forbidden(
          'Only org admins can create org-level teams',
        );
      }
    }

    // Fetch workspace for limit check and payment reseat (null for org teams)
    const workspace = workspaceId ? await Workspace.get(workspaceId) : null;

    if (scope === 'workspace') {
      if (!workspace) {
        NcError.get(context).workspaceNotFound(workspaceId);
      }

      // On-prem: block workspace team creation for users who aren't actual workspace members
      // (super admins are treated as workspace owners by ACL but aren't real members —
      // team creation auto-assigns creator as team owner, which requires real membership)
      if (isOnPrem) {
        const userId = param.req.user?.id;
        if (userId) {
          const wsUser = await WorkspaceUser.get(workspaceId, userId);
          if (
            !wsUser ||
            [
              WorkspaceUserRoles.NO_ACCESS,
              WorkspaceUserRoles.COMMENTER,
              WorkspaceUserRoles.VIEWER,
            ].includes(wsUser.roles as WorkspaceUserRoles)
          ) {
            NcError.get(context).forbidden(
              'You must be a workspace member with editor or higher role to create teams',
            );
          }
        }
      }

      await checkLimit({
        workspace,
        delta: 1,
        type: PlanLimitTypes.LIMIT_TEAM_MANAGEMENT,
        message: ({ limit }) =>
          `You have reached the limit of ${limit} teams for your plan.`,
      });
    }

    // Check for duplicate team name among siblings (same parent + same scope)
    const existingTeams = await Team.list(
      context,
      scope === 'org' ? { fk_org_id: orgId } : { fk_workspace_id: workspaceId },
    );

    const parentId = param.team.parent_team_id || null;
    const duplicateTeam = existingTeams.find(
      (team) =>
        (team.fk_parent_team_id || null) === parentId &&
        team.title?.trim().toLowerCase() === param.team.title?.trim().toLowerCase(),
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

      // Verify parent belongs to the same scope
      const parentBelongsToScope =
        scope === 'org'
          ? parentTeam.fk_org_id === orgId
          : parentTeam.fk_workspace_id === workspaceId;

      if (!parentBelongsToScope) {
        NcError.get(context).invalidRequestBody(
          `Parent team must belong to the same ${scope}`,
        );
      }

      // Only managers of the parent team can create sub-teams (unless user is workspace owner / org admin)
      const userId = param.req.user?.id;
      if (userId) {
        const isOwnerOrAdmin =
          scope === 'org'
            ? await this.isUserOrgAdmin(orgId, userId)
            : await this.isUserWorkspaceOwner(
                context,
                userId,
                param.workspaceOrOrgId,
              );

        if (!isOwnerOrAdmin) {
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
      ...(scope === 'org'
        ? { fk_org_id: orgId }
        : { fk_workspace_id: workspaceId }),
      fk_parent_team_id: param.team.parent_team_id || null,
      depth,
      path,
      created_by: param.req.user.id,
    };

    const team = await Team.insert(context, teamData);

    // Add members if provided
    if (param.team.members && param.team.members.length > 0) {
      for (const member of param.team.members) {
        if (!member.user_id || !member.team_role) {
          NcError.get(context).invalidRequestBody(
            'Each member must have user_id and team_role',
          );
        }
        if (
          !Object.values(TeamUserRoles).includes(
            member.team_role as TeamUserRoles,
          )
        ) {
          NcError.get(context).invalidRequestBody(
            `Invalid team_role "${member.team_role}". Allowed: ${Object.values(
              TeamUserRoles,
            ).join(', ')}`,
          );
        }
      }

      // Batch-validate all users exist
      const memberUserIds = param.team.members.map((m) => m.user_id);
      const usersMap = await User.getByIds(memberUserIds);
      for (const member of param.team.members) {
        if (!usersMap.has(member.user_id)) {
          NcError.get(context).userNotFound(member.user_id);
        }
      }

      // Validate membership: org teams require org membership, workspace teams require workspace membership
      if (orgId) {
        for (const member of param.team.members) {
          const orgUser = await OrgUser.get(orgId, member.user_id);
          if (!orgUser) {
            NcError.get(context).badRequest(
              `User ${member.user_id} is not a member of this organization`,
            );
          }
        }
      } else if (workspaceId) {
        for (const member of param.team.members) {
          const wsUser = await WorkspaceUser.get(workspaceId, member.user_id);
          if (!wsUser) {
            NcError.get(context).badRequest(
              `User ${member.user_id} is not a member of this workspace`,
            );
          }
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
    const postCreateAssignments = await PrincipalAssignment.listByResourceIds(
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
      fk_org_id: team.fk_org_id || undefined,
      fk_workspace_id: team.fk_workspace_id || undefined,
      scope: (team.fk_org_id && !team.fk_workspace_id ? 'org' : 'workspace') as
        | 'org'
        | 'workspace',
      scim_managed: team.scim_managed || false,
    };

    // Emit team create event
    this.appHooksService.emit(AppEvents.TEAM_CREATE, {
      context,
      req: param.req,
      team: team,
      workspace,
    });

    // Recalculate seat count after team creation (workspace teams only)
    if (workspace?.id) {
      await this.paymentService.reseatSubscription(workspace.id);
    }

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: response.id,
        action: 'teamCreate',
        payload: response as TeamV3ResponseType,
      },
    });

    return response;
  }

  async teamUpdate(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
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

    // Check if team exists and belongs to workspace/org
    const oldTeam = await Team.get(context, param.teamId);
    if (!oldTeam) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope =
      oldTeam.fk_workspace_id === param.workspaceOrOrgId ||
      oldTeam.fk_org_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Fetch workspace for payment reseat (null for org teams)
    const workspace = oldTeam.fk_workspace_id
      ? await Workspace.get(oldTeam.fk_workspace_id)
      : null;

    // Check if user is team manager (org teams: any org admin can manage)
    const userId = param.req.user?.id;
    if (userId) {
      const isOrgTeam = !!oldTeam.fk_org_id && !oldTeam.fk_workspace_id;

      if (isOrgTeam) {
        // Org teams: only org admins can update
        if (!(await this.isUserOrgAdmin(oldTeam.fk_org_id, userId))) {
          NcError.get(context).forbidden(
            'Only org admins can update org-level teams',
          );
        }
      } else {
        // Workspace teams: only team managers or workspace owners
        const isWsOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isWsOwner) {
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
      }
    }

    const updateData: any = {};
    if (param.team.title !== undefined) {
      // Verify title uniqueness among siblings (same parent + same scope)
      if (param.team.title !== oldTeam.title) {
        const allTeams = await Team.list(context, {
          ...(oldTeam.fk_org_id
            ? { fk_org_id: oldTeam.fk_org_id }
            : { fk_workspace_id: oldTeam.fk_workspace_id }),
        });
        const parentId = oldTeam.fk_parent_team_id || null;
        const duplicate = allTeams.find(
          (t) =>
            t.id !== oldTeam.id &&
            (t.fk_parent_team_id || null) === parentId &&
            t.title?.toLowerCase() === param.team.title.toLowerCase(),
        );
        if (duplicate) {
          NcError.get(context).invalidRequestBody(
            `A team with the name "${param.team.title}" already exists`,
          );
        }
      }
      updateData.title = param.team.title;
    }
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

    if (!updatedTeam) {
      NcError.get(context).teamNotFound(param.teamId);
    }

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

    // Recalculate seat count after team update (workspace teams only)
    if (workspace?.id) {
      await this.paymentService.reseatSubscription(workspace.id);
    }

    await this.broadcastTeamEvent(context, oldTeam, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: response.id,
        action: 'teamUpdate',
        payload: response as TeamV3ResponseType,
      },
    });

    return response;
  }

  async teamDelete(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
      teamId: string;
      force?: boolean;
      req: NcRequest;
    },
  ) {
    await this.validateFeatureAccess(context);

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope =
      team.fk_workspace_id === param.workspaceOrOrgId ||
      team.fk_org_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    // Fetch workspace for payment reseat (null for org teams)
    const workspace = team.fk_workspace_id
      ? await Workspace.get(team.fk_workspace_id)
      : null;

    // Check if user is team manager or org admin
    const userId = param.req.user?.id;
    if (userId) {
      const isOrgTeam = !!team.fk_org_id && !team.fk_workspace_id;

      if (isOrgTeam) {
        // Org teams: only org admins can delete
        if (!(await this.isUserOrgAdmin(team.fk_org_id, userId))) {
          NcError.get(context).forbidden(
            'Only org admins can delete org-level teams',
          );
        }
      } else {
        // Workspace teams: workspace owners or team managers can delete
        const isWsOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isWsOwner) {
          const assignment = await PrincipalAssignment.get(
            context,
            ResourceType.TEAM,
            param.teamId,
            PrincipalType.USER,
            userId,
          );
          if (!assignment || assignment.roles !== TeamUserRoles.OWNER) {
            NcError.get(context).forbidden('Only team managers can delete teams');
          }
        }
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
      PrincipalAssignment.listByResource(
        context,
        ResourceType.TEAM,
        param.teamId,
      ),
      PrincipalAssignment.listByPrincipal(
        context,
        PrincipalType.TEAM,
        param.teamId,
      ),
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
    if (workspace?.id) {
      await this.paymentService.reseatSubscription(workspace.id);
    } else if (team.fk_org_id) {
      await this.paymentService.reseatSubscription(team.fk_org_id);
    }

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: team.id,
        action: 'teamDelete',
      },
    });

    return { msg: 'Team has been deleted successfully' };
  }

  async teamMembersAdd(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
      teamId: string;
      members: TeamMembersAddV3ReqType[];
      req: NcRequest;
    },
  ): Promise<TeamMemberV3ResponseType[]> {
    await this.validateFeatureAccess(context);

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope =
      team.fk_workspace_id === param.workspaceOrOrgId ||
      team.fk_org_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const workspace = team.fk_workspace_id
      ? await Workspace.get(team.fk_workspace_id)
      : null;

    // Check if user is team manager or org admin
    const userId = param.req.user?.id;
    if (userId) {
      const isOrgTeam = !!team.fk_org_id && !team.fk_workspace_id;

      if (isOrgTeam) {
        if (!(await this.isUserOrgAdmin(team.fk_org_id, userId))) {
          NcError.get(context).forbidden(
            'Only org admins can manage org-level team members',
          );
        }
      } else {
        const isWsOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isWsOwner) {
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
      }
    }

    if (!Array.isArray(param.members)) {
      NcError.get(context).invalidRequestBody(
        'Request body must be an array of {user_id, team_role} objects',
      );
    }

    for (const member of param.members) {
      if (!member.user_id || !member.team_role) {
        NcError.get(context).invalidRequestBody(
          'Each member must have user_id and team_role',
        );
      }
      if (
        !Object.values(TeamUserRoles).includes(
          member.team_role as TeamUserRoles,
        )
      ) {
        NcError.get(context).invalidRequestBody(
          `Invalid team_role "${member.team_role}". Allowed: ${Object.values(
            TeamUserRoles,
          ).join(', ')}`,
        );
      }
    }

    // validate: all users exist
    const memberUserIds = param.members.map((m) => m.user_id);
    const usersMap = await User.getByIds(memberUserIds);
    for (const member of param.members) {
      if (!usersMap.has(member.user_id)) {
        NcError.get(context).userNotFound(member.user_id);
      }
    }

    // For org teams: validate all users are active org members
    if (param.scope === 'org' && team.fk_org_id) {
      for (const member of param.members) {
        const orgUser = await OrgUser.get(team.fk_org_id, member.user_id);
        if (!orgUser) {
          NcError.get(context).badRequest(
            `User ${member.user_id} is not a member of this organization`,
          );
        }
      }
    }

    // For workspace teams: validate all users are workspace members
    if (team.fk_workspace_id) {
      for (const member of param.members) {
        const wsUser = await WorkspaceUser.get(
          team.fk_workspace_id,
          member.user_id,
        );
        if (!wsUser) {
          NcError.get(context).badRequest(
            `User ${member.user_id} is not a member of this workspace`,
          );
        }
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

    // Check seat headroom before adding team members
    await checkGlobalSeatHeadroom(param.members.length);

    // Insert assignments and emit events (inserts are sequential due to individual event/mail needs)
    const addedMembers = [];

    for (const member of param.members) {
      const user = usersMap.get(member.user_id)!;

      const assignment = await PrincipalAssignment.insert(context, {
        resource_type: ResourceType.TEAM,
        resource_id: param.teamId,
        principal_type: PrincipalType.USER,
        principal_ref_id: member.user_id,
        roles: member.team_role,
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
    if (team.fk_workspace_id) {
      await this.paymentService.reseatSubscription(team.fk_workspace_id);
    } else if (team.fk_org_id) {
      await this.paymentService.reseatSubscription(team.fk_org_id);
    }

    // Transform to v3 response format — reuse already-loaded users
    const members = addedMembers.map((assignment) => {
      const user = usersMap.get(assignment.principal_ref_id)!;
      return {
        user_id: user.id,
        user_email: user.email,
        team_role: assignment.roles as TeamUserRoles,
      };
    });

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: team.id,
        action: 'teamMembersAdd',
        payload: members as TeamMemberV3ResponseType[],
      },
    });

    return members;
  }

  async teamMembersRemove(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
      teamId: string;
      members: TeamMembersRemoveV3ReqType[];
      req: NcRequest;
    },
  ) {
    await this.validateFeatureAccess(context);

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope =
      team.fk_workspace_id === param.workspaceOrOrgId ||
      team.fk_org_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const workspace = team.fk_workspace_id
      ? await Workspace.get(team.fk_workspace_id)
      : null;

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

    // Hoist permission check outside the loop
    const isOrgTeam = !!team.fk_org_id && !team.fk_workspace_id;
    const isOrgAdmin =
      isOrgTeam && userId
        ? await this.isUserOrgAdmin(team.fk_org_id, userId)
        : false;
    const isTeamManager =
      !isOrgTeam && userId
        ? assignmentsByUserId.get(userId)?.roles === TeamUserRoles.OWNER
        : false;
    const canManage = isOrgAdmin || isTeamManager;

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
      if (!canManage && !isSelfRemoval) {
        NcError.get(context).forbidden(
          'Only team managers or org admins can remove members',
        );
      }

      // Workspace teams: prevent removing the last manager
      // Org teams: no team-owner concept, skip this check
      if (!isOrgTeam && assignment!.roles === TeamUserRoles.OWNER) {
        if (managersCount === 1) {
          NcError.get(context).invalidRequestBody(
            'Cannot remove the last member',
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
    if (team.fk_workspace_id) {
      await this.paymentService.reseatSubscription(team.fk_workspace_id);
    } else if (team.fk_org_id) {
      await this.paymentService.reseatSubscription(team.fk_org_id);
    }

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: team.id,
        action: 'teamMembersRemove',
        payload: removedMembers as TeamMembersRemoveV3ReqType[],
      },
    });

    return removedMembers;
  }

  async teamMembersUpdate(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
      teamId: string;
      members: TeamMembersUpdateV3ReqType[];
      req: NcRequest;
    },
  ): Promise<TeamMemberV3ResponseType[]> {
    await this.validateFeatureAccess(context);

    // Check if team exists and belongs to workspace/org
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const belongsToScope =
      team.fk_workspace_id === param.workspaceOrOrgId ||
      team.fk_org_id === param.workspaceOrOrgId;

    if (!belongsToScope) {
      NcError.get(context).teamNotFound(param.teamId);
    }

    const workspace = team.fk_workspace_id
      ? await Workspace.get(team.fk_workspace_id)
      : null;

    // Check if user is team manager or org admin
    const userId = param.req.user?.id;
    if (userId) {
      const isOrgTeam = !!team.fk_org_id && !team.fk_workspace_id;

      if (isOrgTeam) {
        if (!(await this.isUserOrgAdmin(team.fk_org_id, userId))) {
          NcError.get(context).forbidden(
            'Only org admins can update org-level team member roles',
          );
        }
      } else {
        const isWsOwner = await this.isUserWorkspaceOwner(
          context,
          userId,
          param.workspaceOrOrgId,
        );

        if (!isWsOwner) {
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
      }
    }

    if (!Array.isArray(param.members)) {
      NcError.get(context).invalidRequestBody(
        'Request body must be an array of {user_id, team_role} objects',
      );
    }

    for (const member of param.members) {
      if (
        member.team_role &&
        !Object.values(TeamUserRoles).includes(
          member.team_role as TeamUserRoles,
        )
      ) {
        NcError.get(context).invalidRequestBody(
          `Invalid team_role "${member.team_role}". Allowed: ${Object.values(
            TeamUserRoles,
          ).join(', ')}`,
        );
      }
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

    // Guard: prevent demoting all owners — team must retain at least one owner
    const currentOwnerIds = new Set(
      currentAssignments
        .filter((a) => a.roles === TeamUserRoles.OWNER)
        .map((a) => a.principal_ref_id),
    );
    // Simulate the batch: apply demotions from the request
    const demotingOwnerIds = new Set(
      param.members
        .filter(
          (m) =>
            m.team_role === TeamUserRoles.MEMBER &&
            currentOwnerIds.has(m.user_id),
        )
        .map((m) => m.user_id),
    );
    const promotingToOwnerIds = new Set(
      param.members
        .filter(
          (m) =>
            m.team_role === TeamUserRoles.OWNER &&
            !currentOwnerIds.has(m.user_id),
        )
        .map((m) => m.user_id),
    );
    const remainingOwners =
      currentOwnerIds.size -
      demotingOwnerIds.size +
      promotingToOwnerIds.size;
    if (remainingOwners < 1) {
      NcError.get(context).invalidRequestBody(
        'Cannot demote all team owners — at least one owner must remain',
      );
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
    if (team.fk_workspace_id) {
      await this.paymentService.reseatSubscription(team.fk_workspace_id);
    } else if (team.fk_org_id) {
      await this.paymentService.reseatSubscription(team.fk_org_id);
    }

    // Transform to v3 response format — reuse already-loaded users
    const members = updatedMembers.map((assignment) => {
      const user = usersMap.get(assignment.principal_ref_id)!;
      return {
        user_id: user.id,
        user_email: user.email,
        team_role: assignment.roles as TeamUserRoles,
      };
    });

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: team.id,
        action: 'teamMembersUpdate',
        payload: members as TeamMemberV3ResponseType[],
      },
    });

    return members;
  }

  // ── Hierarchy endpoints ─────────────────────────────────────────

  async teamTree(
    context: NcContext,
    param: {
      workspaceOrOrgId: string;
      scope?: 'workspace' | 'org';
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
      scope?: 'workspace' | 'org';
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

    // Fetch workspace (null for org-scoped moves)
    const workspace =
      param.scope === 'org'
        ? null
        : await Workspace.get(param.workspaceOrOrgId);
    if (param.scope !== 'org' && !workspace) {
      NcError.get(context).workspaceNotFound(param.workspaceOrOrgId);
    }

    // Check if team exists and belongs to the scope
    const team = await Team.get(context, param.teamId);
    if (!team) {
      NcError.get(context).teamNotFound(param.teamId);
    }
    const teamBelongsToScope =
      team.fk_workspace_id === param.workspaceOrOrgId ||
      team.fk_org_id === param.workspaceOrOrgId;
    if (!teamBelongsToScope) {
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
      const parentBelongsToScope =
        newParent.fk_workspace_id === param.workspaceOrOrgId ||
        newParent.fk_org_id === param.workspaceOrOrgId;
      if (!parentBelongsToScope) {
        NcError.get(context).invalidRequestBody(
          'Parent team must belong to the same scope',
        );
      }

      // Only managers of the new parent team can move teams under it
      // (unless user is workspace owner or org admin)
      if (userId) {
        const isOwnerOrAdmin =
          param.scope === 'org'
            ? await this.isUserOrgAdmin(param.workspaceOrOrgId, userId)
            : await this.isUserWorkspaceOwner(
                context,
                userId,
                param.workspaceOrOrgId,
              );

        if (!isOwnerOrAdmin) {
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

    await this.broadcastTeamEvent(context, team, {
      event: EventType.TEAM_EVENT,
      payload: {
        id: response.id,
        action: 'teamMove',
        payload: response,
      },
    });

    return response;
  }
}
