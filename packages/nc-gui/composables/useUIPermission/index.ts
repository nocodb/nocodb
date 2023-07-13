import { isString } from '@vue/shared'
import { createSharedComposable, rolePermissions, useGlobal, useRoles } from '#imports'
import type { Permission, ProjectRole, Role } from '~/lib'

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
  const { allRoles } = useRoles()

  const isUIAllowed = (
    permission: Permission | string,
    skipPreviewAs = false,
    userRoles?: string | Record<string, boolean> | string[],
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

    return Object.entries(roles).some(([role, hasRole]) => hasPermission(role as Role | ProjectRole, hasRole, permission))
  }

  return { isUIAllowed }
})
