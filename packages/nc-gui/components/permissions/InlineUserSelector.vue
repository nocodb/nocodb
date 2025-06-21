<script lang="ts" setup>
import type { PermissionKey } from 'nocodb-sdk'
import { PermissionMeta, PermissionRoleMap, PermissionRolePower } from 'nocodb-sdk'

const props = defineProps<{
  selectedUsers: Set<string>
  baseId: string
  permissionLabel: string
  permissionDescription?: string
  permission?: PermissionKey
  readonly?: boolean
}>()

const emits = defineEmits(['update:selectedUsers', 'save'])

const selectedUsers = useVModel(props, 'selectedUsers', emits)

const { $e } = useNuxtApp()

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

// Dropdown state
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

// Search functionality
const searchQuery = ref('')

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

// Selected users display
const selectedUsersList = computed(() => {
  return Array.from(selectedUsers.value)
    .map((userId) => baseUsers.value.find((user) => user.id === userId))
    .filter((user) => user !== null)
})

const isUserSelected = (userId: string) => selectedUsers.value.has(userId)

// Handle save
const handleSave = async () => {
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
}

const toggleUser = (userId: string) => {
  if (props.readonly) return

  if (selectedUsers.value.has(userId)) {
    selectedUsers.value.delete(userId)
  } else {
    selectedUsers.value.add(userId)
  }
}

const selectAll = () => {
  if (props.readonly) return

  filteredUsers.value.forEach((user) => {
    selectedUsers.value.add(user.id)
  })
}

const clearAll = () => {
  if (props.readonly) return

  filteredUsers.value.forEach((user) => {
    selectedUsers.value.delete(user.id)
  })
}

// Close dropdown when clicking outside
onClickOutside(dropdownRef, () => {
  if (props.readonly) return
  isDropdownOpen.value = false
})

// Reset search and save when dropdown closes
watch(isDropdownOpen, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    // Save changes when dropdown closes
    handleSave()
  }
})
</script>

<template>
  <div v-if="!readonly" ref="dropdownRef" class="relative flex items-center">
    <div
      class="flex items-center gap-1.5 px-2 py-0.5 rounded border text-sm w-full shadow-sm border-1 border-nc-gray-medium cursor-pointer"
      @click="isDropdownOpen = !isDropdownOpen"
    >
      <!-- Selected user tags -->
      <div v-if="selectedUsers.size === 0" class="font-medium flex-1 text-gray-500">Select users</div>
      <div v-else class="flex items-center gap-1 flex-1 overflow-hidden">
        <!-- Show first few users as tags -->
        <div
          v-for="user in selectedUsersList.slice(0, 2)"
          :key="user?.id"
          class="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-sm"
        >
          <GeneralUserIcon :user="user" size="small" />
          <span class="font-medium">{{ user?.display_name || user?.email?.split('@')[0] || 'User' }}</span>
        </div>
        <!-- Show +X more if there are additional users -->
        <div
          v-if="selectedUsers.size > 2"
          class="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-sm font-medium text-gray-600"
        >
          + {{ selectedUsers.size - 2 }} more
        </div>
      </div>

      <GeneralIcon
        icon="arrowDown"
        class="flex-none h-3 w-3 text-gray-400 !h-4 !w-4 transition-transform"
        :class="{ 'transform rotate-180': isDropdownOpen }"
      />
    </div>

    <!-- Dropdown -->
    <div
      v-show="isDropdownOpen"
      class="absolute top-full left-0 right-0 mt-1 bg-white border border-nc-border-gray-medium rounded-lg shadow-lg z-50 max-h-80 flex flex-col nc-permission-selector-dropdown"
    >
      <!-- Search Input -->
      <div class="p-3 border-b border-nc-border-gray-light">
        <div class="relative">
          <GeneralIcon
            icon="search"
            class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-nc-content-gray-muted"
          />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Find a user"
            class="w-full pl-10 pr-4 py-2 border border-nc-border-gray-medium rounded-lg focus:border-primary focus:outline-none text-sm"
            @click.stop
          />
        </div>
      </div>

      <!-- User List -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="filteredUsers.length === 0" class="flex flex-col items-center justify-center py-8 text-nc-content-gray-muted">
          <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[100px] flex-none mb-2" alt="No users found" />
          <span class="text-sm">No users found</span>
        </div>
        <div v-else>
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="flex items-center gap-3 px-3 py-2 hover:bg-nc-bg-gray-light cursor-pointer"
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

      <!-- Actions -->
      <div class="flex items-center justify-between p-3 border-t border-nc-border-gray-light">
        <div class="flex gap-4">
          <NcButton type="text" size="small" :disabled="filteredUsers.length === 0" @click="selectAll"> Select all </NcButton>
          <NcButton type="text" size="small" :disabled="selectedUsers.size === 0" @click="clearAll"> Clear all </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>
