import type { NcContext } from '~/interface/config';
import { Principal } from '~/ee/models/Principal';
import { PrincipalAssignment } from '~/ee/models/PrincipalAssignment';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract base-team roles for a user in a base
 * @param context - NocoDB context
 * @param userId - User ID
 * @param baseId - Base ID
 * @returns Promise<Record<string, boolean> | null> - Base-team roles or null if no base-team roles
 */
export async function extractUserBaseTeamRoles(
  context: NcContext,
  userId: string,
  baseId: string,
): Promise<Record<string, boolean> | null> {
  try {
    // Get user principal
    const userPrincipal = await Principal.getByTypeAndRef(
      context,
      PrincipalType.USER,
      userId,
    );

    if (!userPrincipal) {
      return null;
    }

    // Get all team assignments for this base
    const baseTeamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.BASE,
      baseId,
    );

    // Filter assignments where the user is a member of the team
    const userBaseTeamRoles = [];

    for (const assignment of baseTeamAssignments) {
      // Get the principal (should be a team)
      const teamPrincipal = await Principal.get(
        context,
        assignment.fk_principal_id,
      );
      if (
        !teamPrincipal ||
        teamPrincipal.principal_type !== PrincipalType.TEAM
      ) {
        continue;
      }

      // Check if user is a member of this team
      const userTeamAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        teamPrincipal.ref_id,
        userPrincipal.id,
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
    // For base roles, we need to map team roles to base roles
    // Manager role in team typically maps to higher base roles
    const roles: Record<string, boolean> = {};

    for (const roleInfo of userBaseTeamRoles) {
      // Map team roles to base roles based on team role
      if (roleInfo.teamRole === 'manager') {
        // Manager in team gets higher base role
        roles[roleInfo.baseRole] = true;
        // Also give them editor role if they don't have owner
        if (roleInfo.baseRole !== 'owner') {
          roles['editor'] = true;
        }
      } else {
        // Member in team gets the base role as-is
        roles[roleInfo.baseRole] = true;
      }
    }

    return Object.keys(roles).length > 0 ? roles : null;
  } catch (error) {
    // Return null on error to avoid breaking the role extraction
    return null;
  }
}
