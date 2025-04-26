import { isString } from '@vue/shared'
import { type Roles, type RolesObj, SourceRestriction, type SourceType, type WorkspaceUserRoles } from 'nocodb-sdk'
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
 * * `allRoles` - all roles a user has (userRoles + baseRoles)
 * * `loadRoles` - a function to load reload user roles for scope
 */
export const useRolesShared = createSharedComposable(() => {
  const { user } = useGlobal()

  const { api } = useApi()

  const router = useRouter()

  const route = router.currentRoute

  const allRoles = computed<RolesObj | null>(() => {
    let orgRoles = user.value?.roles ?? {}

    orgRoles = extractRolesObj(orgRoles)

    let workspaceRoles = user.value?.workspace_roles ?? {}

    workspaceRoles = extractRolesObj(workspaceRoles)

    let baseRoles = user.value?.base_roles ?? {}

    baseRoles = extractRolesObj(baseRoles)
    let cloudOrgRoles = (user.value as any)?.org_roles ?? {}

    cloudOrgRoles = extractRolesObj(cloudOrgRoles)

    return {
      ...workspaceRoles,
      ...baseRoles,
      ...orgRoles,
      ...cloudOrgRoles,
    }
  })

  const orgRoles = computed<RolesObj | null>(() => {
    let orgRoles = user.value?.roles ?? {}

    orgRoles = extractRolesObj(orgRoles)

    return orgRoles
  })

  const baseRoles = computed<RolesObj | null>(() => {
    let baseRoles = user.value?.base_roles ?? {}

    baseRoles = extractRolesObj(baseRoles)

    return baseRoles
  })

  const workspaceRoles = computed<RolesObj | null>(() => {
    let workspaceRoles = user.value?.workspace_roles ?? {}

    workspaceRoles = extractRolesObj(workspaceRoles)

    return workspaceRoles
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
    workspaceId?: string,
  ) {
    try {
      const wsId = {
        workspace_id: workspaceId || route.value.params.typeOrId,
      }
      let updatedUserObj = user.value

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

        updatedUserObj = {
          ...user.value,
          roles: res.roles,
          ...(baseId && { base_roles: res.base_roles }), // Override base_roles only if baseId is provided
          workspace_roles: res.workspace_roles,
          org_roles: res.org_roles,
          featureFlags: res.featureFlags,
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

        updatedUserObj = {
          ...user.value,
          roles: res.roles,
          ...(baseId && { base_roles: res.base_roles }), // Override base_roles only if baseId is provided
          workspace_roles: res.workspace_roles,
          org_roles: res.org_roles,
          featureFlags: res.featureFlags,
          meta: res.meta,
        } as User
      } else if (baseId) {
        const res = await api.auth.me({ base_id: baseId, ...wsId })

        updatedUserObj = {
          ...user.value,
          roles: res.roles,
          base_roles: res.base_roles,
          workspace_roles: res.workspace_roles,
          display_name: res.display_name,
          org_roles: res.org_roles,
          featureFlags: res.featureFlags,
          meta: res.meta,
        } as User
      } else {
        const res = await api.auth.me({ ...wsId } as any)

        updatedUserObj = {
          ...user.value,
          roles: res.roles,
          workspace_roles: res.workspace_roles,
          display_name: res.display_name,
          org_roles: res.org_roles,
          featureFlags: res.featureFlags,
          meta: res.meta,
        } as User
      }

      if (!options?.skipUpdatingUser) {
        user.value = updatedUserObj
      }

      return updatedUserObj
    } catch (e) {
      console.log('User role loading failed', e)
    }
  }

  const isUIAllowed = (
    permission: Permission | string,
    args: {
      roles?: string | Record<string, boolean> | string[] | null
      source?: MaybeRef<SourceType & { meta?: Record<string, any> }>
      skipSourceCheck?: boolean
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
        // todo: temporary log for debugging
        console.warn('Source not found', permission)
        return false
      }

      if (source?.is_data_readonly && sourceRestrictions[SourceRestriction.DATA_READONLY][permission]) {
        return false
      }
      if (source?.is_schema_readonly && sourceRestrictions[SourceRestriction.SCHEMA_READONLY][permission]) {
        return false
      }
    }

    return Object.entries(checkRoles).some(([role, hasRole]) =>
      hasPermission(role as Exclude<Roles, WorkspaceUserRoles>, hasRole, permission),
    )
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
