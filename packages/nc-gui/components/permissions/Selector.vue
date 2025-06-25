<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { PermissionMeta, PermissionOptionValue, PermissionRolePower } from 'nocodb-sdk'
import PermissionsInlineUserSelector from './InlineUserSelector.vue'

const props = defineProps<{
  base: BaseType
  config: PermissionConfig
  mode?: 'inline' | 'full'
  horizontal?: boolean
  selectWidth?: string
  readonly?: boolean
}>()

const emits = defineEmits(['save'])

const baseRef = toRef(props, 'base')

const selectWidth = computed(() => props.selectWidth || 'w-[165px]')

// Derive label and description from PermissionMeta
const permissionMeta = computed(() => PermissionMeta[props.config.permission])
const permissionLabel = computed(() => permissionMeta.value?.label || 'Permission')
const permissionDescription = computed(() => permissionMeta.value?.description || 'have this permission')

// Convert the config to the format expected by usePermissionSelector
const permissionSelectorConfig = computed<PermissionSelectorConfig>(() => ({
  entity: props.config.entity,
  entityId: props.config.entityId,
  permission: props.config.permission,
  label: permissionLabel.value,
  description: permissionDescription.value,
}))

// Create a dummy currentValue ref since Selector doesn't use display values
const currentValue = ref('')

// Use the permission selector composable
const {
  currentOption,
  permissionOptions: allPermissionOptions,
  isLoading,
  userSelectorSelectedUsers,
  selectedUsers: _selectedUsers,
  onPermissionChange: handlePermissionChange,
  handleUserSelectorSave: handleUserSave,
  showUserSelector,
} = usePermissionSelector(baseRef, permissionSelectorConfig, currentValue)

// Filter permission options based on minimum role requirement
const permissionOptions = computed(() => {
  if (!props.config.permission) return allPermissionOptions.value

  const permissionMeta = PermissionMeta[props.config.permission]
  if (!permissionMeta) return allPermissionOptions.value

  const minimumRolePower = PermissionRolePower[permissionMeta.minimumRole]
  if (!minimumRolePower) return allPermissionOptions.value

  // Filter options to only show roles that meet or exceed the minimum requirement
  return allPermissionOptions.value.filter((option) => {
    // Always allow 'specific_users' and 'nobody' options
    if (option.value === PermissionOptionValue.SPECIFIC_USERS || option.value === PermissionOptionValue.NOBODY) return true

    // Map option values to PermissionRole enum values for comparison
    let optionRole: string | undefined
    switch (option.value) {
      case PermissionOptionValue.VIEWERS_AND_UP:
        optionRole = 'viewer'
        break
      case PermissionOptionValue.EDITORS_AND_UP:
        optionRole = 'editor'
        break
      case PermissionOptionValue.CREATORS_AND_UP:
        optionRole = 'creator'
        break
      default:
        return false
    }

    const optionRolePower = PermissionRolePower[optionRole as keyof typeof PermissionRolePower]
    return optionRolePower && optionRolePower >= minimumRolePower
  })
})

const { getPermissionTextColor } = usePermissions()

// Dropdown state for overlay pattern
const isDropdownOpen = ref(false)
const dropdownRef = ref(null)

const onPermissionChange = (value: any) => {
  if (props.readonly) return
  handlePermissionChange(value, props.mode === 'inline')
  emits('save')
  isDropdownOpen.value = false
}

// Handle user selector save and emit save event
const handleUserSelectorSave = (data: { selectedUsers: PermissionSelectorUser[] }) => {
  if (props.readonly) return
  handleUserSave(data)
  emits('save')
}

// Close dropdown when clicking outside
onClickOutside(dropdownRef, (e) => {
  if (props.readonly) return
  if ((e.target as HTMLElement)?.closest('.nc-permission-selector-dropdown')) {
    return
  }
  isDropdownOpen.value = false
})

// Handle same value selection to close dropdown
const closeOnClickOption = (optionValue: string) => {
  if (props.readonly) return
  if (isLoading.value || optionValue !== currentOption.value?.value) return
  isDropdownOpen.value = false
}

// Default props
const mode = computed(() => props.mode || 'full')
</script>

