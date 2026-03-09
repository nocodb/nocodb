import {
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionOptionValue,
  PermissionOptions,
  PermissionRole,
  getPermissionOption,
  getPermissionOptionValue,
} from 'nocodb-sdk'
import type { BaseType } from 'nocodb-sdk'

export interface PermissionSelectorConfig {
  entity: PermissionEntity
  entityId: string
  permission: string
  label: string
  description: string
  minimumRole?: 'viewer' | 'editor' | 'creator'
  /** Pre-resolved effective value for inherited permissions (e.g. from parent doc). */
  effectiveValue?: string
}

export const usePermissionSelector = (
  base: Ref<BaseType | null>,
  config: Ref<PermissionSelectorConfig>,
  currentValue: Ref<string>,
) => {
  const { $api, $e } = useNuxtApp()

  const { isTeamsEnabled } = storeToRefs(useWorkspace())

  const basesStore = useBases()
  const { basesUser, basesTeams } = storeToRefs(basesStore)

  const { permissionsByEntity } = usePermissions()

  // Use centralized permission options from SDK
  const allPermissionOptions = PermissionOptions

  // Filter options based on minimum role requirement
  const permissionOptions = computed(() => {
    const minimumRole = config.value.minimumRole
    if (!minimumRole) return allPermissionOptions

    const roleHierarchy = ['viewer', 'editor', 'creator', 'owner']
    const minRoleIndex = roleHierarchy.indexOf(minimumRole)

    // Check if this is a visibility permission (table or document)
    const isTableVisibility = config.value.permission === PermissionKey.TABLE_VISIBILITY
    const isDocVisibility = config.value.permission === PermissionKey.DOCUMENT_VISIBILITY
    const isVisibilityPermission = isTableVisibility || isDocVisibility

    return allPermissionOptions.filter((option) => {
      // For record/edit permissions, exclude Viewers & up, Commenters & up, and Everyone
      if (!isVisibilityPermission) {
        if (option.value === PermissionOptionValue.VIEWERS_AND_UP) {
          return false
        }
        if (option.value === PermissionOptionValue.COMMENTERS_AND_UP) {
          return false
        }
        if (option.value === PermissionOptionValue.EVERYONE) {
          return false
        }
      }

      // Document visibility: Viewers & up (default), Editors & up, Creators & up, Specific users, Nobody
      // No "Everyone" (redundant — Viewers is the lowest doc role) or "Commenters & up"
      if (isDocVisibility) {
        if (option.value === PermissionOptionValue.EVERYONE) return false
        if (option.value === PermissionOptionValue.COMMENTERS_AND_UP) return false
        return true
      }

      // Table visibility: Everyone (default), Editors & up, Creators & up, Specific users
      if (isTableVisibility) {
        if (option.value === PermissionOptionValue.EVERYONE) return true
        if (option.value === PermissionOptionValue.EDITORS_AND_UP) return true
        if (option.value === PermissionOptionValue.CREATORS_AND_UP) return true
        if (option.value === PermissionOptionValue.SPECIFIC_USERS) return true
        return false
      }

      // Always allow these options for all permission types
      if (option.value === PermissionOptionValue.SPECIFIC_USERS || option.value === PermissionOptionValue.NOBODY) {
        return true
      }

      // Additional role-based filtering
      if (option.value === PermissionOptionValue.VIEWERS_AND_UP && minRoleIndex > 0) {
        return false
      }

      if (option.value === PermissionOptionValue.COMMENTERS_AND_UP && minRoleIndex > 1) {
        return false
      }

      if (option.value === PermissionOptionValue.EDITORS_AND_UP && minRoleIndex > 1) {
        return false
      }

      return true
    })
  })

  const currentPermission = ref(PermissionOptionValue.EDITORS_AND_UP)
  const isInherited = ref(false)
  const selectedUsers = ref<PermissionSelectorUser[]>([])
  const isLoading = ref(false)

  // User selector modal
  const showUserSelector = ref(false)
  const userSelectorSelectedUsers = ref<Set<string>>(new Set())

  // Get current permission option for display
  const currentOption = computed(() => {
    return getPermissionOption(currentPermission.value)
  })

  // Convert display value to internal value
  const getInternalValue = (displayValue: string): PermissionOptionValue => {
    switch (displayValue) {
      case 'Viewers and up':
        return PermissionOptionValue.VIEWERS_AND_UP
      case 'Commenters & up':
        return PermissionOptionValue.COMMENTERS_AND_UP
      case 'Editors & up':
        return PermissionOptionValue.EDITORS_AND_UP
      case 'Creators & up':
        return PermissionOptionValue.CREATORS_AND_UP
      case 'Specific users':
        return PermissionOptionValue.SPECIFIC_USERS
      case 'Everyone':
        return PermissionOptionValue.EVERYONE
      case 'Nobody':
        return PermissionOptionValue.NOBODY
      default:
        return PermissionOptionValue.EDITORS_AND_UP
    }
  }

  // Handle opening user selector
  const openUserSelector = () => {
    userSelectorSelectedUsers.value = new Set(selectedUsers.value.map((user) => user.id))
    showUserSelector.value = true
  }

  // Save permission state
  const saveState = async () => {
    if (!base.value?.fk_workspace_id || !base.value?.id) return

    isLoading.value = true
    try {
      let granted_type
      let granted_role
      let subjects

      if (currentPermission.value === PermissionOptionValue.VIEWERS_AND_UP) {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.VIEWER
      } else if (currentPermission.value === PermissionOptionValue.COMMENTERS_AND_UP) {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.COMMENTER
      } else if (currentPermission.value === PermissionOptionValue.CREATORS_AND_UP) {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.CREATOR
      } else if (currentPermission.value === PermissionOptionValue.SPECIFIC_USERS) {
        granted_type = PermissionGrantedType.USER
        subjects = selectedUsers.value.map((user) => ({
          type: user.type ?? 'user',
          id: user.id,
          ...(user.type === 'team' && user.hierarchy_scope ? { hierarchy_scope: user.hierarchy_scope } : {}),
        }))
      } else if (currentPermission.value === PermissionOptionValue.NOBODY) {
        granted_type = PermissionGrantedType.NOBODY
      } else {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.EDITOR
      }

      // Drop permission row when user selects the default value (reverts to inherited/default behavior)
      // Table visibility default: EVERYONE
      // Doc visibility default: VIEWERS_AND_UP
      // Doc edit / other defaults: EDITORS_AND_UP
      const isTableVisibilityPerm = config.value.permission === PermissionKey.TABLE_VISIBILITY
      const isDocVisibilityPerm = config.value.permission === PermissionKey.DOCUMENT_VISIBILITY

      const shouldDrop =
        (currentPermission.value === PermissionOptionValue.EVERYONE && isTableVisibilityPerm) ||
        (currentPermission.value === PermissionOptionValue.VIEWERS_AND_UP && isDocVisibilityPerm) ||
        (currentPermission.value === PermissionOptionValue.EDITORS_AND_UP && !isTableVisibilityPerm && !isDocVisibilityPerm)

      if (shouldDrop) {
        // If permission entity is not found, do nothing
        if (!permissionsByEntity.value[`${config.value.entity}_${config.value.entityId}`]) {
          return
        }

        await $api.internal.postOperation(
          base.value.fk_workspace_id,
          base.value.id,
          {
            operation: 'dropPermission',
          },
          {
            entity: config.value.entity,
            entity_id: config.value.entityId,
            permission: config.value.permission,
          },
        )
      } else {
        await $api.internal.postOperation(
          base.value.fk_workspace_id,
          base.value.id,
          {
            operation: 'setPermission',
          },
          {
            entity: config.value.entity,
            entity_id: config.value.entityId,
            permission: config.value.permission,
            granted_type,
            granted_role,
            subjects,
          },
        )
      }

      const eventTypeMap: Record<string, string> = {
        [PermissionEntity.TABLE]: 'a:permissions:save',
        [PermissionEntity.FIELD]: 'a:field:permissions',
        [PermissionEntity.DOCUMENT]: 'a:doc:permissions',
      }
      const eventType = eventTypeMap[config.value.entity] || 'a:permissions:save'
      $e(eventType)
    } catch (e: any) {
      message.error(`Failed to save ${config.value.entity.toLowerCase()} permissions`)
    } finally {
      isLoading.value = false
    }
  }

  // Handle user selector save
  const handleUserSelectorSave = (data: { selectedUsers: PermissionSelectorUser[] }) => {
    currentPermission.value = PermissionOptionValue.SPECIFIC_USERS
    selectedUsers.value = data.selectedUsers
    saveState()
  }

  // Handle permission change
  const onPermissionChange = (value: string, inline = false) => {
    if (value === currentPermission.value) return

    if (value === PermissionOptionValue.SPECIFIC_USERS && inline) {
      openUserSelector()
    } else {
      currentPermission.value = value as PermissionOptionValue
      saveState()
    }
  }

  // Initialize permission state from base permissions
  const initializePermissionState = async () => {
    if (!base.value?.permissions) {
      currentPermission.value = getInternalValue(currentValue.value)
      return
    }

    const permission = base.value.permissions?.find(
      (perm) =>
        perm.entity === config.value.entity &&
        perm.entity_id === config.value.entityId &&
        perm.permission === config.value.permission,
    )

    if (permission) {
      isInherited.value = false
      currentPermission.value = getPermissionOptionValue(
        permission.granted_type as PermissionGrantedType,
        permission.granted_role as PermissionRole,
      )

      if (permission.granted_type === PermissionGrantedType.USER) {
        // Map basesUser data to PermissionSelectorUser format
        const baseUsers = basesUser.value.get(base.value.id!) || []

        // Map baseTeams data to PermissionSelectorUser format
        const baseTeams = isTeamsEnabled.value ? basesTeams.value.get(base.value.id!) || [] : []

        selectedUsers.value = baseUsers
          .filter((user) => permission.subjects?.some((subject) => subject.type === 'user' && subject.id === user.id))
          .map((user) => ({
            id: user.id,
            email: user.email ?? user.display_name,
            display_name: user.display_name,
            type: 'user',
          }))
          .concat(
            baseTeams
              .filter((team) => permission.subjects?.some((subject) => subject.type === 'team' && subject.id === team.team_id))
              .map((team) => {
                const subject = permission.subjects?.find((s) => s.type === 'team' && s.id === team.team_id)
                return {
                  id: team.team_id,
                  email: team.team_title,
                  display_name: team.team_title,
                  type: 'team' as const,
                  hierarchy_scope: subject?.hierarchy_scope,
                }
              }),
          )

        userSelectorSelectedUsers.value = new Set(permission.subjects?.map((subject) => subject.id) || [])
      }
    } else {
      // No explicit permission — use effective value if provided (inherited from parent),
      // otherwise fall back to the default for this permission type.
      if (config.value.effectiveValue) {
        isInherited.value = true
        currentPermission.value = config.value.effectiveValue as PermissionOptionValue
      } else if (config.value.permission === PermissionKey.TABLE_VISIBILITY) {
        isInherited.value = false
        currentPermission.value = PermissionOptionValue.EVERYONE
      } else if (config.value.permission === PermissionKey.DOCUMENT_VISIBILITY) {
        isInherited.value = false
        currentPermission.value = PermissionOptionValue.VIEWERS_AND_UP
      } else if (config.value.permission === PermissionKey.DOCUMENT_EDIT) {
        isInherited.value = false
        currentPermission.value = PermissionOptionValue.EDITORS_AND_UP
      } else {
        isInherited.value = false
        currentPermission.value = getInternalValue(currentValue.value)
      }
    }
  }

  // Watch for changes
  watch(
    [() => base.value, () => currentValue.value, () => base.value?.permissions],
    () => {
      initializePermissionState()
    },
    { immediate: true },
  )

  return {
    // State
    currentPermission: readonly(currentPermission),
    isInherited: readonly(isInherited),
    selectedUsers: readonly(selectedUsers),
    isLoading: readonly(isLoading),
    showUserSelector,
    userSelectorSelectedUsers,
    currentOption,
    permissionOptions,

    // Methods
    onPermissionChange,
    handleUserSelectorSave,
    initializePermissionState,
  }
}
