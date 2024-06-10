<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed } from '#imports'

const { selectedDate, selectedMonth, selectedDateRange, activeCalendarView, paginateCalendarView, activeDates, pageDate } =
  useCalendarViewStoreOrThrow()

const calendarRangeDropdown = ref(false)

const headerText = computed(() => {
  switch (activeCalendarView.value) {
    case 'day':
      return dayjs(selectedDate.value).format('D MMM YYYY')
    case 'week':
      if (selectedDateRange.value.start.isSame(selectedDateRange.value.end, 'month')) {
        return `${selectedDateRange.value.start.format('D')} - ${selectedDateRange.value.end.format('D MMM YY')}`
      } else if (selectedDateRange.value.start.isSame(selectedDateRange.value.end, 'year')) {
        return `${selectedDateRange.value.start.format('D MMM')} - ${selectedDateRange.value.end.format('D MMM YY')}`
      } else {
        return `${selectedDateRange.value.start.format('D MMM YY')} - ${selectedDateRange.value.end.format('D MMM YY')}`
      }
    case 'month':
      return dayjs(selectedMonth.value).format('MMM YYYY')
    case 'year':
      return dayjs(selectedDate.value).format('YYYY')
    default:
      return ''
  }
})
</script>

<template>
  <div class="flex gap-1">
    <NcTooltip>
      <template #title> {{ $t('labels.previous') }}</template>
      <a-button
        v-e="`['c:calendar:calendar-${activeCalendarView}-prev-btn']`"
        class="w-6 h-6 prev-next-btn !hover:text-gray-700 transition-all !rounded-lg flex items-center justify-center !bg-gray-100 !border-0"
        data-testid="nc-calendar-prev-btn"
        size="small"
        @click="paginateCalendarView('prev')"
      >
        <component :is="iconMap.arrowLeft" class="h-4 !mb-0.9 !-ml-0.8 w-4" />
      </a-button>
    </NcTooltip>

    <NcDropdown v-model:visible="calendarRangeDropdown" :auto-close="false" :trigger="['click']">
      <NcButton
        :class="{
          'w-20': activeCalendarView === 'year',
          'w-26.5': activeCalendarView === 'month',
          'w-29': activeCalendarView === 'day',
          'w-38': activeCalendarView === 'week',
        }"
        class="!h-6 prev-next-btn !bg-gray-100 !border-0"
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
            size="medium"
          />
          <NcDateWeekSelector
            v-else-if="activeCalendarView === ('week' as const)"
            v-model:active-dates="activeDates"
            v-model:page-date="pageDate"
            v-model:selected-week="selectedDateRange"
            is-week-picker
            size="medium"
          />
          <NcMonthYearSelector
            v-else-if="activeCalendarView === ('month' as const)"
            v-model:page-date="pageDate"
            v-model:selected-date="selectedMonth"
            size="medium"
          />
          <NcMonthYearSelector
            v-else-if="activeCalendarView === ('year' as const)"
            v-model:page-date="pageDate"
            v-model:selected-date="selectedDate"
            is-year-picker
            size="medium"
          />
        </div>
      </template>
    </NcDropdown>
    <NcTooltip>
      <template #title> {{ $t('labels.next') }}</template>
      <a-button
        v-e="`['c:calendar:calendar-${activeCalendarView}-next-btn']`"
        class="w-6 h-6 !rounded-lg flex items-center !hover:text-gray-700 prev-next-btn !bg-gray-100 !border-0 justify-center"
        data-testid="nc-calendar-next-btn"
        size="small"
        @click="paginateCalendarView('next')"
      >
        <component :is="iconMap.arrowRight" class="h-4 !mb-0.8 !-ml-0.5 w-4" />
      </a-button>
    </NcTooltip>
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