<template>
  <div v-if="mode === 'full'">
    <div class="flex gap-1" :class="horizontal ? 'flex-row items-center gap-3' : 'flex-col'">
      <label :class="horizontal ? 'flex-1' : 'mb-1'">
        {{ permissionLabel }}
      </label>

      <div class="flex items-center gap-2">
        <div
          ref="dropdownRef"
          class="nc-permission-selector relative flex items-center"
          :class="props.readonly ? '' : selectWidth"
          @click="!props.readonly && (isDropdownOpen = !isDropdownOpen)"
        >
          <div
            class="flex-1 border-1 border-nc-gray-medium rounded-lg h-8 px-3 py-1 flex items-center gap-1.5 transition-all cursor-pointer select-none"
            :class="[
              getPermissionTextColor(currentOption?.value || PermissionOptionValue.EDITORS_AND_UP),
              props.readonly ? 'bg-transparent border-transparent' : 'border-nc-gray-medium cursor-pointer',
              {
                'shadow-default hover:shadow-hover': !isDropdownOpen,
                'border-brand-500 shadow-selected': isDropdownOpen,
              },
            ]"
          >
            <GeneralIcon :icon="(currentOption?.icon || 'role_editor') as any" class="flex-none h-4 w-4" />
            <span class="font-medium flex-1">{{ currentOption?.label || 'Editors & up' }}</span>

            <GeneralIcon v-if="!props.readonly" icon="arrowDown" class="flex-none text-gray-500 h-4 w-4" />
          </div>

          <a-select
            v-if="!readonly"
            :value="currentOption?.value"
            :open="isDropdownOpen"
            placement="bottomRight"
            :dropdown-match-select-width="false"
            dropdown-class-name="!rounded-lg !h-fit max-w-[350px] nc-permission-selector-dropdown"
            class="!absolute top-0 left-0 h-full w-full z-10 opacity-0 pointer-events-none"
            @select="onPermissionChange"
            @keydown.esc.stop="isDropdownOpen = false"
          >
            <a-select-option
              v-for="option in permissionOptions"
              :key="option.value"
              :value="option.value"
              :disabled="isLoading"
              @click="closeOnClickOption(option.value)"
            >
              <div class="flex flex-col gap-1 py-1">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <GeneralIcon
                      :icon="(option.icon as any)"
                      class="flex-none h-4 w-4"
                      :class="getPermissionTextColor(option.value)"
                    />
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

        <!-- Inline User Selector on the same line -->
        <PermissionsInlineUserSelector
          v-if="base.id && currentOption?.value === PermissionOptionValue.SPECIFIC_USERS"
          v-model:selected-users="userSelectorSelectedUsers"
          class="flex-1"
          :base-id="base.id"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="config.permission"
          :readonly="props.readonly"
          @save="handleUserSelectorSave"
        />
      </div>
    </div>
  </div>

  <div v-else class="flex items-center gap-2">
    <div
      ref="dropdownRef"
      class="nc-permission-selector relative flex items-center"
      :class="props.readonly ? '' : selectWidth"
      @click="!props.readonly && (isDropdownOpen = !isDropdownOpen)"
    >
      <div
        class="flex-1 border-1 border-nc-gray-medium rounded-lg h-8 px-3 py-1 flex items-center gap-1.5 transition-all cursor-pointer select-none"
        :class="[
          getPermissionTextColor(currentOption?.value || PermissionOptionValue.EDITORS_AND_UP),
          props.readonly ? 'bg-transparent border-transparent' : 'cursor-pointer',
        ]"
      >
        <GeneralIcon :icon="(currentOption?.icon || 'role_editor') as any" class="flex-none h-3.5 w-3.5" />
        <span class="font-medium">{{ currentOption?.label || 'Editors & up' }}</span>
        <span class="flex-1"></span>
        <GeneralIcon v-if="!props.readonly" icon="arrowDown" class="flex-none h-3 w-3 text-gray-400" />
      </div>

      <a-select
        v-if="!props.readonly"
        :value="currentOption?.value"
        :open="isDropdownOpen"
        :dropdown-match-select-width="false"
        dropdown-class-name="!rounded-lg !h-fit max-w-[350px] nc-permission-selector-dropdown"
        class="!absolute top-0 left-0 h-full w-full z-10 opacity-0"
        @select="onPermissionChange"
      >
        <a-select-option
          v-for="option in permissionOptions"
          :key="option.value"
          :value="option.value"
          :disabled="isLoading"
          @click="closeOnClickOption(option.value)"
        >
          <div class="flex flex-col gap-1 py-1">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <GeneralIcon
                  :icon="(option.icon as any)"
                  class="flex-none h-4 w-4"
                  :class="getPermissionTextColor(option.value)"
                />
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

    <!-- User Selector Modal (shared by both modes) -->
    <PermissionsUserSelector
      v-if="base.id"
      v-model:visible="showUserSelector"
      :selected-users="userSelectorSelectedUsers"
      :base-id="base.id"
      :permission-label="permissionLabel"
      :permission-description="permissionDescription"
      :permission="config.permission"
      @save="handleUserSelectorSave"
    />
  </div>
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
