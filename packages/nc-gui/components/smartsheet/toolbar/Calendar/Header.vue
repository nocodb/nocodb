<script lang="ts" setup>
import type dayjs from 'dayjs'
import { computed } from '#imports'

const {
  selectedDate,
  selectedMonth,
  selectedDateRange,
  activeCalendarView,
  activeDates,
  timezone,
  pageDate,
  timezoneDayjs,
  weeksInRange,
  isDayAnchoredMode,
  dayAnchoredSpan,
  isMultiWeekRange,
} = useCalendarViewStoreOrThrow()

const { isMobileMode } = useGlobal()

const calendarRangeDropdown = ref(false)

// Day-anchored modes ('3day', custom + day-unit) anchor on a single day; the picker
// selects the first visible day and the window spans that day + (N-1).
const dayAnchoredDate = computed<dayjs.Dayjs>({
  get: () => timezoneDayjs.timezonize(selectedDateRange.value.start),
  set: (date: dayjs.Dayjs) => {
    const start = date.startOf('day')
    // Keep the canonical cursors aligned with the visible window so the
    // active-date dots and any later mode switch don't read a stale day.
    selectedDate.value = start
    if (pageDate.value.month() !== start.month()) pageDate.value = start
    selectedDateRange.value = {
      start,
      end: start.add(dayAnchoredSpan.value - 1, 'day').endOf('day'),
    }
  },
})

const formatWeekRange = (startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) => {
  if (startDate.isSame(endDate, 'month')) {
    return `${startDate.format('D')} - ${endDate.format('D MMM YY')}`
  } else if (startDate.isSame(endDate, 'year')) {
    return `${startDate.format('D MMM')} - ${endDate.format('D MMM YY')}`
  } else {
    return `${startDate.format('D MMM YY')} - ${endDate.format('D MMM YY')}`
  }
}

const headerText = computed(() => {
  // On mobile the toolbar is tight, so show a compact label — the grid's column headers
  // already spell out the full visible range.
  if (isMobileMode.value) {
    switch (activeCalendarView.value) {
      case 'day':
        return timezoneDayjs.timezonize(selectedDate.value).format('D MMM')
      case '3day':
      case 'week':
      case '2week':
      case '6week':
        return timezoneDayjs.timezonize(selectedDateRange.value.start).format('D MMM')
      case 'month':
        return timezoneDayjs.timezonize(selectedMonth.value).format('MMM YY')
      case 'year':
        return timezoneDayjs.timezonize(selectedDate.value).format('YYYY')
      default:
        return ''
    }
  }

  switch (activeCalendarView.value) {
    case 'day':
      return timezoneDayjs.timezonize(selectedDate.value).format('D MMM YYYY')
    case '3day': {
      const startDate = timezoneDayjs.timezonize(selectedDateRange.value.start)
      return formatWeekRange(startDate, startDate.add(2, 'day'))
    }
    case 'week': {
      const startDate = timezoneDayjs.timezonize(selectedDateRange.value.start)
      const endDate = timezoneDayjs.timezonize(selectedDateRange.value.end)
      return formatWeekRange(startDate, endDate)
    }
    case '2week':
    case '6week': {
      const startDate = timezoneDayjs.timezonize(selectedDateRange.value.start)
      const endDate = startDate.add(weeksInRange.value * 7 - 1, 'day')
      return formatWeekRange(startDate, endDate)
    }
    case 'custom': {
      const startDate = timezoneDayjs.timezonize(selectedDateRange.value.start)
      const span = isDayAnchoredMode.value ? dayAnchoredSpan.value : weeksInRange.value * 7
      return formatWeekRange(startDate, startDate.add(span - 1, 'day'))
    }
    case 'month':
      return timezoneDayjs.timezonize(selectedMonth.value).format('MMM YYYY')
    case 'year':
      return timezoneDayjs.timezonize(selectedDate.value).format('YYYY')
    default:
      return ''
  }
})
</script>

<template>
  <div class="flex gap-1">
    <NcDropdown v-model:visible="calendarRangeDropdown" :auto-close="false" :trigger="['click']">
      <NcButton
        :class="
          isMobileMode
            ? '!w-auto !max-w-[7.5rem]'
            : {
                'w-20': activeCalendarView === 'year',
                'w-26.5': activeCalendarView === 'month',
                'w-29': activeCalendarView === 'day',
                'w-38':
                  activeCalendarView === 'week' ||
                  activeCalendarView === '3day' ||
                  activeCalendarView === '2week' ||
                  activeCalendarView === '6week' ||
                  activeCalendarView === 'custom',
              }
        "
        class="prev-next-btn !h-7"
        full-width
        size="small"
        type="secondary"
      >
        <div class="flex w-full px-1 items-center justify-between gap-1">
          <span
            :class="{
              'max-w-38 truncate':
                !isMobileMode &&
                (activeCalendarView === 'week' ||
                  activeCalendarView === '3day' ||
                  activeCalendarView === '2week' ||
                  activeCalendarView === '6week'),
              'truncate': isMobileMode || activeCalendarView === 'custom',
            }"
            class="font-bold text-[13px] text-center text-nc-content-gray"
            data-testid="nc-calendar-active-date"
            >{{ headerText }}</span
          >
          <div class="flex-1" />
          <component :is="iconMap.arrowDown" class="h-4 min-w-4 text-nc-content-gray-subtle" />
        </div>
      </NcButton>

      <template #overlay>
        <div v-if="calendarRangeDropdown" class="w-[287px] pb-2" @click.stop>
          <NcDateWeekSelector
            v-if="activeCalendarView === ('day' as const)"
            v-model:active-dates="activeDates"
            v-model:page-date="pageDate"
            v-model:selected-date="selectedDate"
            :timezone="timezone"
            header="v2"
            size="medium"
          />
          <NcDateWeekSelector
            v-else-if="isDayAnchoredMode"
            v-model:active-dates="activeDates"
            v-model:page-date="pageDate"
            v-model:selected-date="dayAnchoredDate"
            :timezone="timezone"
            header="v2"
            size="medium"
          />
          <NcDateWeekSelector
            v-else-if="activeCalendarView === ('week' as const) || isMultiWeekRange"
            v-model:active-dates="activeDates"
            v-model:page-date="pageDate"
            v-model:selected-week="selectedDateRange"
            :timezone="timezone"
            is-week-picker
            header="v2"
            size="medium"
          />
          <NcMonthYearSelector
            v-else-if="activeCalendarView === ('month' as const)"
            v-model:page-date="pageDate"
            v-model:selected-date="selectedMonth"
            :timezone="timezone"
            header="v2"
            size="medium"
          />
          <NcMonthYearSelector
            v-else-if="activeCalendarView === ('year' as const)"
            v-model:page-date="pageDate"
            v-model:selected-date="selectedDate"
            :timezone="timezone"
            header="v2"
            is-year-picker
            size="medium"
          />
        </div>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped>
.nc-cal-toolbar-header {
  @apply !h-6 !w-6;
}

.prev-next-btn {
  @apply !hover:bg-nc-bg-gray-medium;
}
</style>
