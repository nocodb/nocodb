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

const { width } = useElementSize(calendarContainer)

const size = ref<'small' | 'medium'>('small')
const cols = ref(4)

const handleResize = () => {
  if (width.value > 1250) {
    size.value = 'medium'
    cols.value = 4
  } else if (width.value > 950) {
    size.value = 'medium'
    cols.value = 3
  } else if (width.value > 680) {
    size.value = 'small'
    cols.value = 3
  } else if (width.value > 375) {
    size.value = 'small'
    cols.value = 2
  } else {
    size.value = 'medium'
    cols.value = 1
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
  <div ref="calendarContainer" class="overflow-auto flex my-2 transition-all justify-center nc-scrollbar-md">
    <div
      :class="{
        'grid-cols-1': cols === 1,
        'grid-cols-2': cols === 2,
        'grid-cols-3': cols === 3,
        'grid-cols-4': cols === 4,
        '!gap-5': cols < 3 && size === 'small',
      }"
      class="grid justify-items-center gap-8"
      data-testid="nc-calendar-year-view"
    >
      <LazySmartsheetCalendarYearViewMonth
        v-for="(_, index) in months"
        :key="index"
        v-model:active-dates="activeDates"
        v-model:page-date="months[index]"
        v-model:selected-date="selectedDate"
        :size="size"
        class="nc-year-view-calendar"
        data-testid="nc-calendar-year-view-month-selector"
        @dbl-click="changeView"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-year-view-calendar {
  :deep(.nc-date-week-header) {
    @apply border-gray-200 h-8 py-2;
  }
}
</style>
