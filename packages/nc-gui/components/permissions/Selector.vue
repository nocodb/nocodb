<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'

const props = defineProps<{
  base: BaseType
  config: PermissionConfig
  mode?: 'inline' | 'full'
  selectWidth?: string
}>()

const emits = defineEmits(['save'])

const baseRef = toRef(props, 'base')

// Convert the config to the format expected by usePermissionSelector
const permissionSelectorConfig = computed<PermissionSelectorConfig>(() => ({
  entity: props.config.entity,
  entityId: props.config.entityId,
  permission: props.config.permission,
  label: props.config.label,
  description: props.config.description || 'have this permission',
  minimumRole: props.config.minimumRole,
}))

// Create a dummy currentValue ref since Selector doesn't use display values
const currentValue = ref('')

// Use the permission selector composable
const {
  currentOption,
  permissionOptions,
  isLoading,
  showUserSelector,
  userSelectorSelectedUsers,
  selectedUsers,
  onPermissionChange: handlePermissionChange,
  handleUserSelectorSave: handleUserSave,
} = usePermissionSelector(baseRef, permissionSelectorConfig, currentValue)

const { getPermissionTextColor } = usePermissions()

const selectedUserNames = computed(() => {
  return selectedUsers.value.map((user) => user.display_name || user.email).join(', ')
})

// Dropdown state for overlay pattern
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

// Handle permission change and emit save event
const onPermissionChange = (value: string) => {
  handlePermissionChange(value)
  emits('save')
  isDropdownOpen.value = false
}

// Handle user selector save and emit save event
const handleUserSelectorSave = (data: { selectedUsers: PermissionSelectorUser[] }) => {
  handleUserSave(data)
  emits('save')
}

// Close dropdown when clicking outside
onClickOutside(dropdownRef, (e) => {
  if ((e.target as HTMLElement)?.closest('.nc-permission-selector-dropdown')) {
    return
  }
  isDropdownOpen.value = false
})

// Handle same value selection to close dropdown
const closeOnClickOption = (optionValue: string) => {
  if (isLoading.value || optionValue !== currentOption.value?.value) return
  isDropdownOpen.value = false
}

// Default props
const mode = computed(() => props.mode || 'full')
</script>

