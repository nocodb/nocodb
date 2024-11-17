<script setup lang="ts">
import type { TooltipPlacement } from 'ant-design-vue/es/tooltip'
import type { CSSProperties } from '@vue/runtime-dom'

defineProps<{
  tooltipStyle?: CSSProperties
  overlayInnerStyle?: CSSProperties
  mouseLeaveDelay?: number
  placement?: TooltipPlacement
  trigger?: 'hover' | 'click'
  message?: string
  enabled?: boolean
}>()
</script>

<template>
  <NcTooltip
    :disabled="!enabled"
    :tooltip-style="{ 'min-width': 'max-content' }"
    :overlay-inner-style="{ 'min-width': 'max-content' }"
    :mouse-leave-delay="0.3"
    placement="left"
    trigger="hover"
  >
    <template #title>
      {{ $t('tooltip.schemaChangeDisabled') }} <br />
      {{ message }}
      <br v-if="message" />
      <a
        class="!text-current"
        href="https://docs.nocodb.com/data-sources/connect-to-data-source#configuring-permissions"
        target="_blank"
      >
        Learn more
      </a>
    </template>
    <slot />
  </NcTooltip>
</template>
