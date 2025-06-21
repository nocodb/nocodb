<script lang="ts" setup>
import { type BaseType, PermissionEntity, PermissionGrantedType, PermissionKey, PermissionRole } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  tableId: string
  base: BaseType & {
    permissions: {
      entity: PermissionEntity
      entity_id: string
      permission: PermissionKey
      granted_type: PermissionGrantedType
      granted_role?: PermissionRole
      user_ids?: string[]
    }[]
  }
}>()

const emits = defineEmits(['update:visible'])

const visible = useVModel(props, 'visible', emits)

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

const createPermission = ref('editors_and_up')
const deletePermission = ref('editors_and_up')
const createUsers = ref<{ id: string; email: string; display_name?: string }[]>([])
const deleteUsers = ref<{ id: string; email: string; display_name?: string }[]>([])
const allowFormsCreate = ref(false)
const allowAutomationsCreate = ref(true)

const isLoading = ref(false)

// User selector modal
const showUserSelector = ref(false)
const currentPermissionType = ref<'create' | 'delete'>('create')
const userSelectorSelectedUsers = ref<Set<string>>(new Set())

const createUserNames = computed(() => {
  return createUsers.value.map((user) => user.display_name || user.email).join(', ')
})

const deleteUserNames = computed(() => {
  return deleteUsers.value.map((user) => user.display_name || user.email).join(', ')
})

// Handle opening user selector
const openUserSelector = (type: 'create' | 'delete') => {
  currentPermissionType.value = type
  if (type === 'create') {
    userSelectorSelectedUsers.value = new Set(createUsers.value.map((user) => user.id))
  } else {
    userSelectorSelectedUsers.value = new Set(deleteUsers.value.map((user) => user.id))
  }
  showUserSelector.value = true
}

const saveState = async (type: 'create' | 'delete') => {
  if (!props.base.fk_workspace_id || !props.base.id) return

  isLoading.value = true
  try {
    if (type === 'create') {
      let granted_type
      let granted_role
      let user_ids

      if (createPermission.value === 'creators_and_up') {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.CREATOR
      } else if (createPermission.value === 'specific_users') {
        granted_type = PermissionGrantedType.USER
        user_ids = createUsers.value.map((user) => user.id)
      } else if (createPermission.value === 'nobody') {
        granted_type = PermissionGrantedType.NOBODY
      } else {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.EDITOR
      }

      if (createPermission.value === 'editors_and_up') {
        await $api.internal.postOperation(
          props.base.fk_workspace_id,
          props.base.id,
          {
            operation: 'dropPermission',
          },
          {
            entity: PermissionEntity.TABLE,
            entity_id: props.tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
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
            entity: PermissionEntity.TABLE,
            entity_id: props.tableId,
            permission: PermissionKey.TABLE_RECORD_ADD,
            granted_type,
            granted_role,
            user_ids,
          },
        )
      }
    } else if (type === 'delete') {
      let granted_type
      let granted_role
      let user_ids

      if (deletePermission.value === 'creators_and_up') {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.CREATOR
      } else if (deletePermission.value === 'specific_users') {
        granted_type = PermissionGrantedType.USER
        user_ids = deleteUsers.value.map((user) => user.id)
      } else if (deletePermission.value === 'nobody') {
        granted_type = PermissionGrantedType.NOBODY
      } else {
        granted_type = PermissionGrantedType.ROLE
        granted_role = PermissionRole.EDITOR
      }

      if (deletePermission.value === 'editors_and_up') {
        await $api.internal.postOperation(
          props.base.fk_workspace_id,
          props.base.id,
          {
            operation: 'dropPermission',
          },
          {
            entity: PermissionEntity.TABLE,
            entity_id: props.tableId,
            permission: PermissionKey.TABLE_RECORD_DELETE,
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
            entity: PermissionEntity.TABLE,
            entity_id: props.tableId,
            permission: PermissionKey.TABLE_RECORD_DELETE,
            granted_type,
            granted_role,
            user_ids,
          },
        )
      }
    }

    $e('a:table:permissions')
  } catch (e: any) {
    message.error('Failed to save permissions')
  } finally {
    isLoading.value = false
  }
}

// Handle user selector save
const handleUserSelectorSave = (data: {
  permissionType: 'create' | 'delete'
  selectedUsers: {
    id: string
    email: string
    display_name?: string
  }[]
}) => {
  if (data.permissionType === 'create') {
    createPermission.value = 'specific_users'
    createUsers.value = data.selectedUsers
    saveState('create')
  } else {
    deletePermission.value = 'specific_users'
    deleteUsers.value = data.selectedUsers
    saveState('delete')
  }
}

const onPermissionChange = (type: 'create' | 'delete', value: string) => {
  if (value === 'specific_users') {
    openUserSelector(type)
  } else {
    if (type === 'create') {
      createPermission.value = value
      saveState('create')
    } else {
      deletePermission.value = value
      saveState('delete')
    }
  }
}

