<script lang="ts" setup>
import type { PermissionKey } from 'nocodb-sdk'
import { PermissionMeta, PermissionRoleMap, PermissionRolePower } from 'nocodb-sdk'

const props = defineProps<{
  visible: boolean
  selectedUsers: Set<string>
  baseId: string
  permissionLabel: string
  permissionDescription?: string
  permission?: PermissionKey
}>()

const emits = defineEmits(['update:visible', 'save'])

const visible = useVModel(props, 'visible', emits)

const selectedUsers = useVModel(props, 'selectedUsers', emits)

const { $e } = useNuxtApp()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

// Search functionality
const searchQuery = ref('')
const isLoading = ref(false)

const baseUsers = computed(() => {
  return basesUser.value.get(props.baseId) || []
})

// Filter users based on minimum role requirement from PermissionMeta
const roleFilteredUsers = computed(() => {
  if (!props.permission) return baseUsers.value

  const permissionMeta = PermissionMeta[props.permission]
  if (!permissionMeta) return baseUsers.value

  const minimumRolePower = PermissionRolePower[permissionMeta.minimumRole]
  if (!minimumRolePower) return baseUsers.value

  return baseUsers.value.filter((user) => {
    if (!user.roles) return false

    if (typeof user.roles === 'string') {
      const userRoles = (user.roles as string).split(',').map((r) => r.trim())
      return userRoles.some((role) => {
        const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
        const rolePower = PermissionRolePower[mappedRole]
        return rolePower && rolePower >= minimumRolePower
      })
    }

    return Object.keys(user.roles).some((role) => {
      const mappedRole = PermissionRoleMap[role as keyof typeof PermissionRoleMap]
      const rolePower = PermissionRolePower[mappedRole]
      return rolePower && rolePower >= minimumRolePower
    })
  })
})

// Filtered users based on search
const filteredUsers = computed(() => {
  const users = roleFilteredUsers.value

  if (!searchQuery.value.trim()) return users

  const query = searchQuery.value.toLowerCase()
  return users.filter((user) => {
    return user.email?.toLowerCase().includes(query) || user.display_name?.toLowerCase().includes(query)
  })
})

const isUserSelected = (userId: string) => selectedUsers.value.has(userId)

const toggleUser = (userId: string) => {
  if (selectedUsers.value.has(userId)) {
    selectedUsers.value.delete(userId)
  } else {
    selectedUsers.value.add(userId)
  }
}

const selectAll = () => {
  filteredUsers.value.forEach((user) => {
    selectedUsers.value.add(user.id)
  })
}

const clearAll = () => {
  filteredUsers.value.forEach((user) => {
    selectedUsers.value.delete(user.id)
  })
}

// Handle save
const onSave = async () => {
  isLoading.value = true
  try {
    const selectedUsersList = Array.from(selectedUsers.value)

    const users = selectedUsersList
      .map((userId) => {
        const user = baseUsers.value.find((user) => user.id === userId)
        if (!user) return null
        return {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
        }
      })
      .filter((user) => user !== null) as PermissionSelectorUser[]

    emits('save', {
      selectedUsers: users,
    })

    $e('a:permissions:users:save')
    visible.value = false
  } catch (e: any) {
    message.error('Failed to save user permissions')
  } finally {
    isLoading.value = false
  }
}

// Reset search when modal opens
watch(visible, (isVisible) => {
  if (isVisible) {
    searchQuery.value = ''
  }
})
</script>

<template>
  <GeneralModal
    v-model:visible="visible"
    :class="{ active: visible }"
    :mask-closable="false"
    :keyboard="!isLoading"
    :mask-style="{
      'background-color': 'rgba(0, 0, 0, 0.08)',
    }"
    wrap-class-name="nc-modal-permissions-user-selector"
    :footer="null"
    class="!w-[448px]"
    :closable="false"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-2">
        <div class="text-base font-semibold text-nc-content-gray-emphasis">Selet specific users</div>
      </div>

      <div class="text-sm text-nc-content-gray-muted mb-5">
        Only members selected here <span class="font-weight-700">{{ permissionDescription || 'will have this permission' }}</span>
      </div>

      <div class="text-nc-content-gray-muted mb-2">Select users</div>

      <!-- Search Input -->
      <div class="relative">
        <GeneralIcon
          icon="search"
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-nc-content-gray-muted"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Find a user"
          class="w-full pl-10 pr-4 py-2 border-1 border-b-0 rounded-t-lg border-nc-border-gray-medium focus:!border-nc-border-gray-medium focus:!outline-none text-sm"
        />
      </div>

      <div class="max-h-80 overflow-y-auto mb-6">
        <div
          v-if="filteredUsers.length === 0"
          class="flex flex-col items-center justify-center py-8 text-nc-content-gray-muted border-1 border-nc-border-gray-medium rounded-b-lg"
        >
          <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[164px] flex-none" alt="No users found" />
          No users found
        </div>
        <div v-else>
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="flex h-[54px] items-center gap-3 px-3 hover:bg-nc-bg-gray-light cursor-pointer border-1 border-b-0 border-nc-border-gray-medium last:rounded-b-lg last:border-b-1"
            @click="toggleUser(user.id)"
          >
            <!-- User Avatar and Info -->
            <div v-if="'email' in user" class="flex items-center gap-3 flex-1">
              <GeneralUserIcon :user="user" size="medium" />
              <div class="flex-1">
                <div v-if="user.display_name" class="text-sm font-medium text-nc-content-gray-emphasis">
                  {{ user.display_name }}
                </div>
                <div class="text-xs text-nc-content-gray-muted">
                  {{ user.email }}
                </div>
              </div>
            </div>

            <NcCheckbox :checked="isUserSelected(user.id)" @click.stop="toggleUser(user.id)" />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-nc-border-gray-light">
        <div class="flex gap-4">
          <NcButton type="text" size="small" :disabled="isLoading || filteredUsers.length === 0" @click="selectAll">
            Select all
          </NcButton>
          <NcButton type="text" size="small" :disabled="isLoading || selectedUsers.size === 0" @click="clearAll">
            Clear all
          </NcButton>
        </div>

        <div class="flex gap-2">
          <NcButton type="secondary" size="small" :disabled="isLoading" @click="visible = false"> Cancel </NcButton>
          <NcButton
            type="primary"
            size="small"
            :loading="isLoading"
            :disabled="isLoading || selectedUsers.size === 0"
            @click="onSave"
          >
            Save
          </NcButton>
        </div>
      </div>
    </div>
  </GeneralModal>
</template>
