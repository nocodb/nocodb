<script lang="ts" setup>
import dayjs from 'dayjs'
import { computed } from '#imports'

const { selectedDate, selectedMonth, selectedDateRange, activeCalendarView } = useCalendarViewStoreOrThrow()

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
  <div
    :class="{
      'w-23': activeCalendarView === 'month',
      'min-w-42': activeCalendarView === 'week',
      'w-28': activeCalendarView === 'day',
    }"
    class="font-bold text-xl leading-8 text-gray-900 whitespace-nowrap"
    data-testid="nc-calendar-active-date"
  >
    {{ activeCalendarView === 'month' ? headerText.split(' ')[0] : headerText }}
    <template v-if="activeCalendarView === 'month'">
      <span class="!font-semibold">
        {{ ` ${headerText.split(' ')[1]}` }}
      </span>
    </template>
  </div>
</template>

<style lang="scss" scoped></style>
