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
  arrow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'top',
  showIcon: true,
  showOverlay: false,
  defaultTooltip: '',
  showPointerEventNone: true,
  disabled: false,
  arrow: false,
})

const { t } = useI18n()

const { isAllowed: _isAllowed } = usePermissions()

const tooltipTitle = computed(() => {
  if (props.title) {
    return props.title
  }

  switch (props.permission) {
    case PermissionKey.TABLE_RECORD_ADD:
      return t('objects.permissions.addNewRecordTooltipTitle')
    case PermissionKey.TABLE_RECORD_DELETE:
      return t('objects.permissions.deleteRecordTooltipTitle')
    case PermissionKey.RECORD_FIELD_EDIT:
      return t('objects.permissions.editFieldTooltipTitle')
    default:
      return t('objects.permissions.generalPermissionTooltipTitle')
  }
})

const tooltipDescription = computed(() => {
  if (props.description) {
    return props.description
  }

  switch (props.permission) {
    case PermissionKey.TABLE_RECORD_ADD:
      return t('objects.permissions.addNewRecordTooltip')
    case PermissionKey.TABLE_RECORD_DELETE:
      return t('objects.permissions.deleteRecordTooltip')
    case PermissionKey.RECORD_FIELD_EDIT:
      return t('objects.permissions.editFieldTooltip')
    default:
      return t('objects.permissions.generalPermissionTooltip')
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
  <NcTooltip :disabled="isAllowed && !defaultTooltip" :placement="placement" :arrow="arrow">
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
        class="absolute inset-0 bg-nc-bg-gray-light/30 backdrop-blur-[0.5px] z-10 rounded"
        :class="{
          'cursor-not-allowed': !isAllowed,
        }"
      />

      <slot :is-allowed="isAllowed" />
    </div>
  </NcTooltip>
</template>
