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

  if (!descendants.length) return false;

  const descendantIds = descendants.map((d) => d.id);
  const assignments = await PrincipalAssignment.listByResourceIds(
    context,
    ResourceType.TEAM,
    descendantIds,
    { principal_type: PrincipalType.USER },
  );

  return assignments.some((a) => a.principal_ref_id === userId);
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
  if (!teamIds.length) return [];

  // Batch-load all input teams to get their paths
  const teamsMap = await Team.getByIds(context, teamIds);
  const allTeamIds = new Set<string>(teamIds);

  // Batch-expand descendants for all teams in one query
  const teamsWithPaths = [...teamsMap.values()].filter(
    (t): t is Team & { path: string; fk_workspace_id: string } => !!t.path,
  );

  if (teamsWithPaths.length) {
    const descendantsMap = await Team.getDescendantsForMultiple(
      context,
      teamsWithPaths,
    );
    for (const descendants of descendantsMap.values()) {
      for (const desc of descendants) {
        allTeamIds.add(desc.id);
      }
    }
  }

  // Fetch all member assignments in one query
  const assignments = await PrincipalAssignment.listByResourceIds(
    context,
    ResourceType.TEAM,
    [...allTeamIds],
    { principal_type: PrincipalType.USER },
  );

  const userIds = new Set<string>();
  for (const assignment of assignments) {
    userIds.add(assignment.principal_ref_id);
  }

  return [...userIds];
}
