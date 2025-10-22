import type { NcContext } from '~/interface/config';
import { Principal } from '~/models';
import { PrincipalAssignment } from '~/models';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Extract team roles for a user in a workspace
 * @param context - NocoDB context
 * @param userId - User ID
 * @param workspaceId - Workspace ID
 * @returns Promise<Record<string, boolean> | null> - Team roles or null if no team roles
 */
export async function extractUserTeamRoles(
  context: NcContext,
  userId: string,
  workspaceId: string,
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

    // Get all team assignments for this workspace
    const workspaceTeamAssignments = await PrincipalAssignment.listByResource(
      context,
      ResourceType.WORKSPACE,
      workspaceId,
    );

    // Filter assignments where the user is a member of the team
    const userTeamRoles = [];

    for (const assignment of workspaceTeamAssignments) {
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
        // User is a member of this team, add the team's workspace role
        userTeamRoles.push({
          teamRole: userTeamAssignment.roles, // User's role in the team (member/manager)
          workspaceRole: assignment.roles, // Team's role in the workspace (member/manager)
        });
      }
    }

    if (userTeamRoles.length === 0) {
      return null;
    }

    // Merge team roles - take the highest privilege
    // Manager role in workspace takes precedence over member role
    const hasManagerRole = userTeamRoles.some(
      (role) => role.workspaceRole === 'manager',
    );

    const hasMemberRole = userTeamRoles.some(
      (role) => role.workspaceRole === 'member',
    );

    const roles: Record<string, boolean> = {};

    if (hasManagerRole) {
      roles['manager'] = true;
    } else if (hasMemberRole) {
      roles['member'] = true;
    }

    return Object.keys(roles).length > 0 ? roles : null;
  } catch (error) {
    // Return null on error to avoid breaking the role extraction
    return null;
  }
}
