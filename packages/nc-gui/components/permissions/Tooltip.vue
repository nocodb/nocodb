<script lang="ts" setup>
import { type PermissionEntity, PermissionKey } from 'nocodb-sdk'
import type { TooltipPlacement } from 'ant-design-vue/lib/tooltip'

interface Props {
  entity: PermissionEntity
  entityId?: string // required for permission check otherwise it will always return true
  permission: PermissionKey
  title?: string
  description?: string
  placement?: TooltipPlacement
  showIcon?: boolean
  showOverlay?: boolean
  defaultTooltip?: string
  showPointerEventNone?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  showIcon: true,
  showOverlay: false,
  defaultTooltip: '',
  showPointerEventNone: true,
  disabled: false,
})

const { isAllowed: _isAllowed } = usePermissions()

const tooltipTitle = computed(() => {
  if (props.title) {
    return props.title
  }

  switch (props.permission) {
    case PermissionKey.TABLE_RECORD_ADD:
      return 'Create record restricted'
    case PermissionKey.TABLE_RECORD_DELETE:
      return 'Delete record restricted'
    case PermissionKey.RECORD_FIELD_EDIT:
      return 'Edit restricted'
    default:
      return 'Permission restricted'
  }
})

const tooltipDescription = computed(() => {
  if (props.description) {
    return props.description
  }

  switch (props.permission) {
    case PermissionKey.TABLE_RECORD_ADD:
      return 'You do not have permission to create records in this table'
    case PermissionKey.TABLE_RECORD_DELETE:
      return 'You do not have permission to delete records in this table'
    case PermissionKey.RECORD_FIELD_EDIT:
      return 'You do not have permission to edit this field'
    default:
      return 'You do not have permission to perform this action'
  }
})

const isAllowed = computed(() => {
  /**
   * if disabled, always return true
   * @example: If column is already readonly, then we don't need to show the tooltip and restrict any action like button click, etc.
   * */
  if (props.disabled) {
    return true
  }

  return props.entityId ? _isAllowed(props.entity, props.entityId, props.permission) : true
})
</script>

<template>
  <NcTooltip :disabled="disabled || (isAllowed && !defaultTooltip)" :placement="placement" :arrow="false">
    <template #title>
      <div v-if="!isAllowed" class="flex flex-col gap-1">
        <div class="text-captionBold">{{ tooltipTitle }}</div>
        <div v-if="tooltipDescription" class="text-captionSm">
          {{ tooltipDescription }}
        </div>
      </div>
      <template v-else>
        {{ defaultTooltip }}
      </template>
    </template>

    <div
      class="relative"
      :class="{
        'pointer-events-none': !isAllowed && showPointerEventNone,
      }"
    >
      <div
        v-if="!isAllowed && showOverlay"
        class="absolute inset-0 bg-gray-100/30 backdrop-blur-[0.5px] z-10 rounded"
        :class="{
          'cursor-not-allowed': !isAllowed,
        }"
      />

      <slot :is-allowed="isAllowed" />
    </div>
  </NcTooltip>
</template>
