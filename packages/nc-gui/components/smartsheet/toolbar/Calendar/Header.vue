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
} = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

// 3-day mode anchors on a single day; the picker selects the first visible day
// and the window spans that day + 2.
const threeDayDate = computed<dayjs.Dayjs>({
  get: () => timezoneDayjs.timezonize(selectedDateRange.value.start),
  set: (date: dayjs.Dayjs) => {
    selectedDateRange.value = {
      start: date.startOf('day'),
      end: date.add(2, 'day').endOf('day'),
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
        :class="{
          'w-20': activeCalendarView === 'year',
          'w-26.5': activeCalendarView === 'month',
          'w-29': activeCalendarView === 'day',
          'w-38':
            activeCalendarView === 'week' ||
            activeCalendarView === '3day' ||
            activeCalendarView === '2week' ||
            activeCalendarView === '6week',
        }"
        class="prev-next-btn !h-7"
        full-width
        size="small"
        type="secondary"
      >
        <div class="flex w-full px-1 items-center justify-between">
          <span
            :class="{
              'max-w-38 truncate':
                activeCalendarView === 'week' ||
                activeCalendarView === '3day' ||
                activeCalendarView === '2week' ||
                activeCalendarView === '6week',
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
            v-else-if="activeCalendarView === ('3day' as const)"
            v-model:active-dates="activeDates"
            v-model:page-date="pageDate"
            v-model:selected-date="threeDayDate"
            :timezone="timezone"
            header="v2"
            size="medium"
          />
          <NcDateWeekSelector
            v-else-if="
              activeCalendarView === ('week' as const) ||
              activeCalendarView === ('2week' as const) ||
              activeCalendarView === ('6week' as const)
            "
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
