import { OrderedProjectRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Team from '~/ee/models/Team';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract base-team roles for a user in a base.
 *
 * With hierarchy support (upward cascade):
 * If a team is assigned to a base, any member of that team OR any member
 * of an ANCESTOR team (parent, grandparent, etc.) inherits that base role.
 * i.e. roles cascade UPWARD: parent team members see what child teams see.
 *
 * @param context - NocoDB context
 * @param userId - User ID
 * @param baseId - Base ID
 * @returns Promise with base-team roles and matched team list
 */
export async function extractUserBaseTeamRoles(
  context: NcContext,
  userId: string,
  baseId: string,
): Promise<{
  roles: Record<string, boolean> | null;
  teams: { team_id: string; roles: string }[];
}> {
  const teams: { team_id: string; roles: string }[] = [];

  try {
    // Get all team assignments for this base
    const baseTeamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.BASE,
      baseId,
    );

    // Filter to team principals only
    const teamAssignments = baseTeamAssignments.filter(
      (a) => a.principal_type === PrincipalType.TEAM,
    );

    if (teamAssignments.length === 0) {
      return { roles: null, teams };
    }

    // Get all teams the user is a direct member of (with paths and roles)
    const userTeamAssignments = await PrincipalAssignment.list(context, {
      principal_type: PrincipalType.USER,
      principal_ref_id: userId,
      resource_type: ResourceType.TEAM,
    });

    if (userTeamAssignments.length === 0) {
      return { roles: null, teams };
    }

    // Use workspace-only context for Team lookups (teams are workspace-scoped,
    // avoid cache key mismatch when called from a base-scoped context)
    const teamCtx = {
      workspace_id: context.workspace_id,
      base_id: null,
    } as NcContext;

    // Load team details for user's teams to get paths
    const userTeams: { id: string; path: string; teamRole: string }[] = [];
    for (const assignment of userTeamAssignments) {
      const team = await Team.get(teamCtx, assignment.resource_id);
      if (team?.path) {
        userTeams.push({
          id: team.id,
          path: team.path,
          teamRole: assignment.roles, // User's role within the team (member/owner)
        });
      }
    }

    let highestRole: string | null = null;
    let highestRoleIndex = Infinity;

    for (const assignment of teamAssignments) {
      const assignedTeamId = assignment.principal_ref_id;

      // Load the assigned team to get its path
      const assignedTeam = await Team.get(teamCtx, assignedTeamId);
      if (!assignedTeam?.path) continue;

      // Check if user matches via direct membership or ancestor relationship
      let matchedUserTeam: (typeof userTeams)[0] | null = null;
      for (const userTeam of userTeams) {
        // Direct membership
        if (userTeam.id === assignedTeamId) {
          matchedUserTeam = userTeam;
          break;
        }
        // Upward cascade: user's team is an ANCESTOR of the assigned team
        // e.g. Frontend (assigned) → Engineering (user's team) is ancestor
        // An Engineering member inherits Frontend's base role.
        if (assignedTeam.path.startsWith(userTeam.path + '/')) {
          matchedUserTeam = userTeam;
          break;
        }
      }

      if (matchedUserTeam) {
        teams.push({
          team_id: assignedTeamId,
          roles: assignment.roles,
        });

        const baseRole = assignment.roles;
        const roleIndex = OrderedProjectRoles.indexOf(baseRole as any);

        // Use the team's assigned role (same for all team members)
        if (roleIndex !== -1 && roleIndex < highestRoleIndex) {
          highestRole = baseRole;
          highestRoleIndex = roleIndex;
        }
      }
    }

    if (highestRole) {
      return { roles: { [highestRole]: true }, teams };
    }

    return { roles: null, teams };
  } catch (error) {
    // Return null on error to avoid breaking the role extraction
    return { roles: null, teams: [] };
  }
}
