<script lang="ts" setup>
const {
  selectedDate,
  selectedMonth,
  selectedDateRange,
  pageDate,
  activeCalendarView,
  timezoneDayjs,
  isDayAnchoredMode,
  dayAnchoredSpan,
} = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const goToToday = () => {
  $e('c:calendar:calendar-today-btn', activeCalendarView.value)
  selectedDate.value = timezoneDayjs.dayjsTz()
  pageDate.value = timezoneDayjs.dayjsTz()
  selectedMonth.value = timezoneDayjs.dayjsTz()
  selectedDateRange.value = isDayAnchoredMode.value
    ? {
        // Day-anchored modes ('3day', custom + day-unit) anchor on today (not week-aligned).
        start: timezoneDayjs.dayjsTz().startOf('day'),
        end: timezoneDayjs
          .dayjsTz()
          .add(dayAnchoredSpan.value - 1, 'day')
          .endOf('day'),
      }
    : {
        start: timezoneDayjs.dayjsTz().startOf('week'),
        end: timezoneDayjs.dayjsTz().endOf('week'),
      }

  document?.querySelector('.nc-calendar-today')?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}
</script>

<template>
  <NcButton class="today-btn !h-7" data-testid="nc-calendar-today-btn" size="small" type="secondary" @click="goToToday">
    <span class="text-nc-content-gray-subtle font-bold !text-[13px]">
      {{ $t('labels.today') }}
    </span>
  </NcButton>
</template>
