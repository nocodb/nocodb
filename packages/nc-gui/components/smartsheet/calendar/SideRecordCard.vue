<script lang="ts" setup>
import dayjs from 'dayjs'
import { CalendarEventTheme } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

interface Props {
  row?: Record<string, any>
  color?: string
  showDate?: boolean
  calDataType?: string // UITypes.Date or other
}

const props = withDefaults(defineProps<Props>(), {
  color: 'gray',
  showDate: true,
})

const { timezoneDayjs, eventDisplayTheme } = useCalendarViewStoreOrThrow()

const colors = computed(() => getCalendarEventColors(props.row as Row))

const themeVars = computed(() => ({
  '--cal-accent': colors.value.accent,
  '--cal-tint': colors.value.tint,
  '--cal-border': colors.value.border,
  '--cal-on-accent': colors.value.onAccent,
}))

// Pill's only colour cue is its time pill, but the sidebar shows the date as
// plain text (no pill) — so a pill card would render with no colour at all here.
// Fall back to the bordered look (the intentional default) for the sidebar only;
// the grid pill look is untouched.
const sideTheme = computed(() =>
  eventDisplayTheme.value === CalendarEventTheme.PILL ? CalendarEventTheme.BORDERED : eventDisplayTheme.value,
)

const isSolid = computed(() => sideTheme.value === CalendarEventTheme.SOLID)

const isDot = computed(() => sideTheme.value === CalendarEventTheme.DOT)

// The accent bar belongs to bordered + minimal; dot shows a colour dot, solid fills.
const showLeftBar = computed(
  () => sideTheme.value === CalendarEventTheme.BORDERED || sideTheme.value === CalendarEventTheme.MINIMAL,
)

const { t } = useI18n()

// Extract range configuration
const range = computed(() => props.row?.rowMeta?.range)
const fromCol = computed(() => range.value?.fk_from_col)
const toCol = computed(() => range.value?.fk_to_col)

// Extract raw date values
const fromDateRaw = computed(() => (fromCol.value ? props.row?.row?.[fromCol.value.title!] : null))
const toDateRaw = computed(() => (toCol.value ? props.row?.row?.[toCol.value.title!] : null))

// Format dates for display
const fromDate = computed(() => {
  if (!fromDateRaw.value || !fromCol.value) return null

  const timeFormat = is12hrTimeColumn(fromCol.value) ? 'h:mm A' : 'HH:mm'
  const format = props.calDataType === 'Date' ? 'D MMM' : `D MMM • ${timeFormat}`
  return timezoneDayjs.timezonize(fromDateRaw.value).format(format)
})

const toDate = computed(() => {
  if (!toDateRaw.value || !toCol.value || !dayjs(toDateRaw.value)?.isValid()) return null

  const timeFormat = is12hrTimeColumn(toCol.value) ? 'h:mm A' : 'HH:mm'
  const format = props.calDataType === 'Date' ? 'DD MMM' : `DD MMM • ${timeFormat}`
  return timezoneDayjs.timezonize(toDateRaw.value).format(format)
})

// Validation logic
const missingFromDate = computed(() => fromCol.value && !fromDateRaw.value)
const missingToDate = computed(() => toCol.value && !toDateRaw.value)
const missingBothDates = computed(() => missingFromDate.value && missingToDate.value)
const dateOrderError = computed(() => {
  if (!fromCol.value || !toCol.value || !fromDateRaw.value || !toDateRaw.value) return false
  return timezoneDayjs.timezonize(fromDateRaw.value).isAfter(timezoneDayjs.timezonize(toDateRaw.value))
})

// Only invalid if both dates are missing or dates are in wrong order
// Having only one date (start or end) is valid — treated as single-day event
const invalid = computed(() => missingBothDates.value || dateOrderError.value)

const errorInfo = computed(() => {
  const missingFromDate = fromCol.value && !fromDateRaw.value

  const missingToDate = toCol.value && !toDateRaw.value

  const dateOrderError =
    fromCol.value &&
    toCol.value &&
    fromDateRaw.value &&
    toDateRaw.value &&
    timezoneDayjs.timezonize(fromDateRaw.value).isAfter(timezoneDayjs.timezonize(toDateRaw.value))

  if (dateOrderError) {
    return {
      message: t('msg.error.dateError'),
      tooltip: t('msg.error.dateOrderErrorTooltip'),
    }
  }

  if (missingFromDate && missingToDate) {
    return {
      message: t('msg.error.missingDates'),
      tooltip: t('msg.error.missingDatesTooltip'),
    }
  }

  return {
    message: t('msg.error.invalidRecord'),
    tooltip: t('msg.error.invalidRecordTooltip'),
  }
})
</script>

