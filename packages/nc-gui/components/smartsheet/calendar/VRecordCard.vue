<script lang="ts" setup>
interface Props {
  record: Record<string, string>
  color?: string
  resize?: boolean
  selected?: boolean
  hover?: boolean
  dragging?: boolean
  // Max number of title lines that fit in this card (derived from card height by
  // the time-grid week/day views). >= 2 switches the body to multi-line wrap:
  // the title wraps and is clamped to this many lines with a trailing ellipsis.
  // 1 (or unset) keeps the single-line + tooltip layout for short cards.
  clampLines?: number
}

const props = withDefaults(defineProps<Props>(), {
  resize: true,
  selected: false,
  hover: false,
  color: 'gray',
  dragging: false,
  clampLines: 1,
})

const emit = defineEmits(['resizeStart'])

// Wrap (multi-line) only when the card is tall enough for 2+ lines.
const isMultiline = computed(() => (props.clampLines ?? 1) >= 2)

// Multi-line clamp applied INLINE: the build's PostCSS strips `display:
// -webkit-box` / `-webkit-box-orient` from scoped CSS, so inline is the only
// reliable way to get a wrapped title that ends in an ellipsis at the last
// fitting line. Must sit on a natural-height element (not a flex-1 sizer) — a
// stretched box defeats the clamp and the ellipsis never shows.
const clampStyle = computed(() =>
  isMultiline.value
    ? {
        'display': '-webkit-box',
        'WebkitBoxOrient': 'vertical',
        'WebkitLineClamp': `${props.clampLines}`,
        'overflow': 'hidden',
        'overflow-wrap': 'anywhere',
      }
    : undefined,
)

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
      'bg-nc-maroon-50': props.color === 'maroon',
      'bg-nc-blue-50': props.color === 'blue',
      'bg-nc-green-50': props.color === 'green',
      'bg-nc-yellow-50': props.color === 'yellow',
      'bg-nc-pink-50': props.color === 'pink',
      'bg-nc-purple-50': props.color === 'purple',
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
        'bg-nc-maroon-500': props.color === 'maroon',
        'bg-nc-blue-500': props.color === 'blue',
        'bg-nc-green-500': props.color === 'green',
        'bg-nc-yellow-500': props.color === 'yellow',
        'bg-nc-pink-500': props.color === 'pink',
        'bg-nc-purple-500': props.color === 'purple',
        'bg-nc-gray-900': props.color === 'gray',
      }"
      class="h-full min-h-3 w-1.25 -ml-0.25"
      :style="rowColorInfo.rowLeftBorderColor"
    ></div>

    <div
      class="flex pt-1 w-full flex-col gap-1 overflow-hidden h-full"
      :class="{ 'overflow-x-hidden whitespace-nowrap text-ellipsis truncate': !isMultiline }"
    >
      <NcTooltip
        wrap-child="div"
        hide-on-click
        disable-in-mobile
        :disabled="selected || dragging"
        overlay-class-name="nc-record-fields-tooltip"
        show-on-truncate-only
        :line-clamp="isMultiline ? clampLines : undefined"
        :style="clampStyle"
        :class="
          isMultiline
            ? 'nc-calendar-vcard-wrap w-full overflow-hidden'
            : 'nc-calendar-vcard-inline truncate w-full overflow-hidden'
        "
      >
        <template #title>
          <slot name="tooltip">
            <slot />
          </slot>
        </template>
        <slot />
      </NcTooltip>

      <div class="flex-shrink-0 mt-auto">
        <slot name="time" />
      </div>
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

// Wrap mode (tall DateTime cards, week/day time-grid): the actual clamp
// (display: -webkit-box + -webkit-line-clamp) is applied inline via clampStyle —
// the build strips those props from scoped CSS. Here we only pin the line height
// (so the per-card line count lines up) and emphasise the lead/title field.
.nc-calendar-vcard-wrap {
  line-height: 18px;
}

.nc-calendar-vcard-wrap :deep(.plain-cell:first-child) {
  @apply text-nc-content-gray font-semibold;
}
</style>
