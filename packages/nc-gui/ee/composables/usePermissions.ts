import {
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
  PermissionEntity,
  type BaseType,
} from 'nocodb-sdk'

// Re-export the interface from SDK for backward compatibility
export type { PermissionOption } from 'nocodb-sdk'

export const usePermissions = () => {
  const { user } = useGlobal()

  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const { activeView, sharedView } = storeToRefs(useViewsStore())

  const { blockTableAndFieldPermissions } = useEeConfig()

  const { isFeatureEnabled } = useBetaFeatureToggle()

  const isTableAndFieldPermissionsEnabled = computed(() => isFeatureEnabled(FEATURE_FLAG.TABLE_AND_FIELD_PERMISSIONS))

  // Use centralized permission options from SDK
  const permissionOptions = PermissionOptions

  // Permissions data grouped by entity
  const permissionsByEntity = computed(() => {
    const permissions =
      sharedView.value?.type === ViewTypes.FORM
        ? (sharedView.value?.basePermissions as BaseType['permissions']) ?? []
        : base.value?.permissions ?? []
    const grouped: Record<string, any[]> = {}

    permissions.forEach((permission) => {
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
    if (blockTableAndFieldPermissions.value || !isTableAndFieldPermissionsEnabled.value) {
      return true
    }

    const isFormFieldPermission = options?.isFormView && entity === PermissionEntity.FIELD

    /**
     * If it is form view and field edit permission is checked, then we need to treat user as editor
     */
    let currentUserRole = isFormFieldPermission ? PermissionRoleMap[ProjectRoles.EDITOR] : options?.userRole

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
      if (isFormFieldPermission) return false

      // Check if user exists in subjects array
      return (
        permissionObj.subjects?.some(
          (subject: { type: string; id: string }) => subject.type === 'user' && subject.id === user.value?.id,
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
    const color = getPermissionColor(value)
    switch (color) {
      case 'purple':
        return 'text-purple-700'
      case 'blue':
        return 'text-blue-700'
      case 'green':
        return 'text-green-700'
      case 'orange':
        return 'text-orange-700'
      case 'yellow':
        return 'text-yellow-700'
      case 'red':
        return 'text-red-700'
      case 'maroon':
        return 'text-maroon-700'
      case 'gray':
      default:
        return 'text-gray-700'
    }
  }

  return {
    permissionOptions,
    permissionsByEntity,
    getPermissionOption,
    getPermissionLabel,
    getPermissionIcon,
    getPermissionColor,
    getPermissionTextColor,
    getPermissionSummary,
    getPermissionSummaryLabel,
    isAllowed,
    isTableAndFieldPermissionsEnabled,
  }
}
