import { isString } from '@vue/shared'
import { type Roles, type RolesObj, SourceRestriction, type SourceType } from 'nocodb-sdk'
import { extractRolesObj } from 'nocodb-sdk'
import type { MaybeRef } from 'vue'

const hasPermission = (role: Roles, hasRole: boolean, permission: Permission | string) => {
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
 * * `workspaceRoles` - the roles a user has in the current workspace
 * * `allRoles` - all roles a user has (userRoles + workspaceRoles + baseRoles)
 * * `loadRoles` - a function to load reload user roles for scope
 */
export const useRolesShared = createSharedComposable(() => {
  const { user } = useGlobal()

  const { api } = useApi()

  const allRoles = computed<RolesObj | null>(() => {
    let orgRoles = user.value?.roles ?? {}

    orgRoles = extractRolesObj(orgRoles)

    let wsRoles = user.value?.workspace_roles ?? {}

    wsRoles = extractRolesObj(wsRoles)

    let baseRoles = user.value?.base_roles ?? {}

    baseRoles = extractRolesObj(baseRoles)

    return {
      ...orgRoles,
      ...wsRoles,
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
    const wsRoles = user.value?.workspace_roles
    if (!wsRoles) return null
    return extractRolesObj(wsRoles)
  })

  async function loadRoles(
    baseId?: string,
    options: {
      isSharedBase?: boolean
      sharedBaseId?: string
      isSharedErd?: boolean
      sharedErdId?: string
      skipUpdatingUser?: boolean
    } = {},
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

      if (options.skipUpdatingUser) return res
      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        workspace_roles: (res as any).workspace_roles,
        meta: res.meta,
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

      if (options.skipUpdatingUser) return res
      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        workspace_roles: (res as any).workspace_roles,
        meta: res.meta,
      } as User
    } else if (baseId) {
      const res = await api.auth.me({ base_id: baseId })

      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        workspace_roles: (res as any).workspace_roles,
        display_name: res.display_name,
        meta: res.meta,
      } as User
    } else {
      const res = await api.auth.me({})

      if (options.skipUpdatingUser) return res
      user.value = {
        ...user.value,
        roles: res.roles,
        base_roles: res.base_roles,
        workspace_roles: (res as any).workspace_roles,
        display_name: res.display_name,
        meta: res.meta,
        /**
         * Add `is_new_user` in user object only if it is dashboard
         */
        is_new_user: res.is_new_user,
      } as User
    }
  }

  const isUIAllowed = (
    permission: Permission | string,
    args: {
      roles?: string | Record<string, boolean> | string[] | null
      source?: MaybeRef<SourceType & { meta?: Record<string, any> }>
      skipSourceCheck?: boolean
      base?: MaybeRef<NcProject>
      skipBaseCheck?: boolean
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
      !args.skipSourceCheck &&
      (sourceRestrictions[SourceRestriction.DATA_READONLY][permission] ||
        sourceRestrictions[SourceRestriction.SCHEMA_READONLY][permission])
    ) {
      const source = unref(args.source || null)

      if (!source) {
        console.warn('Source reference not found', permission)
        return false
      }

      if (source?.is_data_readonly && sourceRestrictions[SourceRestriction.DATA_READONLY][permission]) {
        return false
      }
      if (source?.is_schema_readonly && sourceRestrictions[SourceRestriction.SCHEMA_READONLY][permission]) {
        return false
      }
    }

    return Object.entries(checkRoles).some(([role, hasRole]) => hasPermission(role as Roles, hasRole, permission))
  }

  const isBaseRolesLoaded = computed(() => !!user.value?.base_roles || !!user.value?.workspace_roles)

  return { allRoles, orgRoles, workspaceRoles, baseRoles, loadRoles, isUIAllowed, isBaseRolesLoaded }
})

type IsUIAllowedParams = Parameters<ReturnType<typeof useRolesShared>['isUIAllowed']>

/**
 * Wrap the default shared composable to inject the current source if available
 * which will be used to determine if a user has permission to perform an action based on the source's restrictions
 */
export const useRoles = () => {
  const currentSource = inject(ActiveSourceInj, ref())
  const useRolesRes = useRolesShared()

  const isMetaReadOnly = computed(() => {
    return currentSource.value?.is_schema_readonly || false
  })

  const isDataReadOnly = computed(() => {
    return currentSource.value?.is_data_readonly || false
  })

  return {
    ...useRolesRes,
    isUIAllowed: (...args: IsUIAllowedParams) => {
      return useRolesRes.isUIAllowed(args[0], { source: currentSource, ...(args[1] || {}) })
    },
    isDataReadOnly,
    isMetaReadOnly,
  }
}