<template>
  <div
    :class="[`nc-side-card--${sideTheme}`, { 'nc-side-card--uncolored': !colors.hasColor }]"
    :style="themeVars"
    class="nc-side-card cursor-pointer h-12.5 flex-none flex gap-2 flex-col rounded-lg overflow-hidden"
  >
    <div class="flex relative items-center gap-2">
      <span v-if="showLeftBar" class="nc-side-card-leftbar block h-12 w-1"></span>
      <!-- Align the dot with the first line (title), matching the calendar view's
           dot theme: a box the height of the title line (leading-4 → h-4), offset
           by the body's top padding (py-1) and centred, so it sits on the title
           rather than the middle of the 2-line card. -->
      <span v-else-if="isDot" class="self-start mt-1 h-4 ml-2 flex items-center flex-none">
        <span class="nc-side-card-dot"></span>
      </span>
      <slot name="image" />
      <div class="flex gap-1 py-1 flex-col" :class="{ 'pl-2': isSolid }">
        <NcTooltip
          wrap-child="span"
          :disabled="!$slots.tooltip"
          overlay-class-name="nc-record-fields-tooltip"
          :class="{
            '!max-w-35': invalid,
          }"
          class="text-[13px] leading-4 max-w-56 font-medium truncate text-nc-content-gray"
        >
          <template #title>
            <slot name="tooltip" />
          </template>
          <slot />
        </NcTooltip>
        <NcTooltip v-if="invalid" placement="left" class="top-1 absolute right-1">
          <NcBadge color="red" :border="false" class="!h-5">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="warning" class="text-nc-content-red-medium !h-4 !w-4" />
              <span class="font-normal text-xs">{{ errorInfo.message }}</span>
            </div>
          </NcBadge>
          <template #title>
            {{ errorInfo.tooltip }}
          </template>
        </NcTooltip>
        <NcTooltip
          v-if="showDate"
          show-on-truncate-only
          class="nc-side-card-date text-xs font-medium truncate max-w-58 leading-4 text-nc-content-gray-subtle2"
        >
          {{
            fromDate && toDate
              ? `${fromDate} - ${toDate}`
              : fromDate && toCol
              ? `${fromDate} -`
              : toDate && fromCol
              ? `- ${toDate}`
              : fromDate || toDate || ''
          }}
          <template #title>
            {{
              fromDate && toDate
                ? `${fromDate} - ${toDate}`
                : fromDate && toCol
                ? `${fromDate} -`
                : toDate && fromCol
                ? `- ${toDate}`
                : fromDate || toDate || ''
            }}
          </template>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-side-card-leftbar {
  background: var(--cal-accent);
}

.nc-side-card-dot {
  @apply w-2 h-2 rounded-full;
  background: var(--cal-accent);
}

// Bordered — accent-derived tint + border (stays visible in dark mode, where the
// row-colouring tint resolves to near-black; see RecordCard for rationale).
.nc-side-card--bordered {
  @apply border-1;
  background: color-mix(in srgb, var(--cal-accent) 14%, transparent);
  border-color: color-mix(in srgb, var(--cal-accent) 42%, transparent);
}

// Uncoloured events keep the classic white card (not the gray accent wash) so the
// default look matches the pre-theme calendar.
.nc-side-card--bordered.nc-side-card--uncolored {
  background: var(--nc-bg-default);
  border-color: var(--nc-border-gray-medium);
}

// Solid — fill, readable text on the accent.
.nc-side-card--solid {
  background: var(--cal-accent);

  :deep(.nc-side-card-date),
  :deep(span) {
    color: var(--cal-on-accent) !important;
  }
}

// Flat themes — transparent, marker only (bar for minimal, dot for dot, nothing
// for pill — matches the month-view RecordCard look).
.nc-side-card--minimal,
.nc-side-card--dot,
.nc-side-card--pill {
  @apply bg-transparent border-1 border-transparent;
}
</style>
