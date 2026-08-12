import { type EvaluablePermission, PermissionGrantedType, evaluatePermission, matchesTeamSubjectByPaths } from 'nocodb-sdk'

/**
 * Frontend decision for a table/field permission check.
 *
 * Pure and global-free (all context is passed in) so it is unit-testable and
 * cannot silently drift from the backend — the actual grant decision is
 * delegated to the SDK's shared `evaluatePermission`; this wrapper adds only
 * the frontend-specific anonymous-form hard block and resolves the team match
 * from the user's cached team paths.
 *
 * @param permissionObj resolved permission (null/undefined ⇒ allowed)
 * @param ctx.userId current user id (for `user` subject matching)
 * @param ctx.permissionRole current role, already mapped via `PermissionRoleMap`
 * @param ctx.directTeams user's direct team memberships with `path` (ancestry)
 * @param ctx.isAnonymousFormSubmit true only in a public shared-form context,
 *   where the submitter is anonymous so a specific-user grant can never match
 */
export function evaluateTableFieldPermission(
  permissionObj: EvaluablePermission | null | undefined,
  ctx: {
    userId?: string
    permissionRole?: string
    directTeams?: { team_id: string; path: string }[]
    isAnonymousFormSubmit?: boolean
  },
): boolean {
  if (!permissionObj) return true

  // Anonymous shared-form submitters have no identity to match a USER grant against.
  if (permissionObj.granted_type === PermissionGrantedType.USER && ctx.isAnonymousFormSubmit) {
    return false
  }

  const directTeams = ctx.directTeams ?? []
  const matchedTeamSubject = (permissionObj.subjects ?? []).some(
    (subject) => subject.type === 'team' && matchesTeamSubjectByPaths(subject, directTeams),
  )

  return evaluatePermission(permissionObj, {
    userId: ctx.userId,
    permissionRole: ctx.permissionRole,
    matchedTeamSubject,
  })
}
