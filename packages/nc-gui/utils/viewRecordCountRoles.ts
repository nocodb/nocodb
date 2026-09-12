import { OrgUserRoles, ProjectRoles, WorkspaceRolesToProjectRoles, extractRolesObj } from 'nocodb-sdk'

export type ViewCountRoleInput = string | string[] | Record<string, boolean | undefined> | null | undefined

/** Resolve only the target base's roles, plus the one instance-wide administrator role. */
export function resolveViewRecordCountRoles(
  directRoles: ViewCountRoleInput,
  targetWorkspaceRoles: ViewCountRoleInput,
  orgRoles: ViewCountRoleInput,
): Record<string, boolean> {
  const roles = Object.fromEntries(
    Object.entries(extractRolesObj(directRoles || {}) ?? {}).filter(
      ([role, enabled]) => enabled === true && role !== ProjectRoles.INHERIT,
    ),
  ) as Record<string, boolean>

  // An explicit viewer/no-access role takes precedence over workspace inheritance.
  if (!Object.keys(roles).length) {
    for (const [role, enabled] of Object.entries(extractRolesObj(targetWorkspaceRoles || {}) ?? {})) {
      const inherited = WorkspaceRolesToProjectRoles[role as keyof typeof WorkspaceRolesToProjectRoles]
      if (enabled === true && inherited && inherited !== ProjectRoles.INHERIT) roles[inherited] = true
    }
  }

  // Backend User.getWithRoles treats SUPER_ADMIN as owner of every base. Its
  // Base.list response intentionally has no per-user project_role to inherit.
  if (extractRolesObj(orgRoles || {})?.[OrgUserRoles.SUPER_ADMIN] === true) roles[OrgUserRoles.SUPER_ADMIN] = true
  return roles
}
