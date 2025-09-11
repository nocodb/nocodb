<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { PermissionMeta, PermissionOptionValue, PermissionRolePower } from 'nocodb-sdk'
import PermissionsInlineUserSelector from './InlineUserSelector.vue'
import type { NcDropdownPlacement } from '#imports'

interface Props {
  base: BaseType
  config: PermissionConfig
  mode?: 'inline' | 'full'
  horizontal?: boolean
  readonly?: boolean
  removeReadonlyPadding?: boolean
  borderOnHover?: boolean
  placement?: NcDropdownPlacement
}
const props = withDefaults(defineProps<Props>(), {
  borderOnHover: false,
  placement: 'bottomRight',
  removeReadonlyPadding: true,
})

const emits = defineEmits(['save'])

const baseRef = toRef(props, 'base')

// Derive label and description from PermissionMeta
const permissionMeta = computed(() => PermissionMeta[props.config.permission])
const permissionLabel = computed(() => permissionMeta.value?.label || 'Permission')
const permissionDescription = computed(() => permissionMeta.value?.description || 'have this permission')

// Convert the config to the format expected by usePermissionSelector
const permissionSelectorConfig = computed<PermissionSelectorConfig>(() => ({
  entity: props.config.entity,
  entityId: props.config.entityId,
  entityTitle: props.config.entityTitle,
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

const isOpenPermissionDropdown = ref(false)

const onPermissionChange = (value: any) => {
  if (props.readonly) return

  handlePermissionChange(value, props.mode === 'inline')
  emits('save')
  isOpenPermissionDropdown.value = false
}

// Handle user selector save and emit save event
const handleUserSelectorSave = (data: { selectedUsers: PermissionSelectorUser[] }) => {
  if (props.readonly) return
  handleUserSave(data)
  emits('save')
}

// Default props
const mode = computed(() => props.mode || 'full')

const handleClickDropdown = (e: MouseEvent) => {
  if (props.readonly) return

  e.stopPropagation()
}
</script>

<template>
  <div
    class="flex w-full"
    :class="{
      'items-center gap-3': horizontal,
      'flex-col gap-2': !horizontal,
    }"
  >
    <div v-if="mode === 'full' && !horizontal" :class="horizontal ? 'flex-1' : ''">
      {{ permissionLabel }}
    </div>

    <div
      class="flex w-full gap-3"
      :class="{
        'items-center': !horizontal,
        'flex-col': horizontal,
      }"
    >
      <div class="flex items-center gap-3">
        <div v-if="mode === 'full' && horizontal" class="flex-1">
          {{ permissionLabel }}
        </div>

        <NcListDropdown
          v-model:is-open="isOpenPermissionDropdown"
          :default-slot-wrapper-class="`${!readonly ? 'w-[165px]' : removeReadonlyPadding ? '!px-0 !border-0' : '!border-0'}`"
          :placement="placement"
          :disabled="readonly"
          :show-as-disabled="false"
          :border-on-hover="borderOnHover"
          @click="handleClickDropdown"
        >
          <div
            class="flex-1 flex items-center gap-1.5"
            :class="[getPermissionTextColor(currentOption?.value || PermissionOptionValue.EDITORS_AND_UP)]"
          >
            <GeneralIcon :icon="(currentOption?.icon || 'role_editor') as any" class="flex-none h-4 w-4" />
            <span class="font-medium flex-1 whitespace-nowrap">{{ currentOption?.label || 'Editors & up' }}</span>
            <GeneralIcon
              v-if="!readonly"
              icon="chevronDown"
              class="flex-none h-4 w-4 transition-transform"
              :class="{ 'transform rotate-180': isOpenPermissionDropdown }"
            />
          </div>
          <template #overlay="{ onEsc }">
            <NcList
              v-model:open="isOpenPermissionDropdown"
              :value="currentOption?.value || PermissionOptionValue.EDITORS_AND_UP"
              :list="permissionOptions"
              option-label-key="value"
              option-value-key="value"
              :close-on-select="false"
              :item-height="48"
              class="!w-auto"
              variant="medium"
              wrapper-class-name="!h-auto"
              @update:value="onPermissionChange"
              @escape="onEsc"
            >
              <template #listItem="{ option }">
                <div class="w-full flex flex-col">
                  <div class="w-full flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <GeneralIcon
                        :icon="(option.icon as any)"
                        class="flex-none h-4 w-4"
                        :class="getPermissionTextColor(option.value)"
                      />
                      <span class="text-captionDropdownDefault" :class="getPermissionTextColor(option.value)">{{
                        option.label
                      }}</span>
                      <span v-if="option.isDefault" class="text-captionXsBold text-nc-content-gray-muted">(DEFAULT)</span>
                    </div>
                    <GeneralLoader
                      v-if="isLoading && option.value === (currentOption?.value || PermissionOptionValue.EDITORS_AND_UP)"
                      size="medium"
                    />
                    <GeneralIcon v-else-if="option.value === currentOption?.value" icon="check" class="text-primary h-4 w-4" />
                  </div>
                  <div class="text-bodySm text-nc-content-gray-muted ml-6">{{ option.description }}</div>
                </div>
              </template>
            </NcList>
          </template>
        </NcListDropdown>
      </div>

      <template v-if="mode === 'full'">
        <!-- Inline User Selector on the same line -->
        <PermissionsInlineUserSelector
          v-if="base.id && currentOption?.value === PermissionOptionValue.SPECIFIC_USERS"
          v-model:selected-users="userSelectorSelectedUsers"
          class="flex-1"
          :base-id="base.id"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="config.permission"
          :entity-title="config.entityTitle"
          :readonly="props.readonly"
          @save="handleUserSelectorSave"
        />
      </template>
      <template v-else-if="base.id">
        <!-- User Selector Modal (shared by both modes) -->
        <PermissionsUserSelector
          v-model:visible="showUserSelector"
          :selected-users="userSelectorSelectedUsers"
          :base-id="base.id"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="config.permission"
          :entity-title="config.entityTitle"
          @save="handleUserSelectorSave"
        />
      </template>
    </div>
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
