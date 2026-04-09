import type { SubjectHierarchyScope } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import Team from '~/ee/models/Team';
import Workspace from '~/ee/models/Workspace';
import { PrincipalType, ResourceType } from '~/utils/globals';

/**
 * Get the org ID linked to a workspace. Returns null if workspace has no org.
 * Used to filter out org teams when the workspace isn't linked to their org.
 */
export async function getWorkspaceOrgId(
  workspaceId: string | undefined,
): Promise<string | null> {
  if (!workspaceId) return null;
  const workspace = await Workspace.get(workspaceId, false, undefined, false);
  return workspace?.fk_org_id || null;
}

/**
 * Check if an org team is visible from the given workspace context.
 * A team is visible if:
 *   - It's a workspace team (fk_workspace_id set) — always visible
 *   - It's an org team AND the workspace is linked to the same org
 */
export function isTeamVisibleInWorkspace(
  team: { fk_org_id?: string; fk_workspace_id?: string },
  workspaceOrgId: string | null,
): boolean {
  // Workspace-scoped teams are always visible
  if (team.fk_workspace_id) return true;
  // Org team: visible only if workspace is linked to the same org
  if (team.fk_org_id) return team.fk_org_id === workspaceOrgId;
  return true;
}

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
  // Verify the team is visible from this workspace context
  // (org teams are only visible when workspace is linked to their org)
  const team = await Team.get(context, teamId);
  if (team?.fk_org_id) {
    const wsOrgId = await getWorkspaceOrgId(context.workspace_id);
    if (team.fk_org_id !== wsOrgId) return false;
  }

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
 * Batch-check if a user matches ANY of the given team subjects.
 * Uses batch queries instead of per-subject sequential calls.
 *
 * @param context - NocoDB context
 * @param userId - User ID to check
 * @param userDirectTeamIds - User's direct team IDs (pre-loaded)
 * @param teamSubjects - Array of team subjects to check against
 * @returns Set of matched team subject IDs
 */
export async function matchTeamSubjectsBatch(
  context: NcContext,
  userId: string,
  userDirectTeamIds: string[],
  teamSubjects: { id: string; hierarchy_scope?: SubjectHierarchyScope }[],
): Promise<Set<string>> {
  const matched = new Set<string>();
  if (!teamSubjects.length) return matched;

  // Filter out org teams whose org doesn't match the workspace's org
  const wsOrgId = await getWorkspaceOrgId(context.workspace_id);
  const allSubjectIds = teamSubjects.map((s) => s.id);
  const subjectTeamsMap = await Team.getByIds(context, allSubjectIds);
  const visibleSubjects = teamSubjects.filter((s) => {
    const team = subjectTeamsMap.get(s.id);
    return !team || isTeamVisibleInWorkspace(team, wsOrgId);
  });
  if (!visibleSubjects.length) return matched;

  const userTeamSet = new Set(userDirectTeamIds);

  // Fast path: check direct membership via pre-loaded team IDs
  const needsDbCheck: {
    id: string;
    hierarchy_scope?: SubjectHierarchyScope;
  }[] = [];
  for (const subject of visibleSubjects) {
    if (userTeamSet.has(subject.id)) {
      matched.add(subject.id);
    } else {
      // Not in pre-loaded list — needs DB verification
      needsDbCheck.push(subject);
    }
  }

  if (!needsDbCheck.length) return matched;

  // Build map: team ID → which subject team IDs it belongs to
  // self_only subjects: only the subject team itself
  // self_and_descendants: subject team + all descendants
  const teamToSubjectMap = new Map<string, string[]>();

  // All subjects need their own team ID checked (direct membership via DB)
  for (const subject of needsDbCheck) {
    const existing = teamToSubjectMap.get(subject.id) || [];
    existing.push(subject.id);
    teamToSubjectMap.set(subject.id, existing);
  }

  // Only expand descendants for non-self_only subjects
  const needsDescendantExpansion = needsDbCheck.filter(
    (s) => s.hierarchy_scope !== 'self_only',
  );

  if (needsDescendantExpansion.length > 0) {
    const expandIds = needsDescendantExpansion.map((s) => s.id);
    const teamsMap = await Team.getByIds(context, expandIds);

    const teamsWithPaths = [...teamsMap.values()].filter(
      (t): t is Team & { path: string } =>
        !!t.path && !!(t.fk_workspace_id || t.fk_org_id),
    );

    if (teamsWithPaths.length) {
      const descendantsMap = await Team.getDescendantsForMultiple(
        context,
        teamsWithPaths,
      );
      for (const [subjectId, descendants] of descendantsMap) {
        for (const desc of descendants) {
          const existing = teamToSubjectMap.get(desc.id) || [];
          existing.push(subjectId);
          teamToSubjectMap.set(desc.id, existing);
        }
      }
    }
  }

  // Single query: check user membership across all expanded team IDs
  const allTeamIdsToCheck = [...teamToSubjectMap.keys()];
  const assignments = await PrincipalAssignment.listByResourceIds(
    context,
    ResourceType.TEAM,
    allTeamIdsToCheck,
    { principal_type: PrincipalType.USER },
  );

  // Find which subject teams the user is a member of (directly or via descendant)
  for (const assignment of assignments) {
    if (assignment.principal_ref_id === userId) {
      const subjectIds = teamToSubjectMap.get(assignment.resource_id);
      if (subjectIds) {
        for (const sid of subjectIds) {
          matched.add(sid);
        }
      }
    }
  }

  return matched;
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
    (t): t is Team & { path: string } =>
      !!t.path && !!(t.fk_workspace_id || t.fk_org_id),
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
