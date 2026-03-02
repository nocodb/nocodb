import type { SubjectHierarchyScope } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Team from '~/ee/models/Team';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Check if a user is a member of a team, optionally including descendant teams.
 *
 * When hierarchy_scope is 'self_and_descendants' (default):
 *   - Check direct membership in the target team
 *   - Also check membership in any descendant team
 *   e.g. If "Engineering" is the subject and user is in "Frontend" (child), they match.
 *
 * When hierarchy_scope is 'self_only':
 *   - Only check direct membership in the target team
 *
 * @param context - NocoDB context
 * @param userId - User ID to check
 * @param teamId - Target team ID (the subject)
 * @param hierarchyScope - 'self_only' or 'self_and_descendants' (default)
 * @returns true if user matches the team subject
 */
export async function isUserInTeamOrDescendants(
  context: NcContext,
  userId: string,
  teamId: string,
  hierarchyScope?: SubjectHierarchyScope,
): Promise<boolean> {
  // Check direct membership first
  const directAssignment = await PrincipalAssignment.get(
    context,
    ResourceType.TEAM,
    teamId,
    PrincipalType.USER,
    userId,
  );

  if (directAssignment) {
    return true;
  }

  // If self_only, skip descendant check
  if (hierarchyScope === 'self_only') {
    return false;
  }

  // Default: self_and_descendants — check descendant teams
  const descendants = await Team.getDescendants(context, teamId);

  for (const descendant of descendants) {
    const assignment = await PrincipalAssignment.get(
      context,
      ResourceType.TEAM,
      descendant.id,
      PrincipalType.USER,
      userId,
    );

    if (assignment) {
      return true;
    }
  }

  return false;
}

/**
 * Get all team IDs that a team subject expands to (self + descendants).
 * Useful for building team ID lists for RLS placeholders.
 *
 * @param context - NcoDB context
 * @param teamId - Target team ID
 * @param hierarchyScope - 'self_only' or 'self_and_descendants' (default)
 * @returns Array of team IDs
 */
export async function getExpandedTeamIds(
  context: NcContext,
  teamId: string,
  hierarchyScope?: SubjectHierarchyScope,
): Promise<string[]> {
  const ids = [teamId];

  if (hierarchyScope === 'self_only') {
    return ids;
  }

  const descendants = await Team.getDescendants(context, teamId);
  ids.push(...descendants.map((d) => d.id));

  return ids;
}

/**
 * Get all member USER IDs across a set of teams and their descendants.
 *
 * This is used by the `{currentUser.teamWithDescendantMembers}` RLS placeholder
 * to resolve the team hierarchy into actual user IDs — enabling filters like
 * `"Created By" IN {currentUser.teamWithDescendantMembers}`.
 *
 * @param context - NocoDB context
 * @param teamIds - The user's direct team IDs
 * @returns Deduplicated array of user IDs who are members of these teams + descendants
 */
export async function getMemberUserIdsForTeamsAndDescendants(
  context: NcContext,
  teamIds: string[],
): Promise<string[]> {
  const allTeamIds = new Set<string>();

  // Expand each team to include descendants
  for (const teamId of teamIds) {
    const expanded = await getExpandedTeamIds(context, teamId);
    for (const id of expanded) {
      allTeamIds.add(id);
    }
  }

  // Collect member user IDs from all expanded teams
  const userIds = new Set<string>();

  for (const teamId of allTeamIds) {
    const assignments = await PrincipalAssignment.list(context, {
      resource_type: ResourceType.TEAM,
      resource_id: teamId,
      principal_type: PrincipalType.USER,
    });

    for (const assignment of assignments) {
      userIds.add(assignment.principal_ref_id);
    }
  }

  return [...userIds];
}
