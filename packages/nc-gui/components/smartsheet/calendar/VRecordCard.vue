<script lang="ts" setup>
interface Props {
  record: Record<string, string>
  color?: string
  resize?: boolean
  selected?: boolean
  hover?: boolean
  dragging?: boolean
}

withDefaults(defineProps<Props>(), {
  resize: true,
  selected: false,
  hover: false,
  color: 'gray',
  dragging: false,
})

const emit = defineEmits(['resize-start'])
</script>

<template>
  <div
    :style="{
      boxShadow:
        hover || dragging
          ? '0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06)'
          : '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02)',
    }"
    :class="{
      'bg-maroon-50': color === 'maroon',
      'bg-blue-50': color === 'blue',
      'bg-green-50': color === 'green',
      'bg-yellow-50': color === 'yellow',
      'bg-pink-50': color === 'pink',
      'bg-purple-50': color === 'purple',
      'bg-white border-gray-300': color === 'gray',
      'z-90': hover,
      '!bg-nc-bg-gray-light': hover || dragging,
    }"
    class="relative flex gap-1 border-1 relative rounded-md h-full"
  >
    <div
      v-if="resize"
      class="absolute w-full h-1 z-20 top-0 cursor-row-resize"
      @mousedown.stop="emit('resize-start', 'left', $event, record)"
    ></div>
    <div
      :class="{
        'bg-maroon-500': color === 'maroon',
        'bg-blue-500': color === 'blue',
        'bg-green-500': color === 'green',
        'bg-yellow-500': color === 'yellow',
        'bg-pink-500': color === 'pink',
        'bg-purple-500': color === 'purple',
        'bg-gray-900': color === 'gray',
      }"
      class="h-full min-h-3 w-1.25 -ml-0.25 rounded-l-md"
    ></div>

    <div class="flex overflow-x-hidden whitespace-nowrap text-ellipsis pt-1 w-full truncate text-ellipsis flex-col gap-1">
      <div class="truncate">
        <NcTooltip
          class="break-word whitespace-nowrap overflow-hidden text-ellipsis pr-1"
          show-on-truncate-only
          :disabled="selected"
        >
          <template #title>
            <slot />
          </template>
          <slot />
        </NcTooltip>
      </div>

      <slot name="time" />
    </div>
    <div
      v-if="resize"
      class="absolute cursor-row-resize w-full bottom-0 w-full h-1"
      @mousedown.stop="emit('resize-start', 'right', $event, record)"
    ></div>
  </div>
</template>

<style lang="scss" scoped>
.cursor-row-resize {
  cursor: ns-resize;
}

.plain-cell {
  line-height: 18px;
  .bold {
    @apply !text-gray-800 font-bold;
  }
}
</style>
