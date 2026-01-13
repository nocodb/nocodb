<script setup lang="ts">
import type { TooltipPlacement } from 'ant-design-vue/es/tooltip'
import type { CSSProperties } from '@vue/runtime-dom'

withDefaults(
  defineProps<{
    tooltipStyle?: CSSProperties
    overlayInnerStyle?: CSSProperties
    mouseLeaveDelay?: number
    placement?: TooltipPlacement
    trigger?: 'hover' | 'click'
    message?: string
    enabled?: boolean
  }>(),
  {
    mouseLeaveDelay: 0.3,
    placement: 'left',
    trigger: 'hover',
  },
)
</script>

<template>
  <NcTooltip
    :disabled="!enabled"
    :tooltip-style="{ 'min-width': 'max-content' }"
    :overlay-inner-style="{ 'min-width': 'max-content' }"
    :mouse-leave-delay="mouseLeaveDelay"
    :placement="placement"
    :trigger="trigger"
  >
    <template #title>
      <slot name="title">
        {{ message }}
      </slot>
    </template>
    <slot />
  </NcTooltip>
</template>
