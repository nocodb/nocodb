import {
  PermissionEntity,
  PermissionGrantedType,
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
}

export const usePermissionSelector = (
  base: Ref<BaseType | null>,
  config: Ref<PermissionSelectorConfig>,
  currentValue: Ref<string>,
) => {
  const { $api, $e } = useNuxtApp()
  const basesStore = useBases()
  const { basesUser } = storeToRefs(basesStore)

  const { permissionsByEntity } = usePermissions()

  // Use centralized permission options from SDK
  const allPermissionOptions = PermissionOptions

  // Filter options based on minimum role requirement
  const permissionOptions = computed(() => {
    const minimumRole = config.value.minimumRole
    if (!minimumRole) return allPermissionOptions

    const roleHierarchy = ['viewer', 'editor', 'creator', 'owner']
    const minRoleIndex = roleHierarchy.indexOf(minimumRole)

    return allPermissionOptions.filter((option) => {
      if (option.value === PermissionOptionValue.SPECIFIC_USERS || option.value === PermissionOptionValue.NOBODY) {
        return true // Always allow these options
      }

      if (option.value === PermissionOptionValue.VIEWERS_AND_UP && minRoleIndex > 0) {
        return false // Don't show viewers if minimum is editor or higher
      }

      if (option.value === PermissionOptionValue.EDITORS_AND_UP && minRoleIndex > 1) {
        return false // Don't show editors if minimum is creator or higher
      }

      return true
    })
  })

  const currentPermission = ref(PermissionOptionValue.EDITORS_AND_UP)
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
      case 'Editors & up':
        return PermissionOptionValue.EDITORS_AND_UP
      case 'Creators & up':
        return PermissionOptionValue.CREATORS_AND_UP
      case 'Specific users':
        return PermissionOptionValue.SPECIFIC_USERS
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
      } else if (currentPermission.value === PermissionOptionValue.CREATORS_AND_UP) {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.CREATOR
      } else if (currentPermission.value === PermissionOptionValue.SPECIFIC_USERS) {
        granted_type = PermissionGrantedType.USER
        subjects = selectedUsers.value.map((user) => ({
          type: 'user',
          id: user.id,
        }))
      } else if (currentPermission.value === PermissionOptionValue.NOBODY) {
        granted_type = PermissionGrantedType.NOBODY
      } else {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.EDITOR
      }

      if (currentPermission.value === PermissionOptionValue.EDITORS_AND_UP) {
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

      const eventType = config.value.entity === PermissionEntity.TABLE ? 'a:permissions:save' : 'a:field:permissions'
      $e(eventType)
      await basesStore.loadProject(base.value.id, true)
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
      currentPermission.value = getPermissionOptionValue(
        permission.granted_type as PermissionGrantedType,
        permission.granted_role as PermissionRole,
      )

      if (permission.granted_type === PermissionGrantedType.USER) {
        // Map basesUser data to PermissionSelectorUser format
        const baseUsers = basesUser.value.get(base.value.id!) || []
        selectedUsers.value = baseUsers
          .filter((user) => permission.subjects?.some((subject) => subject.type === 'user' && subject.id === user.id))
          .map((user) => ({
            id: user.id,
            email: user.email,
            display_name: user.display_name,
          }))

        userSelectorSelectedUsers.value = new Set(permission.subjects?.map((subject) => subject.id) || [])
      }
    } else {
      currentPermission.value = getInternalValue(currentValue.value)
    }
  }

  // Watch for changes
  watch(
    [() => base.value, () => currentValue.value],
    () => {
      initializePermissionState()
    },
    { immediate: true },
  )

  return {
    // State
    currentPermission: readonly(currentPermission),
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
