import { ProjectRoles, RoleColors } from 'nocodb-sdk'

export interface PermissionOption {
  value: string
  label: string
  description: string
  icon: string
  isDefault?: boolean
}

export const usePermissions = () => {
  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const permissionOptions: PermissionOption[] = [
    {
      value: 'viewers_and_up',
      label: 'Viewers and up',
      description: 'Members with Viewer, Editor, Creator or Owner role',
      icon: 'role_viewer',
    },
    {
      value: 'editors_and_up',
      label: 'Editors & up',
      description: 'Members with Editor, Creator or Owner role',
      icon: 'role_editor',
      isDefault: true,
    },
    {
      value: 'creators_and_up',
      label: 'Creators & up',
      description: 'Members with Creator or Owner role',
      icon: 'role_creator',
    },
    {
      value: 'specific_users',
      label: 'Specific users',
      description: 'Specific set of members',
      icon: 'ncUsers',
    },
    {
      value: 'nobody',
      label: 'Nobody',
      description: 'No one can add records',
      icon: 'role_no_access',
    },
  ]

  // Permissions data grouped by entity
  const permissionsByEntity = computed(() => {
    const permissions = base.value?.permissions ?? []
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

  // Get permission summary for an entity (returns internal value)
  const getPermissionSummary = (entity: string, entityId: string, permissionType: string) => {
    const permissions = permissionsByEntity.value[`${entity}_${entityId}`] || []
    const permission = permissions.find((p) => p.permission === permissionType)

    if (!permission) {
      return 'editors_and_up'
    }

    if (permission.granted_type === 'role') {
      if (permission.granted_role === 'viewer') {
        return 'viewers_and_up'
      } else if (permission.granted_role === 'creator') {
        return 'creators_and_up'
      } else {
        return 'editors_and_up'
      }
    } else if (permission.granted_type === 'user') {
      return 'specific_users'
    } else if (permission.granted_type === 'nobody') {
      return 'nobody'
    }

    return 'editors_and_up'
  }

  const getPermissionOption = (value: string) => {
    return permissionOptions.find((option) => option.value === value) || permissionOptions[1] // fallback to editors_and_up
  }

  const getPermissionLabel = (value: string) => {
    return getPermissionOption(value)?.label || 'Editors & up'
  }

  // Get permission summary with display label
  const getPermissionSummaryLabel = (entity: string, entityId: string, permissionType: string) => {
    const internalValue = getPermissionSummary(entity, entityId, permissionType)
    return getPermissionLabel(internalValue)
  }

  const getPermissionIcon = (value: string) => {
    return getPermissionOption(value)?.icon || 'role_editor'
  }

  const getPermissionColor = (value: string): string => {
    switch (value) {
      case 'creators_and_up':
        return RoleColors[ProjectRoles.CREATOR] // 'blue'
      case 'editors_and_up':
        return RoleColors[ProjectRoles.EDITOR] // 'green'
      case 'viewers_and_up':
        return RoleColors[ProjectRoles.VIEWER] // 'yellow'
      case 'nobody':
        return RoleColors[ProjectRoles.NO_ACCESS] // 'red'
      case 'specific_users':
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
  }
}
