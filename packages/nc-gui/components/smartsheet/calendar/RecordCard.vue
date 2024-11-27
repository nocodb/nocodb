<script lang="ts" setup>
import type { Row } from '~/lib/types'

interface Props {
  color?: string
  resize?: boolean
  hover?: boolean
  record?: Row
  selected?: boolean
  size?: 'small' | 'medium' | 'large' | 'auto'
  position?: 'leftRounded' | 'rightRounded' | 'rounded' | 'none'
  dragging?: boolean
}

withDefaults(defineProps<Props>(), {
  resize: true,
  hover: false,
  color: 'gray',
  size: 'small',
  position: 'rounded',
  dragging: false,
})

const emit = defineEmits(['resize-start'])
</script>

<template>
  <div
    :class="{
      'h-7': size === 'small',
      'h-full': size === 'auto',
      'rounded-l-[4px] !border-r-0 ml-1': position === 'leftRounded',
      'rounded-r-[4px] !border-l-0 mr-1': position === 'rightRounded',
      'rounded-[4px] ml-0.8 mr-1': position === 'rounded',
      'rounded-none !border-x-0': position === 'none',
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'bg-white border-gray-300': color === 'gray',
      '!bg-nc-bg-gray-light': hover || dragging,
    }"
    :style="{
      boxShadow:
        hover || dragging
          ? '0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06)'
          : '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02)',
    }"
    class="relative transition-all border-1 flex items-center gap-2 group"
  >
    <div
      v-if="position === 'leftRounded' || position === 'rounded'"
      :class="{
        'bg-maroon-500': color === 'maroon',
        'bg-blue-500': color === 'blue',
        'bg-green-500': color === 'green',
        'bg-yellow-500': color === 'yellow',
        'bg-pink-500': color === 'pink',
        'bg-purple-500': color === 'purple',
        'bg-gray-900': color === 'gray',
      }"
      class="w-1 min-h-6.5 rounded-l-[4px] bg-blue-500"
    ></div>

    <div
      v-if="(position === 'leftRounded' || position === 'rounded') && resize"
      class="mt-0.7 w-2 h-7.1 -left-1 absolute resize"
      @mousedown.stop="emit('resize-start', 'left', $event, record)"
    ></div>

    <div class="overflow-hidden items-center justify-center gap-2 flex w-full">
      <span v-if="position === 'rightRounded' || position === 'none'" class="ml-2 mb-0.6"> .... </span>
      <slot name="time" />
      <div
        :class="{
          'pr-7': position === 'leftRounded',
        }"
        class="flex mb-0.5 overflow-x-hidden w-full truncate flex-col gap-1"
      >
        <NcTooltip
          :disabled="selected || dragging"
          class="break-word whitespace-nowrap overflow-hidden text-ellipsis pr-1"
          show-on-truncate-only
          wrap-child="span"
        >
          <slot class="text-sm text-nowrap text-gray-800 leading-7" />
          <template #title>
            <slot />
          </template>
        </NcTooltip>
      </div>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute mb-0.6 z-10 right-5"> .... </span>
    </div>

    <div
      v-if="(position === 'rightRounded' || position === 'rounded') && resize"
      class="absolute mt-0.3 h-7.1 w-2 right-0 resize"
      @mousedown.stop="emit('resize-start', 'right', $event, record)"
    ></div>
  </div>
</template>

<style lang="scss" scoped>
.resize {
  cursor: ew-resize;
}

.plain-cell {
  line-height: 18px;
  .bold {
    @apply !text-gray-800 font-bold;
  }
}
</style>
