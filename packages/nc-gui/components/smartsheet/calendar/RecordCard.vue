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
}

withDefaults(defineProps<Props>(), {
  resize: true,
  hover: false,
  color: 'blue',
  size: 'small',
  position: 'rounded',
})

const emit = defineEmits(['resize-start'])
</script>

<template>
  <div
    :class="{
      'h-6': size === 'small',
      'h-full': size === 'auto',
      'rounded-l-md ml-1': position === 'leftRounded',
      'rounded-r-md mr-1': position === 'rightRounded',
      'rounded-md mx-1': position === 'rounded',
      'rounded-none': position === 'none',
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'shadow-md': hover,
    }"
    class="relative transition-all flex items-center gap-2 group"
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
      }"
      class="w-1 min-h-6 bg-blue-500 rounded-x rounded-l-md"
    ></div>

    <div
      v-if="(position === 'leftRounded' || position === 'rounded') && resize"
      class="mt-0.7 w-2 h-7.1 -left-1 absolute resize"
      @mousedown.stop="emit('resize-start', 'left', $event, record)"
    ></div>

    <div class="overflow-hidden items-center justify-center gap-2 flex w-full">
      <span v-if="position === 'rightRounded' || position === 'none'" class="ml-2"> .... </span>
      <slot name="time" />
      <div
        :class="{
          'pr-7': position === 'leftRounded',
        }"
        class="flex mb-0.5 overflow-x-hidden break-word whitespace-nowrap overflow-hidden text-ellipsis w-full truncate text-ellipsis flex-col gap-1"
      >
        <NcTooltip :disabled="selected" class="inline-block" show-on-truncate-only wrap-child="span">
          <slot class="text-sm text-nowrap text-gray-800 leading-7" />
          <template #title>
            <slot />
          </template>
        </NcTooltip>
      </div>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute my-0 right-5"> .... </span>
    </div>

    <div
      v-if="(position === 'rightRounded' || position === 'rounded') && resize"
      class="absolute mt-0.3 h-7.1 w-2 right-1 resize"
      @mousedown.stop="emit('resize-start', 'right', $event, record)"
    ></div>
  </div>
</template>

<style lang="scss" scoped>
.resize {
  cursor: ew-resize;
}
</style>
