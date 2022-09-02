import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { USER_PROJECT_ROLES, useGlobal, useState } from '#imports'

export function useUIPermission() {
  const { user, previewAs } = useGlobal()

  const projectRoles = useState<Record<string, boolean>>(USER_PROJECT_ROLES, () => ({}))

  const baseRoles = computed(() => {
    let userRoles = user.value?.roles || {}

    // if string populate key-value paired object
    if (typeof userRoles === 'string') {
      userRoles = userRoles.split(',').reduce<Record<string, boolean>>((acc, role) => {
        acc[role] = true
        return acc
      }, {})
    }
    // merge user role and project specific user roles
    const roles = {
      ...userRoles,
      ...projectRoles.value,
    }

    return roles
  })

  const isUIAllowed = (permission: Permission | string, skipPreviewAs = false) => {
    let roles = baseRoles.value
    if (previewAs.value && !skipPreviewAs) {
      roles = {
        [previewAs.value]: true,
      }
    }

    return Object.entries<boolean>(roles).some(([role, hasRole]) => {
      const rolePermission = rolePermissions[role as keyof typeof rolePermissions] as '*' | Record<Permission, true>
      return hasRole && (rolePermission === '*' || rolePermission?.[permission as Permission])
    })
  }

  return { isUIAllowed }
}
