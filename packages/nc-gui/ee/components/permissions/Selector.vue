<script lang="ts" setup>
import type { BaseType } from 'nocodb-sdk'
import { PermissionKey, PermissionMeta, PermissionOptionRestrictiveness, PermissionOptionValue, PermissionRolePower } from 'nocodb-sdk'
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
  inlineStyle?: boolean // New prop to match inline table style
}
const props = withDefaults(defineProps<Props>(), {
  borderOnHover: false,
  placement: 'bottomRight',
  removeReadonlyPadding: true,
  inlineStyle: false,
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
  effectiveValue: props.config.effectiveValue,
}))

// Create a dummy currentValue ref since Selector doesn't use display values
const currentValue = ref('')

const isTableVisibility = computed(() => props.config?.permission === PermissionKey.TABLE_VISIBILITY)
const isDocVisibility = computed(() => props.config?.permission === PermissionKey.DOCUMENT_VISIBILITY)

// Determine if an option is the default for the current permission context
const isDefaultOption = (option: { value: string; isDefault?: boolean }) => {
  // Doc visibility: default is Viewers & up
  if (isDocVisibility.value) {
    return option.value === PermissionOptionValue.VIEWERS_AND_UP
  }
  // Table visibility: default is Everyone
  if (isTableVisibility.value) {
    return option.value === PermissionOptionValue.EVERYONE
  }
  // All others: use the SDK's isDefault flag
  return option.isDefault && option.value === PermissionOptionValue.EDITORS_AND_UP
}

// Use the permission selector composable
const {
  currentOption,
  permissionOptions: allPermissionOptions,
  isLoading,
  isInherited,
  userSelectorSelectedUsers,
  selectedUsers,
  onPermissionChange: handlePermissionChange,
  handleUserSelectorSave: handleUserSave,
  showUserSelector,
} = usePermissionSelector(baseRef, permissionSelectorConfig, currentValue)

// Build hierarchy scope map for team subjects
const teamHierarchyScopes = computed(() => {
  const scopes: Record<string, 'self_only' | 'self_and_descendants'> = {}
  for (const user of selectedUsers.value) {
    if (user.type === 'team' && user.hierarchy_scope) {
      scopes[user.id] = user.hierarchy_scope
    }
  }
  return scopes
})

