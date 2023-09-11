import { isString } from '@vue/shared'
import { extractRolesObj } from 'nocodb-sdk'
import { createSharedComposable, rolePermissions, useGlobal, useRoles } from '#imports'
import type { Permission, ProjectRole, Role } from '#imports'

const hasPermission = (role: Role | ProjectRole, hasRole: boolean, permission: Permission | string) => {
  const rolePermission = rolePermissions[role]

  if (!hasRole || !rolePermission) return false

  if (isString(rolePermission) && rolePermission === '*') return true

  if ('include' in rolePermission && rolePermission.include) {
    return !!rolePermission.include[permission as keyof typeof rolePermission.include]
  }

  if ('exclude' in rolePermission && rolePermission.exclude) {
    return !rolePermission.exclude[permission as keyof typeof rolePermission.exclude]
  }

  return rolePermission[permission as keyof typeof rolePermission]
}

export const useUIPermission = createSharedComposable(() => {
  const { previewAs } = useGlobal()
  const { allRoles, workspaceRoles: currentWorkspaceRoles, projectRoles: currentProjectRoles, orgRoles } = useRoles()

  const isUIAllowed = (
    permission: Permission | string,
    skipPreviewAs = false,
    userRoles: string | Record<string, boolean> | string[] | null = null,
    combineWithStateRoles = false,
    log = false,
  ) => {
    if (previewAs.value && !skipPreviewAs) {
      return hasPermission(previewAs.value, true, permission)
    }

    let roles: Record<string, boolean> = {}

    if (!userRoles) {
      roles = allRoles.value
    } else if (Array.isArray(userRoles) || typeof userRoles === 'string') {
      roles = (Array.isArray(userRoles) ? userRoles : userRoles.split(','))
        // filter out any empty-string/null/undefined values
        .filter(Boolean)
        .reduce<Record<string, boolean>>((acc, role) => {
          acc[role] = true
          return acc
        }, {})
    } else if (typeof userRoles === 'object') {
      roles = userRoles
    }

    if (userRoles && combineWithStateRoles) {
      roles = { ...roles, ...allRoles.value }
    }

    if (log) console.log('permission', roles, rolePermissions)

    return Object.entries(roles).some(([role, hasRole]) => hasPermission(role as Role | ProjectRole, hasRole, permission))
  }

  const isUIAllowedAcl = (
    permission: Permission | string,
    {
      projectRoles,
      maxScope = 'workspace',
      log = false,
    }: {
      projectRoles?: string | Record<string, boolean> | string[] | null
      maxScope?: 'workspace' | 'project'
      log?: boolean
    } = {},
  ) => {
    if (previewAs.value) {
      return hasPermission(previewAs.value, true, permission)
    }

    let roles: Record<string, boolean> = {}

    // Roles is workspace roles or org roles (if not wsRoles undefined ce)
    if (maxScope === 'workspace') {
      if (currentWorkspaceRoles.value && Object.keys(currentWorkspaceRoles.value).length !== 0)
        roles = currentWorkspaceRoles.value
      else roles = orgRoles.value
    }

    // Roles is project roles or workspace roles (if not projRoles undefined)
    if (maxScope === 'project') {
      const _projectRoles = projectRoles ? extractRolesObj(projectRoles) : currentProjectRoles.value

      if (_projectRoles.value && Object.keys(_projectRoles.value).length !== 0) roles = _projectRoles
      else roles = currentWorkspaceRoles.value
    }

    if (log) {
      console.log('isUIAllowedAcl', {
        wsRoles: currentWorkspaceRoles.value,
        orgRoles: orgRoles.value,
        currProjRoles: currentProjectRoles.value,
        projRoles: projectRoles,
        roles,
        permission,
        rolePermissions,
      })
    }

    return Object.entries(roles).some(([role, hasRole]) => hasPermission(role as Role | ProjectRole, hasRole, permission))
  }

  return { isUIAllowed, isUIAllowedAcl }
})
