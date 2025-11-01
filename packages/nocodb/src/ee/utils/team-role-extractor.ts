import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract workspace roles for a user from teams in a workspace
 * @param context - NocoDB context
 * @param userId - User ID
 * @param workspaceId - Workspace ID
 * @returns Promise<Record<string, boolean> | null> - Workspace roles from teams or null if no team roles
 */
export async function extractUserTeamRoles(
  context: NcContext,
  userId: string,
  workspaceId: string,
): Promise<{
  roles: Record<string, boolean> | null;
  teams: { team_id: string; roles: string }[];
}> {
  const teams: { team_id: string; roles: string }[] = [];

  // todo: optimize with fewer queries
  try {
    // Get all team assignments for this workspace
    const workspaceTeamAssignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.WORKSPACE,
      resource_id: workspaceId,
      principal_type: PrincipalType.TEAM,
    });

    // Collect workspace roles from teams where user is a member
    const workspaceRoles = [];

    for (const assignment of workspaceTeamAssignments) {
      // Check if user is a member of this team
      const userTeamAssignment = await PrincipalAssignment.get(
        context,
        ResourceType.TEAM,
        assignment.principal_ref_id,
        PrincipalType.USER,
        userId,
      );

      if (userTeamAssignment) {
        teams.push({
          team_id: assignment.principal_ref_id,
          roles: assignment.roles,
        });

        // User is a member of this team, add the team's workspace role
        workspaceRoles.push(assignment.roles);
      }
    }

    if (workspaceRoles.length === 0) {
      return { roles: null, teams };
    }

    // Return the workspace roles from teams
    // The role hierarchy logic will be handled in User.ts
    const roles: Record<string, boolean> = {};

    // Convert workspace roles to boolean map
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
