import { isString } from '@vueuse/core'
import type { Permission } from './rolePermissions'
import rolePermissions from './rolePermissions'
import { useGlobal, useInjectionState, useRoles } from '#imports'
import type { ProjectRole, Role } from '~/lib'

const [setup, use] = useInjectionState(() => {
  const { previewAs } = useGlobal()

  const { allRoles } = useRoles()

  const hasPermission = (role: Role | ProjectRole, hasRole: boolean, permission: Permission | string) => {
    const rolePermission = rolePermissions[role]

    return (
      hasRole &&
      rolePermission &&
      ((isString(rolePermission) && rolePermission === '*') || rolePermission[permission as keyof typeof rolePermission])
    )
  }

  const isUIAllowed = (permission: Permission | string, skipPreviewAs = false) => {
    if (previewAs.value && !skipPreviewAs) {
      const hasPreviewPermission = hasPermission(previewAs.value, true, permission)

      if (hasPreviewPermission) return true
    }

    return Object.entries(allRoles.value).some(([role, hasRole]) =>
      hasPermission(role as Role | ProjectRole, hasRole, permission),
    )
  }

  return { isUIAllowed, projectRoles }
}, 'useUIPermission')

export function useUIPermission() {
  let usePermissions = use()

  if (!usePermissions) {
    usePermissions = setup()
  }

  return { isUIAllowed: usePermissions.isUIAllowed }
}
