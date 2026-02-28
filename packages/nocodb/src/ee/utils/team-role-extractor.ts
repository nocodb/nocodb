import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Team from '~/ee/models/Team';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract workspace roles for a user from teams in a workspace.
 *
 * With hierarchy support (upward cascade):
 * If a team is assigned to a workspace, any member of that team OR any member
 * of an ANCESTOR team (parent, grandparent, etc.) inherits that role.
 * i.e. roles cascade UPWARD: parent team members see what child teams see.
 * e.g. Frontend (assigned Editor) → Engineering members also get Editor.
 *
 * @param context - NocoDB context
 * @param userId - User ID
 * @param workspaceId - Workspace ID
 * @returns Promise with workspace roles from teams and matched team list
 */
export async function extractUserTeamRoles(
  context: NcContext,
  userId: string,
  workspaceId: string,
): Promise<{
  roles: Record<string, boolean> | null;
  teams: {
    team_id: string;
    roles: string;
    path?: string;
    user_team_id?: string;
  }[];
}> {
  const teams: {
    team_id: string;
    roles: string;
    path?: string;
    user_team_id?: string;
  }[] = [];

  try {
    // Get all team assignments for this workspace
    const workspaceTeamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.WORKSPACE,
      resource_id: workspaceId,
      principal_type: PrincipalType.TEAM,
    });

    if (workspaceTeamAssignments.length === 0) {
      return { roles: null, teams };
    }

    // Get all teams the user is a direct member of (with their paths)
    const userTeamAssignments = await PrincipalAssignment.list(context, {
      principal_type: PrincipalType.USER,
      principal_ref_id: userId,
      resource_type: ResourceType.TEAM,
    });

    if (userTeamAssignments.length === 0) {
      return { roles: null, teams };
    }

    // Load team details for user's teams to get paths
    const userTeams: { id: string; path: string }[] = [];
    for (const assignment of userTeamAssignments) {
      const team = await Team.get(context, assignment.resource_id);
      if (team?.path) {
        userTeams.push({ id: team.id, path: team.path });
      }
    }

    // Collect workspace roles from matching teams
    const workspaceRoles: string[] = [];

    for (const assignment of workspaceTeamAssignments) {
      const assignedTeamId = assignment.principal_ref_id;

      // Load the assigned team to get its path
      const assignedTeam = await Team.get(context, assignedTeamId);
      if (!assignedTeam?.path) continue;

      // Check if user matches via direct membership or ancestor relationship
      let matched = false;
      for (const userTeam of userTeams) {
        // Direct membership
        if (userTeam.id === assignedTeamId) {
          matched = true;
          break;
        }
        // Upward cascade: user's team is an ANCESTOR of the assigned team
        // e.g. Frontend (assigned) → Engineering (user's team) is ancestor
        // An Engineering member inherits Frontend's workspace role.
        if (assignedTeam.path.startsWith(userTeam.path + '/')) {
          matched = true;
          break;
        }
      }

      if (matched) {
        // Find which of the user's teams caused the match
        const matchingUserTeam = userTeams.find((ut) => {
          if (ut.id === assignedTeamId) return true;
          return assignedTeam.path.startsWith(ut.path + '/');
        });

        teams.push({
          team_id: assignedTeamId,
          roles: assignment.roles,
          path: assignedTeam.path,
          // user_team_id is the user's actual direct team that caused this match.
          // Used by frontend self_only scope checks to distinguish direct membership
          // from upward-cascade membership (e.g. Engineering member cascading into Frontend).
          user_team_id: matchingUserTeam?.id,
        });
        workspaceRoles.push(assignment.roles);
      }
    }

    if (workspaceRoles.length === 0) {
      return { roles: null, teams };
    }

    // Convert workspace roles to boolean map
    const roles: Record<string, boolean> = {};
    for (const role of workspaceRoles) {
      if (role) {
        roles[role] = true;
      }
    }

    return Object.keys(roles).length > 0
      ? { roles, teams }
      : { roles: null, teams };
  } catch (error) {
    // Return null on error to avoid breaking the role extraction
    return { roles: null, teams };
  }
}
