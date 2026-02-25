import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Team from '~/ee/models/Team';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract base-team roles for a user in a base.
 *
 * With hierarchy support (upward cascade):
 * If a team is assigned to a base and the user is a member of an
 * ANCESTOR team, the user inherits that base role.
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

    // Load team details for user's teams to get paths
    const userTeams: { id: string; path: string; teamRole: string }[] = [];
    for (const assignment of userTeamAssignments) {
      const team = await Team.get(context, assignment.resource_id);
      if (team?.path) {
        userTeams.push({
          id: team.id,
          path: team.path,
          teamRole: assignment.roles, // User's role within the team (member/owner)
        });
      }
    }

    // Role hierarchy (higher index = higher privilege)
    const roleHierarchy = [
      'no-access',
      'viewer',
      'commenter',
      'editor',
      'creator',
      'owner',
    ];

    let highestRole: string | null = null;
    let highestRoleIndex = -1;

    for (const assignment of teamAssignments) {
      const assignedTeamId = assignment.principal_ref_id;

      // Load the assigned team to get its path
      const assignedTeam = await Team.get(context, assignedTeamId);
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
        const roleIndex = roleHierarchy.indexOf(baseRole);

        // Team managers get at least editor role
        if (
          matchedUserTeam.teamRole === 'manager' ||
          matchedUserTeam.teamRole === 'owner'
        ) {
          if (roleIndex > highestRoleIndex) {
            highestRole = baseRole;
            highestRoleIndex = roleIndex;
          }
          // Also give them editor role if they don't have owner
          if (
            baseRole !== 'owner' &&
            roleHierarchy.indexOf('editor') > highestRoleIndex
          ) {
            highestRole = 'editor';
            highestRoleIndex = roleHierarchy.indexOf('editor');
          }
        } else {
          // Regular member gets the base role as-is
          if (roleIndex > highestRoleIndex) {
            highestRole = baseRole;
            highestRoleIndex = roleIndex;
          }
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
