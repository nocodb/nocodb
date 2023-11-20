import { isString } from '@vue/shared'
import type { Roles, RolesObj, WorkspaceUserRoles } from 'nocodb-sdk'
import { extractRolesObj } from 'nocodb-sdk'
import { computed, createSharedComposable, rolePermissions, useApi, useGlobal } from '#imports'
import type { Permission } from '#imports'

const hasPermission = (role: Exclude<Roles, WorkspaceUserRoles>, hasRole: boolean, permission: Permission | string) => {
  const rolePermission = rolePermissions[role]

  if (!hasRole || !rolePermission) return false

  if (isString(rolePermission) && rolePermission === '*') return true

  if ('include' in rolePermission && rolePermission.include) {
    return !!rolePermission.include[permission as keyof typeof rolePermission.include]
  }

  return rolePermission[permission as keyof typeof rolePermission]
}

/**
 * Provides the roles a user currently has
 *
 * * `userRoles` - the roles a user has outside of bases
 * * `baseRoles` - the roles a user has in the current base (if one was loaded)
 * * `allRoles` - all roles a user has (userRoles + baseRoles)
 * * `loadRoles` - a function to load reload user roles for scope
 */
export const useRoles = createSharedComposable(() => {
  const { user } = useGlobal()

  const { api } = useApi()

  const allRoles = computed<RolesObj | null>(() => {
    let orgRoles = user.value?.roles ?? {}

    orgRoles = extractRolesObj(orgRoles)

    let baseRoles = user.value?.base_roles ?? {}

    baseRoles = extractRolesObj(baseRoles)

    return {
      ...orgRoles,
      ...baseRoles,
    }
  })

  const orgRoles = computed<RolesObj | null>(() => {
    let orgRoles = user.value?.roles ?? {}

    orgRoles = extractRolesObj(orgRoles)

    return orgRoles
  })

  const baseRoles = computed<RolesObj | null>(() => {
    let baseRoles = user.value?.base_roles ?? {}

    if (Object.keys(baseRoles).length === 0) {
      baseRoles = user.value?.roles ?? {}
    }

    baseRoles = extractRolesObj(baseRoles)

    return baseRoles
  })

  const workspaceRoles = computed<RolesObj | null>(() => {
    return null
  })

  async function loadRoles(
    baseId?: string,
    options: { isSharedBase?: boolean; sharedBaseId?: string; isSharedErd?: boolean; sharedErdId?: string } = {},
  ) {
    if (options?.isSharedBase) {
      const res = await api.auth.me(
        {
          base_id: baseId,
        },
        {
          headers: {
            'xc-shared-base-id': options?.sharedBaseId,
          },
        },
      )

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
      } as typeof User
    } else if (options?.isSharedErd) {
      const res = await api.auth.me(
        {
          base_id: baseId,
        },
        {
          headers: {
            'xc-shared-erd-id': options?.sharedErdId,
          },
        },
      )

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
      } as typeof User
    } else if (baseId) {
      const res = await api.auth.me({ base_id: baseId })

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        display_name: res.display_name,
      } as typeof User
    } else {
      const res = await api.auth.me({})

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        display_name: res.display_name,
      } as typeof User
    }
  }

  const isUIAllowed = (
    permission: Permission | string,
    args: { roles?: string | Record<string, boolean> | string[] | null } = {},
  ) => {
    const { roles } = args

    let checkRoles: Record<string, boolean> = {}

    if (!roles) {
      if (allRoles.value) checkRoles = allRoles.value
    } else {
      checkRoles = extractRolesObj(roles)
    }

    return Object.entries(checkRoles).some(([role, hasRole]) =>
      hasPermission(role as Exclude<Roles, WorkspaceUserRoles>, hasRole, permission),
    )
  }

  return { allRoles, orgRoles, workspaceRoles, baseRoles, loadRoles, isUIAllowed }
})
