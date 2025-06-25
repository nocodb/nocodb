<script lang="ts" setup>
import type { PermissionKey } from 'nocodb-sdk'

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
const isLoading = ref(false)

const baseUsers = computed(() => {
  return basesUser.value.get(props.baseId) || []
})

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

const userSelectorListRef = ref()
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

      <PermissionsUserSelectorList
        ref="userSelectorListRef"
        v-model:selected-users="selectedUsers"
        class="flex-1 border-1 border-nc-border-gray-medium rounded-lg"
        :base-id="baseId"
        :permission-label="permissionLabel"
        :permission-description="permissionDescription"
        :permission="permission"
        :is-open="visible"
        list-class-name="!w-auto"
      >
      </PermissionsUserSelectorList>

      <div class="flex items-center justify-between pt-4 border-t border-nc-border-gray-light">
        <div class="flex gap-4">
          <NcButton
            type="text"
            size="small"
            :disabled="isLoading || userSelectorListRef?.list?.length === 0"
            @click="userSelectorListRef?.selectAll()"
          >
            Select all
          </NcButton>
          <NcButton
            type="text"
            size="small"
            :disabled="isLoading || selectedUsers.size === 0"
            @click="userSelectorListRef?.clearAll()"
          >
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
