<script lang="ts" setup>
import { computed } from '#imports'

const {
  selectedDate,
  selectedMonth,
  selectedDateRange,
  activeCalendarView,
  paginateCalendarView,
  activeDates,
  timezone,
  pageDate,
  timezoneDayjs,
} = useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

const headerText = computed(() => {
  switch (activeCalendarView.value) {
    case 'day':
      return timezoneDayjs.timezonize(selectedDate.value).format('D MMM YYYY')
    case 'week': {
      const startDate = timezoneDayjs.timezonize(selectedDateRange.value.start)
      const endDate = timezoneDayjs.timezonize(selectedDateRange.value.end)
      if (startDate.isSame(endDate, 'month')) {
        return `${startDate.format('D')} - ${endDate.format('D MMM YY')}`
      } else if (startDate.isSame(endDate, 'year')) {
        return `${startDate.format('D MMM')} - ${endDate.format('D MMM YY')}`
      } else {
        return `${startDate.format('D MMM YY')} - ${endDate.format('D MMM YY')}`
      }
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
          'w-38': activeCalendarView === 'week',
        }"
        class="prev-next-btn !h-7"
        full-width
        size="small"
        type="secondary"
      >
        <div class="flex w-full px-1 items-center justify-between">
          <span
            :class="{
              'max-w-38 truncate': activeCalendarView === 'week',
            }"
            class="font-bold text-[13px] text-center text-gray-800"
            data-testid="nc-calendar-active-date"
            >{{ headerText }}</span
          >
          <div class="flex-1" />
          <component :is="iconMap.arrowDown" class="h-4 min-w-4 text-gray-700" />
        </div>
      </NcButton>

      <template #overlay>
        <div v-if="calendarRangeDropdown" class="w-[287px]" @click.stop>
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
            v-else-if="activeCalendarView === ('week' as const)"
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
  @apply !hover:bg-gray-200;
}
</style>
