import { isString } from '@vueuse/core'
import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { createSharedComposable, useGlobal, useRoles } from '#imports'
import type { ProjectRole, Role } from '~/lib'

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

  const isUIAllowed = (permission: Permission | string, skipPreviewAs = false) => {
    if (previewAs.value && !skipPreviewAs) {
      const hasPreviewPermission = hasPermission(previewAs.value, true, permission)

      if (hasPreviewPermission) return true
    }

    return Object.entries(allRoles.value).some(([role, hasRole]) =>
      hasPermission(role as Role | ProjectRole, hasRole, permission),
    )
  }

  return { isUIAllowed }
})
