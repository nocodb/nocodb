<script lang="ts" setup>
interface Props {
  record: Record<string, string>
  color?: string
  resize?: boolean
  selected?: boolean
  hover?: boolean
  dragging?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  resize: true,
  selected: false,
  hover: false,
  color: 'gray',
  dragging: false,
})

const emit = defineEmits(['resizeStart'])

const rowColorInfo = computed(() => {
  return extractRowBackgroundColorStyle(props.record as Row)
})
</script>

<template>
  <div
    :style="{
      boxShadow:
        hover || dragging
          ? '0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06)'
          : '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02)',

      ...rowColorInfo.rowBgColor,
    }"
    :class="{
      'bg-nc-bg-coloured-marooon': color === 'maroon',
      'bg-nc-bg-coloured-blue': color === 'blue',
      'bg-nc-bg-coloured-green': color === 'green',
      'bg-nc-bg-coloured-yellow': color === 'yellow',
      'bg-nc-bg-coloured-pink': color === 'pink',
      'bg-nc-bg-coloured-purple': color === 'purple',
      'bg-nc-bg-default border-nc-border-gray-dark': color === 'gray',
      'z-90': hover,
      '!bg-nc-bg-gray-light': hover || dragging,
    }"
    class="relative flex-none flex gap-1 border-1 rounded-md h-full overflow-hidden"
  >
    <div
      v-if="resize"
      class="absolute w-full h-1 z-20 top-0 cursor-row-resize"
      @mousedown.stop="emit('resizeStart', 'left', $event, record)"
    ></div>
    <div
      :class="{
        'bg-nc-fill-coloured-maroon-medium': props.color === 'maroon',
        'bg-nc-fill-coloured-blue-medium': props.color === 'blue',
        'bg-nc-fill-coloured-green-medium': props.color === 'green',
        'bg-nc-fill-coloured-yellow-medium': props.color === 'yellow',
        'bg-nc-fill-coloured-pink-medium': props.color === 'pink',
        'bg-nc-fill-coloured-purple-medium': props.color === 'purple',
        'bg-nc-gray-900': props.color === 'gray',
      }"
      class="h-full min-h-3 w-1.25 -ml-0.25"
      :style="rowColorInfo.rowLeftBorderColor"
    ></div>

    <div class="flex overflow-x-hidden whitespace-nowrap text-ellipsis pt-1 w-full truncate flex-col gap-1">
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
      @mousedown.stop="emit('resizeStart', 'right', $event, record)"
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
    @apply !text-nc-content-gray font-bold;
  }
}
</style>
