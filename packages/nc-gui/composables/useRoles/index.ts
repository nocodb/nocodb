import { isString } from '@vue/shared'
import { type Roles, type RolesObj, SourceRestriction, type SourceType, type WorkspaceUserRoles } from 'nocodb-sdk'
import { extractRolesObj } from 'nocodb-sdk'

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
      } as User
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
      } as User
    } else if (baseId) {
      const res = await api.auth.me({ base_id: baseId })

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        display_name: res.display_name,
      } as User
    } else {
      const res = await api.auth.me({})

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        display_name: res.display_name,
      } as User
    }
  }

  const isUIAllowed = (
    permission: Permission | string,
    args: {
      roles?: string | Record<string, boolean> | string[] | null
      source?: SourceType & { meta?: Record<string, any> }
    } = {},
  ) => {
    const { roles } = args

    let checkRoles: Record<string, boolean> = {}

    if (!roles) {
      if (allRoles.value) checkRoles = allRoles.value
    } else {
      checkRoles = extractRolesObj(roles)
    }

    // check source level restrictions
    if (
      sourceRestrictions[SourceRestriction.DATA_READONLY][permission] ||
      sourceRestrictions[SourceRestriction.META_READONLY][permission]
    ) {
      const source = unref(args.source || null)

      if (!source) {
        console.warn('Source not found', permission, new Error().stack)
        return false
      }

      if (source?.meta?.[SourceRestriction.DATA_READONLY] && sourceRestrictions[SourceRestriction.DATA_READONLY][permission]) {
        return false
      }
      if (source?.meta?.[SourceRestriction.META_READONLY] && sourceRestrictions[SourceRestriction.META_READONLY][permission]) {
        return false
      }
    }

    return Object.entries(checkRoles).some(([role, hasRole]) =>
      hasPermission(role as Exclude<Roles, WorkspaceUserRoles>, hasRole, permission),
    )
  }

  return { allRoles, orgRoles, workspaceRoles, baseRoles, loadRoles, isUIAllowed }
})

export const useRolesWrapper = () => {
  const currentSource = inject(ActiveSourceInj, ref())
  const useRolesRes = useRoles()

  return {
    ...useRolesRes,
    isUIAllowed: (...args: Parameters<ReturnType<typeof useRoles>['isUIAllowed']>) => {
      return useRolesRes.isUIAllowed(args[0], { source: currentSource, ...(args[1] || {}) })
    },
  }
}
