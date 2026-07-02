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
  // When true the card fills its container height and stacks visible fields over
  // multiple lines (week view) instead of clamping to a single truncated line.
  multiline?: boolean
  // Multiline cards hide fields behind "+N more"; when the parent signals there
  // are hidden fields, show the tooltip on hover (column layout never trips the
  // truncate detector, so there's nothing else to gate on).
  hasHiddenFields?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  resize: true,
  hover: false,
  color: 'gray',
  size: 'small',
  position: 'rounded',
  dragging: false,
  multiline: false,
  hasHiddenFields: false,
})

const emit = defineEmits(['resizeStart'])

const rowColorInfo = computed(() => {
  return extractRowBackgroundColorStyle(props.record as Row)
})
</script>

<template>
  <div
    :class="{
      'h-7': size === 'small',
      'h-full': size === 'auto',
      'rounded-l-[4px] !border-r-0 ml-1': position === 'leftRounded' && !multiline,
      'rounded-l-lg !border-r-0 ml-1': position === 'leftRounded' && multiline,
      'rounded-r-[4px] !border-l-0 mr-1': position === 'rightRounded' && !multiline,
      'rounded-r-lg !border-l-0 mr-1': position === 'rightRounded' && multiline,
      'rounded-[4px] ml-0.8 mr-1': position === 'rounded' && !multiline,
      'rounded-lg ml-0.8 mr-1': position === 'rounded' && multiline,
      'rounded-none !border-x-0': position === 'none',
      'bg-nc-maroon-50': props.color === 'maroon',
      'bg-nc-blue-50': props.color === 'blue',
      'bg-nc-green-50': props.color === 'green',
      'bg-nc-yellow-50': props.color === 'yellow',
      'bg-nc-pink-50': props.color === 'pink',
      'bg-nc-purple-50': props.color === 'purple',
      'bg-nc-bg-default border-nc-border-gray-dark': color === 'gray',
      '!bg-nc-bg-gray-light': hover || dragging,
      'items-start': multiline,
      'items-center': !multiline,
    }"
    :style="{
      boxShadow:
        hover || dragging
          ? '0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06)'
          : '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02)',

      ...rowColorInfo.rowBgColor,
    }"
    class="relative transition-all border-1 flex-none flex gap-2 group overflow-hidden"
  >
    <div
      v-if="position === 'leftRounded' || position === 'rounded'"
      :class="{
        'bg-nc-maroon-500': props.color === 'maroon',
        'bg-nc-blue-500': props.color === 'blue',
        'bg-nc-green-500': props.color === 'green',
        'bg-nc-yellow-500': props.color === 'yellow',
        'bg-nc-pink-500': props.color === 'pink',
        'bg-nc-purple-500': props.color === 'purple',
        'bg-nc-gray-900': color === 'gray',
        // Multiline: full-height colored left edge pulled flush to the card
        // border (-my-px/-ml-px); the card's overflow-hidden + radius clips its
        // corners to follow the rounding. No explicit rounding here, so the
        // strip stays a consistent width on short and tall cards alike.
        'self-stretch -my-px -ml-px': multiline,
        // Single-line: original short centered bar.
        'min-h-6.5': !multiline,
      }"
      class="w-1"
      :style="rowColorInfo.rowLeftBorderColor"
    ></div>

    <div
      v-if="(position === 'leftRounded' || position === 'rounded') && resize"
      class="mt-0.7 w-2 h-7.1 -left-1 absolute resize"
      @mousedown.stop="emit('resizeStart', 'left', $event, record)"
    ></div>

    <div class="overflow-hidden gap-2 flex w-full" :class="multiline ? 'items-start py-1' : 'items-center justify-center'">
      <span v-if="position === 'rightRounded' || position === 'none'" class="ml-2 mb-0.6"> .... </span>
      <slot name="time" />
      <div
        :class="[{ 'pr-8.5': position === 'leftRounded' }, multiline ? 'overflow-hidden' : 'mb-0.5 overflow-x-hidden truncate']"
        class="flex w-full flex-col gap-1"
      >
        <!-- Multiline (all-day week): stacked fields; tooltip reveals the full
             labeled record, only when a field line is actually clipped. The
             inner .nc-calendar-card-fields div is kept so its scoped no-bullet
             styling applies (the body must render exactly as before). -->
        <NcTooltip
          v-if="multiline"
          wrap-child="div"
          hide-on-click
          disable-in-mobile
          :disabled="selected || dragging || !hasHiddenFields"
          overlay-class-name="nc-record-fields-tooltip"
          class="w-full overflow-hidden"
        >
          <template #title>
            <slot name="tooltip">
              <slot />
            </slot>
          </template>
          <div class="nc-calendar-card-fields flex flex-col gap-0.5 w-full overflow-hidden">
            <slot />
          </div>
        </NcTooltip>
        <!-- Single-line: prod behaviour — tooltip only when the text is clipped. -->
        <NcTooltip
          v-else
          hide-on-click
          disable-in-mobile
          :disabled="selected || dragging"
          overlay-class-name="nc-record-fields-tooltip"
          show-on-truncate-only
          wrap-child="span"
          class="break-word whitespace-nowrap overflow-hidden pr-1"
          :class="{ 'text-ellipsis': ['leftRounded', 'rightRounded', 'rounded'].includes(position) }"
        >
          <slot class="text-sm text-nowrap text-nc-content-gray leading-7" />
          <template #title>
            <slot name="tooltip">
              <slot />
            </slot>
          </template>
        </NcTooltip>
      </div>
      <span v-if="position === 'leftRounded' || position === 'none'" class="absolute mb-0.6 z-10 right-5"> ... </span>
    </div>

    <div
      v-if="(position === 'rightRounded' || position === 'rounded') && resize"
      class="absolute mt-0.3 h-7.1 w-2 right-0 resize"
      @mousedown.stop="emit('resizeStart', 'right', $event, record)"
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
    @apply !text-nc-content-gray font-bold;
  }
}

// In multiline mode each visible field is its own clean truncated line.
// Drop the inline "•" separators (meant for the single-line layout), give the
// lead field gentle emphasis and mute the rest — reads as a record card, not a
// run-on of values.
.nc-calendar-card-fields :deep(.plain-cell) {
  @apply truncate w-full leading-5 text-bodySm text-nc-content-gray-subtle;

  &::before {
    content: '' !important;
    padding: 0 !important;
  }
}

.nc-calendar-card-fields :deep(.plain-cell:first-child) {
  @apply text-nc-content-gray font-semibold;
}
</style>
