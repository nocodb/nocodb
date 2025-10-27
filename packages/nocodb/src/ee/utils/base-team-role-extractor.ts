import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract base-team roles for a user in a base
 * @param context - NocoDB context
 * @param userId - User ID
 * @param baseId - Base ID
 * @returns Promise<Record<string, boolean> | null> - Base-team roles or null if no base-team roles
 */
// todo: optimize with fewer queries
export async function extractUserBaseTeamRoles(
  context: NcContext,
  userId: string,
  baseId: string,
): Promise<Record<string, boolean> | null> {
  try {
    // Get all team assignments for this base
    const baseTeamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.BASE,
      baseId,
    );

    // Filter assignments where the user is a member of the team
    const userBaseTeamRoles = [];

    for (const assignment of baseTeamAssignments) {
      // Check if this assignment is for a team
      if (assignment.principal_type !== PrincipalType.TEAM) {
        continue;
      }

      // Check if user is a member of this team
      const userTeamAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        assignment.principal_ref_id,
        PrincipalType.USER,
        userId,
      );

      if (userTeamAssignment) {
        // User is a member of this team, add the team's base role
        userBaseTeamRoles.push({
          teamRole: userTeamAssignment.roles, // User's role in the team (member/manager)
          baseRole: assignment.roles, // Team's role in the base (viewer/editor/owner/etc)
        });
      }
    }

    if (userBaseTeamRoles.length === 0) {
      return null;
    }

    // Merge base-team roles - take the highest privilege
    // Define role hierarchy (higher index = higher privilege)
    const roleHierarchy = [
      'no-access',
      'viewer',
      'commenter',
      'editor',
      'creator',
      'owner',
    ];

    let highestRole = null;
    let highestRoleIndex = -1;

    for (const roleInfo of userBaseTeamRoles) {
      const roleIndex = roleHierarchy.indexOf(roleInfo.baseRole);

      // Map team roles to base roles based on team role
      if (roleInfo.teamRole === 'manager') {
        // Manager in team gets higher base role
        if (roleIndex > highestRoleIndex) {
          highestRole = roleInfo.baseRole;
          highestRoleIndex = roleIndex;
        }
        // Also give them editor role if they don't have owner
        if (
          roleInfo.baseRole !== 'owner' &&
          roleHierarchy.indexOf('editor') > highestRoleIndex
        ) {
          highestRole = 'editor';
          highestRoleIndex = roleHierarchy.indexOf('editor');
        }
      } else {
        // Member in team gets the base role as-is
        if (roleIndex > highestRoleIndex) {
          highestRole = roleInfo.baseRole;
          highestRoleIndex = roleIndex;
        }
      }
    }

    if (highestRole) {
      return { [highestRole]: true };
    }

    return null;
  } catch (error) {
    // Return null on error to avoid breaking the role extraction
    return null;
  }
}
