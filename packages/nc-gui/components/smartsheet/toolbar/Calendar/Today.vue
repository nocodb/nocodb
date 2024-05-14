<script lang="ts" setup>
import dayjs from 'dayjs'

const { selectedDate, selectedMonth, selectedDateRange, pageDate, activeCalendarView } = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const goToToday = () => {
  $e('c:calendar:calendar-today-btn', activeCalendarView.value)
  selectedDate.value = dayjs()
  pageDate.value = dayjs()
  selectedMonth.value = dayjs()
  selectedDateRange.value = {
    start: dayjs().startOf('week'),
    end: dayjs().endOf('week'),
  }

  document?.querySelector('.nc-calendar-today')?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  })
}
</script>

<template>
  <NcButton class="!border-0 !h-7" data-testid="nc-calendar-today-btn" size="small" type="secondary" @click="goToToday">
    <span class="text-gray-600 !text-[13px]">
      {{ $t('labels.today') }}
    </span>
  </NcButton>
</template>

<style lang="scss" scoped></style>
