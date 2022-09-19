import { isString } from '@vueuse/core'
import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { USER_PROJECT_ROLES, computed, useGlobal, useState } from '#imports'
import type { ProjectRole, Role, Roles } from '~/lib'

export function useUIPermission() {
  const { user, previewAs } = useGlobal()

  const projectRoles = useState<Roles<ProjectRole>>(USER_PROJECT_ROLES, () => ({}))

  const allRoles = useState<Roles>('allRoles', () =>
    computed(() => {
      let userRoles = user.value?.roles

      // if string populate key-value paired object
      if (isString(userRoles)) {
        userRoles = userRoles.split(',').reduce<Roles>((acc, role) => {
          acc[role] = true
          return acc
        }, {})
      }

      // merge user role and project specific user roles
      return {
        ...userRoles,
        ...projectRoles.value,
      }
    }),
  )

  const hasPermission = (role: Role | ProjectRole, hasRole: boolean, permission: Permission | string) => {
    const rolePermission = rolePermissions[role]

    return (
      hasRole &&
      rolePermission &&
      ((isString(rolePermission) && rolePermission === '*') || rolePermission[permission as keyof typeof rolePermission])
    )
  }

  const isUIAllowed = (permission: Permission | string, skipPreviewAs = false) => {
    let hasPreviewPermission = false
    if (previewAs.value && !skipPreviewAs) {
      hasPreviewPermission = hasPermission(previewAs.value, true, permission)
    }

    return (
      hasPreviewPermission ||
      Object.entries(allRoles.value).some(([role, hasRole]) => hasPermission(role as Role | ProjectRole, hasRole, permission))
    )
  }

  return { isUIAllowed }
}
