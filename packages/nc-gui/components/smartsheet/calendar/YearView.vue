<script lang="ts" setup>
import type dayjs from 'dayjs'

const { selectedDate, activeDates, activeCalendarView } = useCalendarViewStoreOrThrow()

const months = computed(() => {
  const months = []
  for (let i = 0; i < 12; i++) {
    months.push(selectedDate.value.set('month', i).set('date', 1))
  }
  return months
})

const calendarContainer = ref<HTMLElement | null>(null)

const { width } = useWindowSize()

const size = ref('small')

const handleResize = () => {
  if (width.value < 1608) {
    size.value = 'small'
  } else if (width.value < 2000) {
    size.value = 'medium'
  } else {
    size.value = 'large'
  }
}

const changeView = (date: dayjs.Dayjs) => {
  selectedDate.value = date
  activeCalendarView.value = 'day'
}

onMounted(() => {
  handleResize()
})

watch(width, handleResize)
</script>

<template>
  <div ref="calendarContainer" class="overflow-auto flex my-2 justify-center nc-scrollbar-md">
    <div
      :class="{
        '!gap-12': size === 'large',
      }"
      class="grid grid-cols-4 justify-items-center gap-6 scale-1"
      data-testid="nc-calendar-year-view"
    >
      <NcDateWeekSelector
        v-for="(_, index) in months"
        :key="index"
        v-model:active-dates="activeDates"
        v-model:page-date="months[index]"
        v-model:selected-date="selectedDate"
        :size="size"
        class="nc-year-view-calendar"
        data-testid="nc-calendar-year-view-month-selector"
        disable-pagination
        @dbl-click="changeView"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-year-view-calendar {
  :deep(.nc-date-week-header) {
    @apply border-gray-200;
  }
}
</style>