// Filter permission options based on minimum role requirement
const permissionOptions = computed(() => {
  if (!props.config.permission) return allPermissionOptions.value

  const permissionMeta = PermissionMeta[props.config.permission]
  if (!permissionMeta) return allPermissionOptions.value

  const minimumRolePower = PermissionRolePower[permissionMeta.minimumRole]
  if (!minimumRolePower) return allPermissionOptions.value

  const isTableVisibility = props.config.permission === PermissionKey.TABLE_VISIBILITY

  // Filter options to only show roles that meet or exceed the minimum requirement
  return allPermissionOptions.value.filter((option) => {
    // For record permissions (create/delete), exclude Viewers & up, Commenters & up, and Everyone
    if (!isTableVisibility) {
      if (option.value === PermissionOptionValue.COMMENTERS_AND_UP || option.value === PermissionOptionValue.EVERYONE) {
        return false
      }
    }

    // For table visibility, always allow Everyone, Editors & up, and Creators & up
    if (isTableVisibility) {
      if (option.value === PermissionOptionValue.EVERYONE) {
        return true
      }
      if (option.value === PermissionOptionValue.VIEWERS_AND_UP) {
        return false
      }
      if (option.value === PermissionOptionValue.COMMENTERS_AND_UP) {
        return false
      }
      if (option.value === PermissionOptionValue.EDITORS_AND_UP) {
        return true
      }
      if (option.value === PermissionOptionValue.CREATORS_AND_UP) {
        return true
      }
      if (option.value === PermissionOptionValue.NOBODY) {
        return false
      }
    }

    // Always allow 'specific_users' and 'nobody' options
    if (option.value === PermissionOptionValue.SPECIFIC_USERS || option.value === PermissionOptionValue.NOBODY) {
      return true
    }

    // Map option values to PermissionRole enum values for comparison
    let optionRole: string | undefined
    switch (option.value) {
      case PermissionOptionValue.VIEWERS_AND_UP:
        optionRole = 'viewer'
        break
      case PermissionOptionValue.COMMENTERS_AND_UP:
        optionRole = 'commenter'
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

// Determine which options are disabled because they are more permissive than the parent's effective permission
const isOptionDisabledByParent = (optionValue: string): boolean => {
  const parentValue = props.config.parentEffectiveValue
  if (!parentValue) return false

  const parentLevel = PermissionOptionRestrictiveness[parentValue]
  const optionLevel = PermissionOptionRestrictiveness[optionValue]

  // If we can't determine levels (e.g. unknown values), don't disable
  if (parentLevel === undefined || optionLevel === undefined) return false

  // Disable if option is less restrictive than parent
  return optionLevel < parentLevel
}

// Map PermissionOptionValue → role string for user selector filtering
const optionToRole: Record<string, string> = {
  [PermissionOptionValue.VIEWERS_AND_UP]: 'viewer',
  [PermissionOptionValue.COMMENTERS_AND_UP]: 'commenter',
  [PermissionOptionValue.EDITORS_AND_UP]: 'editor',
  [PermissionOptionValue.CREATORS_AND_UP]: 'creator',
}

const minimumRoleFromParent = computed<string | undefined>(() => {
  const parentValue = props.config.parentEffectiveValue
  if (!parentValue) return undefined

  return optionToRole[parentValue]
})

const { getPermissionTextColor } = usePermissions()

const isOpenPermissionDropdown = ref(false)

const onPermissionChange = (value: any) => {
  if (props.readonly) return
  if (isOptionDisabledByParent(value)) return

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
        'items-start': !horizontal,
        'flex-col': horizontal,
      }"
    >
      <div class="flex flex-col">
        <div class="flex items-center gap-3">
          <div v-if="mode === 'full' && horizontal" class="flex-1">
            {{ permissionLabel }}
          </div>

          <NcListDropdown
            v-model:is-open="isOpenPermissionDropdown"
            :default-slot-wrapper-class="
              inlineStyle
                ? '!px-0 !py-0 !border-0 !rounded-none !h-auto !shadow-none'
                : !readonly
                ? 'w-[145px] sm:w-[165px]'
                : removeReadonlyPadding
                ? '!px-0 !border-0'
                : '!border-0'
            "
            :placement="placement"
            :disabled="readonly || config.disabled"
            :show-as-disabled="false"
            :border-on-hover="borderOnHover && !inlineStyle"
            @click="handleClickDropdown"
          >
          <NcTooltip :disabled="!config.disabled || !config.tooltip">
            <template #title>
              {{ config.tooltip }}
            </template>
            <div
              class="flex-1 flex items-center gap-1.5"
              :class="{
                [getPermissionTextColor(currentOption?.value || PermissionOptionValue.EDITORS_AND_UP)]:
                  !isInherited && (!config.disabled || readonly),
                'text-nc-content-gray-muted': isInherited && !config.disabled,
                'text-nc-content-gray-disabled': config.disabled,
              }"
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
          </NcTooltip>

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
                <NcTooltip :disabled="!isOptionDisabledByParent(option.value)" placement="right">
                  <template #title>
                    {{ $t('msg.info.cannotBeMorePermissiveThanParent') }}
                  </template>
                  <div
                    class="w-full flex flex-col"
                    :class="{ 'opacity-40 cursor-not-allowed': isOptionDisabledByParent(option.value) }"
                  >
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
                        <span
                          v-if="isDefaultOption(option)"
                          class="text-captionXsBold text-nc-content-gray-muted"
                        >
                          ({{ $t('general.default').toUpperCase() }})
                        </span>
                      </div>
                      <GeneralLoader
                        v-if="isLoading && option.value === (currentOption?.value || PermissionOptionValue.EDITORS_AND_UP)"
                        size="medium"
                      />
                      <GeneralIcon v-else-if="option.value === currentOption?.value" icon="check" class="text-primary h-4 w-4" />
                    </div>
                    <div class="text-bodySm text-nc-content-gray-muted ml-6">{{ option.description }}</div>
                  </div>
                </NcTooltip>
              </template>
            </NcList>
          </template>
          </NcListDropdown>
        </div>
        <div
          v-if="isInherited"
          class="flex items-center gap-1 text-xs text-nc-content-gray-muted"
          :class="{ 'self-end': horizontal }"
        >
          <GeneralIcon icon="role_inherit" class="h-3 w-3" />
          <span>{{ $t('labels.inheritedFromParent') }}</span>
        </div>
      </div>

      <template v-if="mode === 'full'">
        <!-- Inline User Selector on the same line -->
        <PermissionsInlineUserSelector
          v-if="base.id && currentOption?.value === PermissionOptionValue.SPECIFIC_USERS"
          v-model:selected-users="userSelectorSelectedUsers"
          class="flex-1"
          :class="{ 'mb-3': !isTableVisibility }"
          :base-id="base.id"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="config.permission"
          :entity-title="config.entityTitle"
          :readonly="props.readonly"
          :hint="isTableVisibility ? null : $t('msg.permissionHintMsg')"
          :team-hierarchy-scopes="teamHierarchyScopes"
          :minimum-role-override="minimumRoleFromParent"
          @save="handleUserSelectorSave"
        />
      </template>
      <template v-else-if="base.id">
        <!-- Clickable user summary to open the user selector modal -->
        <div
          v-if="currentOption?.value === PermissionOptionValue.SPECIFIC_USERS && !readonly"
          class="flex items-center gap-1.5 cursor-pointer text-xs text-nc-content-gray-subtle2 hover:text-nc-content-brand transition-colors"
          @click.stop="showUserSelector = true"
        >
          <template v-if="selectedUsers.length">
            <GeneralIcon icon="ncUsers" class="h-3.5 w-3.5 flex-none" />
            <span>
              {{ selectedUsers.length }} {{ selectedUsers.length === 1 ? $t('objects.user') : $t('objects.users') }}
            </span>
          </template>
          <template v-else>
            <GeneralIcon icon="ncUsers" class="h-3.5 w-3.5 flex-none" />
            <span>{{ $t('msg.permissions.inlineUserSelector.selectUsers') }}</span>
          </template>
          <GeneralIcon icon="ncEdit" class="h-3 w-3 flex-none" />
        </div>
        <!-- User Selector Modal -->
        <PermissionsUserSelector
          v-model:visible="showUserSelector"
          :selected-users="userSelectorSelectedUsers"
          :base-id="base.id"
          :permission-label="permissionLabel"
          :permission-description="permissionDescription"
          :permission="config.permission"
          :entity-title="config.entityTitle"
          :hint="isTableVisibility ? null : $t('msg.permissionHintMsg')"
          :minimum-role-override="minimumRoleFromParent"
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
      @apply bg-nc-bg-gray-medium rounded-md;
    }
    &::-webkit-scrollbar-thumb:hover {
      @apply bg-nc-bg-gray-dark;
    }
  }
}
</style>
