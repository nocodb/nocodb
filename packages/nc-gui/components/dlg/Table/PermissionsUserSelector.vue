<script lang="ts" setup>
const props = defineProps<{
  visible: boolean
  selectedUsers: Set<string>
  baseId: string
  permissionType: 'create' | 'delete'
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

// Filtered users based on search
const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return baseUsers.value

  const query = searchQuery.value.toLowerCase()
  return baseUsers.value.filter((user) => {
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

    const users = selectedUsersList.map((userId) => {
      const user = baseUsers.value.find((user) => user.id === userId)
      return {
        id: user?.id,
        email: user?.email,
        display_name: user?.display_name,
      }
    })

    emits('save', {
      permissionType: props.permissionType,
      selectedUsers: users,
    })

    $e('a:table:permissions:users:save')
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
    class="!w-[35rem]"
    :closable="false"
    @keydown.esc="visible = false"
  >
    <div>
      <div class="flex items-center justify-between mb-4">
        <div class="text-lg font-semibold text-nc-content-gray-emphasis">Choose specific users</div>
      </div>

      <div class="text-sm text-nc-content-gray-muted mb-6">Only these users can {{ permissionType }} records in Locked Table</div>

      <!-- Search Input -->
      <div class="relative mb-6">
        <GeneralIcon
          icon="search"
          class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-nc-content-gray-muted"
        />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Find a user"
          class="w-full pl-10 pr-4 py-2 border border-nc-border-gray-medium rounded-lg focus:border-brand-500 focus:outline-none text-sm"
        />
      </div>

      <!-- Users List -->
      <div class="max-h-80 overflow-y-auto mb-6">
        <div v-if="filteredUsers.length === 0" class="text-center py-8 text-nc-content-gray-muted">No users found</div>
        <div v-else class="space-y-2">
          <div
            v-for="user in filteredUsers"
            :key="user.id"
            class="flex items-center gap-3 p-2 hover:bg-nc-bg-gray-light rounded-lg cursor-pointer"
            @click="toggleUser(user.id)"
          >
            <NcCheckbox :checked="isUserSelected(user.id)" @click.stop="toggleUser(user.id)" />

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
          </div>
        </div>
      </div>

      <!-- Action buttons -->
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
