<script lang="ts" setup>
import type { PermissionEntity, PermissionKey } from 'nocodb-sdk'
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

defineProps<Props>()

const isAllowed = computed(() => true)
</script>

<template>
  <slot :is-allowed="isAllowed" />
</template>
