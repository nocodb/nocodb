<script lang="ts" setup>
import { type BaseType, PermissionGrantedType, PermissionRole } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  config: PermissionConfig
}>()

const emits = defineEmits(['save'])

const { $api, $e } = useNuxtApp()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const permissionOptions = [
  {
    value: 'editors_and_up',
    label: 'Editors and up',
    description: 'Collaborators with Editor, Creator, or Owner permissions (default setting)',
  },
  { value: 'creators_and_up', label: 'Creators and up', description: 'Collaborators with Creator or Owner permissions' },
  {
    value: 'specific_users',
    label: 'Specific users',
    description: 'A specific list of collaborators with Editor, Creator, or Owner permissions',
  },
  { value: 'nobody', label: 'Nobody', description: 'No collaborators' },
]

const currentPermission = ref('editors_and_up')
const selectedUsers = ref<PermissionSelectorUser[]>([])
const isLoading = ref(false)

// User selector modal
const showUserSelector = ref(false)
const userSelectorSelectedUsers = ref<Set<string>>(new Set())

const selectedUserNames = computed(() => {
  return selectedUsers.value.map((user) => user.display_name || user.email).join(', ')
})

// Handle opening user selector
const openUserSelector = () => {
  userSelectorSelectedUsers.value = new Set(selectedUsers.value.map((user) => user.id))
  showUserSelector.value = true
}

const saveState = async () => {
  if (!props.base.fk_workspace_id || !props.base.id) return

  isLoading.value = true
  try {
    let granted_type
    let granted_role
    let subjects

    if (currentPermission.value === 'creators_and_up') {
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
        props.base.fk_workspace_id,
        props.base.id,
        {
          operation: 'dropPermission',
        },
        {
          entity: props.config.entity,
          entity_id: props.config.entityId,
          permission: props.config.permission,
        },
      )
    } else {
      await $api.internal.postOperation(
        props.base.fk_workspace_id,
        props.base.id,
        {
          operation: 'setPermission',
        },
        {
          entity: props.config.entity,
          entity_id: props.config.entityId,
          permission: props.config.permission,
          granted_type,
          granted_role,
          subjects,
        },
      )
    }

    emits('save')
    $e('a:permissions:save')

    await basesStore.loadProject(props.base.id, true)
  } catch (e: any) {
    message.error('Failed to save permissions')
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

const onPermissionChange = (value: string) => {
  if (value === 'specific_users') {
    openUserSelector()
  } else {
    currentPermission.value = value
    saveState()
  }
}

// Initialize permission state from props
const initializePermissionState = async () => {
  if (!props.base.permissions) {
    return
  }

  const permission = props.base.permissions?.find(
    (perm) =>
      perm.entity === props.config.entity &&
      perm.entity_id === props.config.entityId &&
      perm.permission === props.config.permission,
  )

  if (permission) {
    if (permission.granted_type === PermissionGrantedType.USER) {
      currentPermission.value = 'specific_users'
      // Map basesUser data to PermissionSelectorUser format
      const baseUsers = basesUser.value.get(props.base.id!) || []
      selectedUsers.value = baseUsers
        .filter((user) => permission.subjects?.some((subject) => subject.type === 'user' && subject.id === user.id))
        .map((user) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
        }))
    } else if (permission.granted_type === PermissionGrantedType.ROLE) {
      currentPermission.value = 'creators_and_up'
    } else if (permission.granted_type === PermissionGrantedType.NOBODY) {
      currentPermission.value = 'nobody'
    } else {
      currentPermission.value = 'editors_and_up'
    }
  } else {
    currentPermission.value = 'editors_and_up'
  }
}

watch(
  () => props.base,
  () => {
    initializePermissionState()
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">
        {{ config.label }}
      </label>
      <NcSelect
        :value="currentPermission"
        class="w-48"
        :options="permissionOptions"
        :loading="isLoading"
        @change="onPermissionChange"
      />
    </div>

    <div v-if="currentPermission === 'specific_users'">
      <div>
        Only <span class="font-bold">{{ selectedUserNames }}</span> {{ config.description || 'have this permission' }}
      </div>
      <div class="flex items-center gap-2">
        <NcButton type="secondary" size="small" @click="openUserSelector">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="edit" class="w-4 h-4" />
            <span>Change selected users</span>
          </div>
        </NcButton>
      </div>
    </div>

    <PermissionsUserSelector
      v-if="base.id"
      v-model:visible="showUserSelector"
      :selected-users="userSelectorSelectedUsers"
      :base-id="base.id"
      :permission-label="config.label"
      :permission-description="config.description"
      @save="handleUserSelectorSave"
    />
  </div>
</template>