watch(
  props.base,
  (newBase) => {
    if (newBase.permissions) {
      const tableCreatePermission = newBase.permissions.find(
        (permission) =>
          permission.entity === PermissionEntity.TABLE &&
          permission.entity_id === props.tableId &&
          permission.permission === PermissionKey.TABLE_RECORD_ADD,
      )

      if (tableCreatePermission) {
        if (tableCreatePermission.granted_type === PermissionGrantedType.USER) {
          createPermission.value = 'specific_users'
          createUsers.value =
            basesUser.value.get(props.base.id!)?.filter((user) => tableCreatePermission.user_ids?.includes(user.id)) || []
        } else if (tableCreatePermission.granted_type === PermissionGrantedType.ROLE) {
          createPermission.value = 'creators_and_up'
        } else if (tableCreatePermission.granted_type === PermissionGrantedType.NOBODY) {
          createPermission.value = 'nobody'
        } else {
          createPermission.value = 'editors_and_up'
        }

        const tableDeletePermission = newBase.permissions.find(
          (permission) =>
            permission.entity === PermissionEntity.TABLE &&
            permission.entity_id === props.tableId &&
            permission.permission === PermissionKey.TABLE_RECORD_DELETE,
        )

        if (tableDeletePermission) {
          if (tableDeletePermission.granted_type === PermissionGrantedType.USER) {
            deletePermission.value = 'specific_users'
            deleteUsers.value =
              basesUser.value.get(props.base.id!)?.filter((user) => tableDeletePermission.user_ids?.includes(user.id)) || []
          } else if (tableDeletePermission.granted_type === PermissionGrantedType.ROLE) {
            deletePermission.value = 'creators_and_up'
          } else if (tableDeletePermission.granted_type === PermissionGrantedType.NOBODY) {
            deletePermission.value = 'nobody'
          } else {
            deletePermission.value = 'editors_and_up'
          }
        }
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <GeneralModal
    v-model:visible="visible"
    :class="{ active: visible }"
    :mask-closable="!isLoading"
    :keyboard="!isLoading"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-table-permissions"
    :footer="null"
    class="!w-[30rem]"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-6">
        <div class="text-base text-nc-content-gray-emphasis leading-6 font-bold">Table permissions</div>
        <NcButton type="text" size="small" @click="visible = false">
          <GeneralIcon icon="close" class="w-4 h-4" />
        </NcButton>
      </div>

      <div class="text-sm text-nc-content-gray-muted mb-6">Limit who can create and delete records in Locked Table</div>

      <div class="space-y-6">
        <!-- Create Records Permission -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium text-nc-content-gray-emphasis"> Who can create records? </label>
            <NcSelect
              :value="createPermission"
              class="w-48"
              :options="permissionOptions"
              :loading="isLoading"
              @change="onPermissionChange('create', $event)"
            />
          </div>

          <div v-if="createPermission === 'specific_users'">
            <div>
              Only <span class="font-bold">{{ createUserNames }}</span> can create records
            </div>
            <div class="flex items-center gap-2">
              <NcButton type="secondary" size="small" @click="openUserSelector('create')">
                <div class="flex items-center gap-2">
                  <GeneralIcon icon="edit" class="w-4 h-4" />
                  <span>Change selected users</span>
                </div>
              </NcButton>
            </div>
          </div>

          <!-- Additional create options -->
          <div v-if="createPermission !== 'editors_and_up'" class="space-y-2 ml-4">
            <div class="flex items-center gap-2">
              <NcCheckbox v-model:checked="allowFormsCreate" :disabled="isLoading" />
              <span class="text-sm text-nc-content-gray-emphasis"> Allow records to be created through forms </span>
            </div>
            <div class="flex items-center gap-2">
              <NcCheckbox v-model:checked="allowAutomationsCreate" :disabled="isLoading" />
              <span class="text-sm text-nc-content-gray-emphasis"> Allow records to be created by automations </span>
            </div>
          </div>
        </div>

        <!-- Delete Records Permission -->
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-nc-content-gray-emphasis"> Who can delete records? </label>
          <NcSelect
            :value="deletePermission"
            class="w-48"
            :options="permissionOptions"
            :loading="isLoading"
            @change="onPermissionChange('delete', $event)"
          />
        </div>

        <div v-if="deletePermission === 'specific_users'">
          <div>
            Only <span class="font-bold">{{ deleteUserNames }}</span> can delete records
          </div>
          <div class="flex items-center gap-2">
            <NcButton type="secondary" size="small" @click="openUserSelector('delete')">
              <div class="flex items-center gap-2">
                <GeneralIcon icon="edit" class="w-4 h-4" />
                <span>Change selected users</span>
              </div>
            </NcButton>
          </div>
        </div>
      </div>
    </div>
  </GeneralModal>

  <!-- User Selector Modal -->
  <DlgTablePermissionsUserSelector
    v-if="base.id"
    v-model:visible="showUserSelector"
    :selected-users="userSelectorSelectedUsers"
    :base-id="base.id"
    :permission-type="currentPermissionType"
    @save="handleUserSelectorSave"
  />
</template>
