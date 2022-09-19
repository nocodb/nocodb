import { isString } from '@vueuse/core'
import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { USER_PROJECT_ROLES, computed, useGlobal, useState } from '#imports'
import type { ProjectRole, Role, Roles } from '~/lib'

export function useUIPermission() {
  const { user, previewAs } = useGlobal()

  const projectRoles = useState<Roles>(USER_PROJECT_ROLES, () => ({}))

  const baseRoles = computed<Roles>(() => {
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
  })

  const isUIAllowed = (permission: Permission | string, skipPreviewAs = false) => {
    let roles = baseRoles.value

    if (previewAs.value && !skipPreviewAs) {
      roles = {
        [previewAs.value]: true,
      }
    }

    return Object.entries(roles).some(([role, hasRole]) => {
      const rolePermission = rolePermissions[role as Role | ProjectRole]

      return (
        hasRole &&
        rolePermission &&
        ((isString(rolePermission) && rolePermission === '*') || rolePermission[permission as keyof typeof rolePermission])
      )
    })
  }

  return { isUIAllowed }
}
