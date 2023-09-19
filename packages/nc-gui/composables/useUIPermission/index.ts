import { isString } from '@vue/shared'
import type { Roles } from 'nocodb-sdk'
import { extractRolesObj } from 'nocodb-sdk'
import { createSharedComposable, rolePermissions, useGlobal, useRoles } from '#imports'
import type { Permission } from '#imports'

const hasPermission = (role: Roles, hasRole: boolean, permission: Permission | string) => {
  const rolePermission = rolePermissions[role]

  if (!hasRole || !rolePermission) return false

  if (isString(rolePermission) && rolePermission === '*') return true

  if ('include' in rolePermission && rolePermission.include) {
    return !!rolePermission.include[permission as keyof typeof rolePermission.include]
  }

  return rolePermission[permission as keyof typeof rolePermission]
}

export const useUIPermission = createSharedComposable(() => {
  const { previewAs } = useGlobal()
  const { allRoles } = useRoles()

  const isUIAllowed = (
    permission: Permission | string,
    skipPreviewAs = false,
    userRoles: string | Record<string, boolean> | string[] | null = null,
    combineWithStateRoles = false,
  ) => {
    if (previewAs.value && !skipPreviewAs) {
      return hasPermission(previewAs.value, true, permission)
    }

    let roles: Record<string, boolean> = {}

    if (!userRoles) {
      if (allRoles.value) roles = allRoles.value
    } else {
      roles = extractRolesObj(userRoles)
    }

    if (userRoles && combineWithStateRoles) {
      roles = { ...roles, ...allRoles.value }
    }

    return Object.entries(roles).some(([role, hasRole]) => hasPermission(role as Roles, hasRole, permission))
  }

  return { isUIAllowed }
})
