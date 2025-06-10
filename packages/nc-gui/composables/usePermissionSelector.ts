import { PermissionEntity, PermissionGrantedType, PermissionRole } from 'nocodb-sdk'
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

  const { permissionOptions: allPermissionOptions, getPermissionOption } = usePermissions()

  // Filter options based on minimum role requirement
  const permissionOptions = computed(() => {
    const minimumRole = config.value.minimumRole
    if (!minimumRole) return allPermissionOptions

    const roleHierarchy = ['viewer', 'editor', 'creator', 'owner']
    const minRoleIndex = roleHierarchy.indexOf(minimumRole)

    return allPermissionOptions.filter((option) => {
      if (option.value === 'specific_users' || option.value === 'nobody') {
        return true // Always allow these options
      }

      if (option.value === 'viewers_and_up' && minRoleIndex > 0) {
        return false // Don't show viewers if minimum is editor or higher
      }

      if (option.value === 'editors_and_up' && minRoleIndex > 1) {
        return false // Don't show editors if minimum is creator or higher
      }

      return true
    })
  })

  const currentPermission = ref('editors_and_up')
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
  const getInternalValue = (displayValue: string) => {
    switch (displayValue) {
      case 'Viewers and up':
        return 'viewers_and_up'
      case 'Editors & up':
        return 'editors_and_up'
      case 'Creators & up':
        return 'creators_and_up'
      case 'Specific users':
        return 'specific_users'
      case 'Nobody':
        return 'nobody'
      default:
        return 'editors_and_up'
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

      if (currentPermission.value === 'viewers_and_up') {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.VIEWER
      } else if (currentPermission.value === 'creators_and_up') {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.CREATOR
      } else if (currentPermission.value === 'specific_users') {
        granted_type = PermissionGrantedType.USER
        subjects = selectedUsers.value.map((user) => ({
          type: 'user',
          id: user.id,
        }))
      } else if (currentPermission.value === 'nobody') {
        granted_type = PermissionGrantedType.NOBODY
      } else {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.EDITOR
      }

      if (currentPermission.value === 'editors_and_up') {
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
    currentPermission.value = 'specific_users'
    selectedUsers.value = data.selectedUsers
    saveState()
  }

  // Handle permission change
  const onPermissionChange = (value: string) => {
    if (value === 'specific_users') {
      openUserSelector()
    } else {
      currentPermission.value = value
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
      if (permission.granted_type === PermissionGrantedType.USER) {
        currentPermission.value = 'specific_users'
        // Map basesUser data to PermissionSelectorUser format
        const baseUsers = basesUser.value.get(base.value.id!) || []
        selectedUsers.value = baseUsers
          .filter((user) => permission.subjects?.some((subject) => subject.type === 'user' && subject.id === user.id))
          .map((user) => ({
            id: user.id,
            email: user.email,
            display_name: user.display_name,
          }))
      } else if (permission.granted_type === PermissionGrantedType.ROLE) {
        if (permission.granted_role === PermissionRole.VIEWER) {
          currentPermission.value = 'viewers_and_up'
        } else if (permission.granted_role === PermissionRole.CREATOR) {
          currentPermission.value = 'creators_and_up'
        } else {
          currentPermission.value = 'editors_and_up'
        }
      } else if (permission.granted_type === PermissionGrantedType.NOBODY) {
        currentPermission.value = 'nobody'
      } else {
        currentPermission.value = 'editors_and_up'
      }
    } else {
      currentPermission.value = getInternalValue(currentValue.value)
    }
  }

  // Watch for changes
  watch(
    () => [base.value, currentValue.value],
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
