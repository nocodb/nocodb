import {
  type BaseType,
  PermissionGrantedType,
  PermissionOptionValue,
  PermissionOptions,
  PermissionRoleMap,
  PermissionRolePower,
  ProjectRoles,
  RoleColors,
  ViewTypes,
  getPermissionIcon,
  getPermissionLabel,
  getPermissionOption,
  getPermissionOptionValue,
} from 'nocodb-sdk'

// Re-export the interface from SDK for backward compatibility
export type { PermissionOption } from 'nocodb-sdk'

export const usePermissions = () => {
  const { user } = useGlobal()

  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const { sharedView } = storeToRefs(useViewsStore())

  const { blockTableAndFieldPermissions } = useEeConfig()

  // Use centralized permission options from SDK
  const permissionOptions = PermissionOptions

  // Permission list for the current base
  const permissionList = computed(() => {
    if (sharedView.value?.type === ViewTypes.FORM) {
      return (sharedView.value?.basePermissions as BaseType['permissions']) ?? []
    }

    return base.value?.permissions ?? []
  })

  // Permissions data grouped by entity
  const permissionsByEntity = computed(() => {
    const grouped: Record<string, any[]> = {}

    permissionList.value.forEach((permission) => {
      const key = `${permission.entity}_${permission.entity_id}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(permission)
    })

    return grouped
  })

  const getPermission = (entity: string, entityId: string, permissionType: string) => {
    const permissions = permissionsByEntity.value[`${entity}_${entityId}`] || []
    return permissions.find((p) => p.permission === permissionType)
  }

  // Get permission summary for an entity (returns internal value)
  const getPermissionSummary = (entity: string, entityId: string, permissionType: string) => {
    const permission = getPermission(entity, entityId, permissionType)

    if (!permission) {
      return PermissionOptionValue.EDITORS_AND_UP
    }

    return getPermissionOptionValue(permission.granted_type, permission.granted_role)
  }

  // Get permission summary with display label
  const getPermissionSummaryLabel = (entity: string, entityId: string, permissionType: string) => {
    const internalValue = getPermissionSummary(entity, entityId, permissionType)
    return getPermissionLabel(internalValue)
  }

  const isAllowed = (
    entity: string,
    entityId: string,
    permissionType: string,
    options?: {
      userRole?: string
      isFormView?: boolean
    },
  ) => {
    // If table and field permissions feature is not enabled, then we allow all permissions
    if (blockTableAndFieldPermissions.value) {
      return true
    }

    /**
     * If it is form view, then we need to treat user as editor
     */
    let currentUserRole = options?.isFormView ? PermissionRoleMap[ProjectRoles.EDITOR] : options?.userRole

    if (!currentUserRole) {
      if (typeof user.value?.base_roles === 'string') {
        currentUserRole = user.value?.base_roles
      } else {
        const roles = Object.keys(user.value?.base_roles ?? {})
        if (roles.length) {
          currentUserRole = PermissionRoleMap[roles[0] as keyof typeof PermissionRoleMap]
        } else {
          currentUserRole = PermissionRoleMap[ProjectRoles.VIEWER]
        }
      }
    }

    const permissionObj = getPermission(entity, entityId, permissionType)

    if (!permissionObj) {
      return true
    }

    if (permissionObj.granted_type === PermissionGrantedType.USER) {
      // In shared form user is anonymous, but in form builder user role is present so we have to treat it as shared form
      if (options?.isFormView) return false

      // Check if user exists in subjects array
      return (
        permissionObj.subjects?.some(
          (subject: { type: string; id: string; hierarchy_scope?: 'self_only' | 'self_and_descendants' }) => {
            if (subject.type === 'user') {
              return subject.id === user.value?.id
            }

            if (subject.type === 'team') {
              const userTeams: { team_id: string; path?: string; user_team_id?: string }[] = (user.value as any)?.teams ?? []

              return userTeams.some((t) => {
                if (t.team_id === subject.id) {
                  // user_team_id is the user's actual direct team.
                  // t.team_id can equal subject.id via upward cascade even when the user
                  // is only an ancestor (parent) of the subject team — not a direct member.
                  // So we must verify the user was directly added to this team.
                  // Descendant members are handled by the path segment check below.
                  return t.user_team_id === subject.id
                }

                // For self_and_descendants: check if user is in a descendant team of the subject
                // A team is a descendant if its path contains the subject team id as an ancestor segment
                if (subject.hierarchy_scope !== 'self_only' && t.path) {
                  const pathSegments = t.path.split('/').filter(Boolean)
                  return pathSegments.includes(subject.id)
                }

                return false
              })
            }

            return false
          },
        ) || false
      )
    }

    if (permissionObj.granted_type === PermissionGrantedType.ROLE) {
      const rolePower = PermissionRolePower[currentUserRole as keyof typeof PermissionRolePower]

      return rolePower >= PermissionRolePower[permissionObj.granted_role as keyof typeof PermissionRolePower]
    }

    return false
  }

  const getPermissionColor = (value: string): string => {
    switch (value) {
      case PermissionOptionValue.CREATORS_AND_UP:
        return RoleColors[ProjectRoles.CREATOR] // 'blue'
      case PermissionOptionValue.EDITORS_AND_UP:
        return RoleColors[ProjectRoles.EDITOR] // 'green'
      case PermissionOptionValue.VIEWERS_AND_UP:
        return RoleColors[ProjectRoles.VIEWER] // 'yellow'
      case PermissionOptionValue.NOBODY:
        return RoleColors[ProjectRoles.NO_ACCESS] // 'red'
      case PermissionOptionValue.SPECIFIC_USERS:
      default:
        return 'gray'
    }
  }

  const getPermissionTextColor = (value: string): string => {
    return getTableAndFieldPermissionsColors(getPermissionColor(value))
  }

  return {
    permissionOptions,
    permissionList,
    permissionsByEntity,
    getPermissionOption,
    getPermissionLabel,
    getPermissionIcon,
    getPermissionColor,
    getPermissionTextColor,
    getPermissionSummary,
    getPermissionSummaryLabel,
    isAllowed,
  }
}
