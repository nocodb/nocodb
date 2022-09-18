import { isString } from '@vueuse/core'
import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { USER_PROJECT_ROLES, computed, useGlobal, useState } from '#imports'
import type { Roles } from '~/lib'

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

  const isUIAllowed = (permission: Permission, skipPreviewAs = false) => {
    let roles = baseRoles.value

    if (previewAs.value && !skipPreviewAs) {
      roles = {
        [previewAs.value]: true,
      }
    }

    return Object.entries(roles).some(([role, hasRole]) => {
      const rolePermission = rolePermissions[role as keyof typeof rolePermissions]

      return hasRole && (rolePermission === '*' || rolePermission?.[permission as keyof typeof rolePermission])
    })
  }

  return { isUIAllowed }
}
