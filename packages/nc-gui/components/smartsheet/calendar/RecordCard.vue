<script lang="ts" setup>
import { CalendarEventTheme } from 'nocodb-sdk'
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

const { eventDisplayTheme } = useCalendarViewStoreOrThrow()

// Resolved colours for this event (rowMeta hex, or neutral gray default).
const colors = computed(() => getCalendarEventColors(props.record))

// Exposed to scoped CSS as custom properties so each theme can style itself
// from the per-record colours (scoped CSS can't take dynamic values directly).
const themeVars = computed(() => ({
  '--cal-accent': colors.value.accent,
  '--cal-tint': colors.value.tint,
  '--cal-border': colors.value.border,
  '--cal-on-accent': colors.value.onAccent,
}))

const isBordered = computed(() => eventDisplayTheme.value === CalendarEventTheme.BORDERED)
const isDot = computed(() => eventDisplayTheme.value === CalendarEventTheme.DOT)
const isPill = computed(() => eventDisplayTheme.value === CalendarEventTheme.PILL)
const isMinimal = computed(() => eventDisplayTheme.value === CalendarEventTheme.MINIMAL)

// Flat themes render a single dense text line; they stack shorter than the
// bordered / solid chips. Height here is kept in sync with `perRecordHeightPx`
// in MonthView (22px flat vs 28px chip).
const isFlat = computed(() =>
  [CalendarEventTheme.DOT, CalendarEventTheme.MINIMAL, CalendarEventTheme.PILL].includes(eventDisplayTheme.value),
)

// The left colour bar belongs to the bordered + minimal themes, and only on the
// card's leading edge (rounded / leftRounded positions of a spanning event).
const showLeftBar = computed(
  () =>
    (isBordered.value || eventDisplayTheme.value === CalendarEventTheme.MINIMAL) &&
    (props.position === 'leftRounded' || props.position === 'rounded'),
)

// Only the bordered theme carries the drop shadow; the flat themes stay flush.
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
      `nc-cal-card nc-cal-card--${eventDisplayTheme}`,
      {
        'h-7': size === 'small' && !isFlat,
        'h-[22px]': size === 'small' && isFlat,
        'h-full': size === 'auto',
        'rounded-l-[4px] !border-r-0 ml-1': position === 'leftRounded' && !multiline,
        'rounded-l-lg !border-r-0 ml-1': position === 'leftRounded' && multiline,
        'rounded-r-[4px] !border-l-0 mr-1': position === 'rightRounded' && !multiline,
        'rounded-r-lg !border-l-0 mr-1': position === 'rightRounded' && multiline,
        'rounded-[4px] ml-0.8 mr-1': position === 'rounded' && !multiline,
        'rounded-lg ml-0.8 mr-1': position === 'rounded' && multiline,
        'rounded-none !border-x-0': position === 'none',
        'nc-cal-card--hover': hover || dragging,
        'nc-cal-card--uncolored': !colors.hasColor,
        'items-start': multiline,
        'items-center': !multiline,
      },
    ]"
    :style="{
      ...themeVars,
      boxShadow: cardShadow,
    }"
  >
    <!-- Minimal makes the bar its defining mark, so it runs the full card height
         (flush); bordered keeps the original short, centred tick. -->
    <div
      v-if="showLeftBar"
      class="nc-cal-leftbar"
      :class="{ 'self-stretch -my-px -ml-px': multiline || isMinimal, 'min-h-6.5': !multiline && !isMinimal }"
    ></div>

    <div
      v-if="(position === 'leftRounded' || position === 'rounded') && resize"
      class="mt-0.7 w-2 h-7.1 -left-1 absolute resize"
      @mousedown.stop="emit('resizeStart', 'left', $event, record)"
    ></div>

    <div class="overflow-hidden gap-2 flex w-full" :class="multiline ? 'items-start py-1' : 'items-center justify-center'">
      <span v-if="(position === 'leftRounded' || position === 'rounded') && isDot" class="nc-cal-dot ml-1.5"></span>
      <span v-if="position === 'rightRounded' || position === 'none'" class="ml-2 mb-0.6"> .... </span>
      <span v-if="isPill && $slots.time" class="nc-cal-time-pill">
        <slot name="time" />
      </span>
      <slot v-else name="time" />
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

.nc-cal-card {
  @apply relative transition-all flex-none flex gap-2 group overflow-hidden;
}

// Left colour bar (bordered + minimal themes).
.nc-cal-leftbar {
  @apply w-1 flex-none;
  background: var(--cal-accent);
}

// Colour dot (dot theme).
.nc-cal-dot {
  @apply w-2 h-2 rounded-full flex-none;
  background: var(--cal-accent);
}

// Time badge (pill theme).
.nc-cal-time-pill {
  @apply inline-flex items-center px-1.5 rounded-full flex-none leading-4;
  background: var(--cal-accent);

  :deep(*) {
    color: var(--cal-on-accent) !important;
  }
}

// --- Themes -----------------------------------------------------------------

.nc-cal-card--bordered {
  @apply border-1;
  // Derive the fill + border from the accent so the chip stays visibly distinct
  // from the bar-only Minimal theme in BOTH light and dark (the row-colouring
  // tint resolves to near-black in dark mode and would read as transparent).
  background: color-mix(in srgb, var(--cal-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--cal-accent) 42%, transparent);

  &.nc-cal-card--hover {
    @apply !bg-nc-bg-gray-light;
  }
}

// Uncoloured events keep the classic white card (not the gray accent wash) so the
// default look matches the pre-theme calendar; hover still goes light-gray.
.nc-cal-card--bordered.nc-cal-card--uncolored {
  background: var(--nc-bg-default);
  border-color: var(--nc-border-gray-dark);
}

.nc-cal-card--solid {
  @apply px-2;
  background: var(--cal-accent);

  // Force every text/icon inside onto the readable on-accent colour.
  :deep(.plain-cell),
  :deep(.plain-cell .bold),
  :deep(span) {
    color: var(--cal-on-accent) !important;
  }

  &.nc-cal-card--hover {
    @apply brightness-95;
  }
}

// Pill / dot text starts at the cell edge otherwise — give a small left inset
// so the time badge / dot doesn't hug the day-cell border.
.nc-cal-card--pill,
.nc-cal-card--dot {
  @apply pl-1;
}

.nc-cal-card--dot,
.nc-cal-card--minimal,
.nc-cal-card--pill {
  @apply bg-transparent;

  &.nc-cal-card--hover {
    @apply !bg-nc-bg-gray-light;
  }
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