<template>
  <div v-if="mode === 'full'" class="space-y-3">
    <div class="flex items-center justify-between">
      <label class="text-sm font-medium text-nc-content-gray-emphasis">
        {{ config.label }}
      </label>

      <div ref="dropdownRef" class="nc-permission-selector relative flex items-center" @click="isDropdownOpen = !isDropdownOpen">
        <div
          class="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border"
          :class="getPermissionTextColor(currentOption?.value)"
        >
          <GeneralIcon :icon="currentOption?.icon || 'role_editor'" class="flex-none h-4 w-4" />
          <span class="font-medium text-sm">{{ currentOption?.label || 'Editors & up' }}</span>
          <span v-if="currentOption?.isDefault" class="text-xs text-gray-500">(DEFAULT)</span>
          <GeneralIcon icon="arrowDown" class="flex-none h-3 w-3 text-gray-400" />
        </div>

        <a-select
          :value="currentOption?.value"
          :open="isDropdownOpen"
          :dropdown-match-select-width="false"
          dropdown-class-name="!rounded-lg !h-fit max-w-[350px] nc-permission-selector-dropdown"
          class="!absolute top-0 left-0 w-full h-full z-10 opacity-0"
          @change="onPermissionChange"
        >
          <a-select-option
            v-for="option in permissionOptions"
            :key="option.value"
            :value="option.value"
            :disabled="isLoading"
            @click="closeOnClickOption(option.value)"
          >
            <div class="flex flex-col w-full gap-1 py-1">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <GeneralIcon :icon="option.icon" class="flex-none h-4 w-4" :class="getPermissionTextColor(option.value)" />
                  <span class="font-medium" :class="getPermissionTextColor(option.value)">{{ option.label }}</span>
                  <span v-if="option.isDefault" class="text-xs text-gray-500">(DEFAULT)</span>
                </div>
                <GeneralLoader v-if="isLoading" size="medium" />
                <GeneralIcon v-else-if="option.value === currentOption?.value" icon="check" class="text-primary h-4 w-4" />
              </div>
              <div class="text-xs text-gray-500">{{ option.description }}</div>
            </div>
          </a-select-option>
        </a-select>
      </div>
    </div>

    <div v-if="currentOption?.value === 'specific_users'">
      <div>
        Only <span class="font-bold">{{ selectedUserNames }}</span> {{ config.description || 'have this permission' }}
      </div>
      <div class="flex items-center gap-2">
        <NcButton type="secondary" size="small" @click="showUserSelector = true">
          <div class="flex items-center gap-2">
            <GeneralIcon icon="edit" class="w-4 h-4" />
            <span>Change selected users</span>
          </div>
        </NcButton>
      </div>
    </div>
  </div>

  <div v-else class="flex items-center gap-2">
    <div ref="dropdownRef" class="nc-permission-selector relative flex items-center" @click="isDropdownOpen = !isDropdownOpen">
      <div
        class="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded cursor-pointer hover:bg-gray-100 border text-sm"
        :class="getPermissionTextColor(currentOption?.value)"
      >
        <GeneralIcon :icon="currentOption?.icon || 'role_editor'" class="flex-none h-3.5 w-3.5" />
        <span class="font-medium">{{ currentOption?.label || 'Editors & up' }}</span>
        <GeneralIcon icon="arrowDown" class="flex-none h-3 w-3 text-gray-400" />
      </div>

      <a-select
        :value="currentOption?.value"
        :open="isDropdownOpen"
        :dropdown-match-select-width="false"
        dropdown-class-name="!rounded-lg !h-fit max-w-[350px] nc-permission-selector-dropdown"
        class="!absolute top-0 left-0 w-full h-full z-10 opacity-0"
        @change="onPermissionChange"
      >
        <a-select-option
          v-for="option in permissionOptions"
          :key="option.value"
          :value="option.value"
          :disabled="isLoading"
          @click="closeOnClickOption(option.value)"
        >
          <div class="flex flex-col w-full gap-1 py-1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <GeneralIcon :icon="option.icon" class="flex-none h-4 w-4" :class="getPermissionTextColor(option.value)" />
                <span class="font-medium" :class="getPermissionTextColor(option.value)">{{ option.label }}</span>
                <span v-if="option.isDefault" class="text-xs text-gray-500">(DEFAULT)</span>
              </div>
              <GeneralLoader v-if="isLoading" size="medium" />
              <GeneralIcon v-else-if="option.value === currentOption?.value" icon="check" class="text-primary h-4 w-4" />
            </div>
            <div class="text-xs text-gray-500">{{ option.description }}</div>
          </div>
        </a-select-option>
      </a-select>
    </div>

    <!-- Inline specific users display -->
    <div v-if="currentOption?.value === 'specific_users'" class="flex items-center gap-1">
      <!-- Field selector style: compact user count -->
      <NcButton v-if="config.entity === 'field'" type="text" size="small" @click="showUserSelector = true">
        <div class="flex items-center gap-1">
          <span class="text-xs">{{ selectedUsers.length }} users</span>
          <GeneralIcon icon="edit" class="w-3 h-3" />
        </div>
      </NcButton>

      <!-- Table selector style: user names display -->
      <template v-else>
        <span class="text-xs text-nc-content-gray-muted">{{ selectedUserNames || 'No users selected' }}</span>
        <NcButton type="text" size="small" @click="showUserSelector = true">
          <GeneralIcon icon="edit" class="w-3 h-3" />
        </NcButton>
      </template>
    </div>
  </div>

  <!-- User Selector Modal (shared by both modes) -->
  <PermissionsUserSelector
    v-if="base.id"
    v-model:visible="showUserSelector"
    :selected-users="userSelectorSelectedUsers"
    :base-id="base.id"
    :permission-label="config.label"
    :permission-description="config.description"
    @save="handleUserSelectorSave"
  />
</template>

<style lang="scss">
.ant-select-item-option-content {
  white-space: normal;
}
.nc-permission-selector-dropdown {
  .rc-virtual-list-holder {
    &::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    &::-webkit-scrollbar-track-piece {
      width: 0px;
    }
    &::-webkit-scrollbar {
      @apply bg-transparent;
    }
    &::-webkit-scrollbar-thumb {
      width: 4px;
      @apply bg-gray-200 rounded-md;
    }
    &::-webkit-scrollbar-thumb:hover {
      @apply bg-gray-300;
    }
  }
}
</style>
