<script lang="ts" setup>
const { selectedDate, selectedMonth, selectedDateRange, pageDate, activeCalendarView, timezoneDayjs } =
  useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const goToToday = () => {
  $e('c:calendar:calendar-today-btn', activeCalendarView.value)
  selectedDate.value = timezoneDayjs.dayjsTz()
  pageDate.value = timezoneDayjs.dayjsTz()
  selectedMonth.value = timezoneDayjs.dayjsTz()
  selectedDateRange.value = {
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
  <NcButton
    class="!border-0 !h-6 today-btn !bg-gray-100"
    data-testid="nc-calendar-today-btn"
    size="small"
    type="secondary"
    @click="goToToday"
  >
    <span class="text-gray-700 !text-[13px]">
      {{ $t('labels.today') }}
    </span>
  </NcButton>
</template>

<style lang="scss" scoped>
.today-btn {
  @apply !hover:bg-gray-200;
}
</style>
