<script lang="ts" setup>
import { CalendarEventTheme } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

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

const { eventDisplayTheme } = useCalendarViewStoreOrThrow()

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

const colors = computed(() => getCalendarEventColors(props.record as Row))

const themeVars = computed(() => ({
  '--cal-accent': colors.value.accent,
  '--cal-tint': colors.value.tint,
  '--cal-border': colors.value.border,
  '--cal-on-accent': colors.value.onAccent,
}))

const isBordered = computed(() => eventDisplayTheme.value === CalendarEventTheme.BORDERED)

const isSolid = computed(() => eventDisplayTheme.value === CalendarEventTheme.SOLID)

const isPill = computed(() => eventDisplayTheme.value === CalendarEventTheme.PILL)

const isDot = computed(() => eventDisplayTheme.value === CalendarEventTheme.DOT)

const isMinimal = computed(() => eventDisplayTheme.value === CalendarEventTheme.MINIMAL)

// Match the month-view (RecordCard) look in every timeline view: the left accent
// bar belongs to the bordered + minimal themes; dot shows a colour dot, pill is
// flat text with a colour time pill, and solid fills edge-to-edge.
const showLeftBar = computed(() => isBordered.value || isMinimal.value)

// Only the bordered theme carries the drop shadow (mirrors RecordCard); the flat
// themes (dot / minimal / pill) and solid stay flush.
const cardShadow = computed(() => {
  if (!isBordered.value) return undefined
  return props.hover || props.dragging
    ? '0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06)'
    : '0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02)'
})
</script>

<template>
  <div
    :class="[
      `nc-vcard nc-vcard--${eventDisplayTheme}`,
      {
        'nc-vcard--hover': hover || dragging,
        'nc-vcard--uncolored': !colors.hasColor,
        'z-90': hover,
      },
    ]"
    :style="{
      ...themeVars,
      boxShadow: cardShadow,
    }"
    class="relative flex-none flex gap-1 rounded-md h-full overflow-hidden"
  >
    <div
      v-if="resize"
      class="absolute w-full h-1 z-20 top-0 cursor-row-resize"
      @mousedown.stop="emit('resizeStart', 'left', $event, record)"
    ></div>
    <div v-if="showLeftBar" class="nc-vcard-leftbar h-full min-h-3 w-1.25 -ml-0.25"></div>
    <span v-else-if="isDot" class="nc-vcard-dot self-start mt-1.5 ml-1 flex-none"></span>

    <div
      class="flex pt-1 w-full flex-col gap-1 overflow-hidden h-full"
      :class="[{ 'overflow-x-hidden whitespace-nowrap text-ellipsis truncate': !isMultiline }, isSolid ? 'pr-1' : '']"
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
        <span v-if="isPill && $slots.time" class="nc-vcard-time-pill">
          <slot name="time" />
        </span>
        <slot v-else name="time" />
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

.nc-vcard-leftbar {
  background: var(--cal-accent);
}

.nc-vcard-dot {
  @apply w-2 h-2 rounded-full flex-none;
  background: var(--cal-accent);
}

.nc-vcard-time-pill {
  @apply inline-flex items-center px-1.5 rounded-full leading-4;
  background: var(--cal-accent);

  :deep(*) {
    color: var(--cal-on-accent) !important;
  }
}

// Bordered — accent-derived tint + border (stays visible in dark mode, where the
// row-colouring tint resolves to near-black; see RecordCard for rationale).
.nc-vcard--bordered {
  @apply border-1;
  background: color-mix(in srgb, var(--cal-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--cal-accent) 42%, transparent);

  &.nc-vcard--hover {
    @apply !bg-nc-bg-gray-light;
  }
}

// Uncoloured events keep the classic white card (not the gray accent wash) so the
// default look matches the pre-theme calendar; hover still goes light-gray.
.nc-vcard--bordered.nc-vcard--uncolored {
  background: var(--nc-bg-default);
  border-color: var(--nc-border-gray-dark);
}

// Solid — fill edge-to-edge, readable text on the accent.
.nc-vcard--solid {
  background: var(--cal-accent);

  :deep(.plain-cell),
  :deep(.plain-cell .bold),
  :deep(span) {
    color: var(--cal-on-accent) !important;
  }

  &.nc-vcard--hover {
    @apply brightness-95;
  }
}

// Flat themes — transparent block. Dot shows a colour dot, minimal a left bar,
// pill a colour time pill (matches the month-view RecordCard look).
.nc-vcard--minimal,
.nc-vcard--dot,
.nc-vcard--pill {
  @apply bg-transparent;

  &.nc-vcard--hover {
    @apply !bg-nc-bg-gray-light;
  }
}

// Pill has no bar/dot, so inset the text slightly off the cell edge.
.nc-vcard--pill {
  @apply pl-1;
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
