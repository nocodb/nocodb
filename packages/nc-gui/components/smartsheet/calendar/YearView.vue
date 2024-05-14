<script lang="ts" setup>
const { selectedDate, activeDates } = useCalendarViewStoreOrThrow()

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
      class="grid grid-cols-4 justify-items-center gap-3"
      data-testid="nc-calendar-year-view"
    >
      <NcDateWeekSelector
        v-for="(_, index) in months"
        :key="index"
        v-model:active-dates="activeDates"
        v-model:page-date="months[index]"
        v-model:selected-date="selectedDate"
        class="nc-year-view-calendar"
        :size="size"
        data-testid="nc-calendar-year-view-month-selector"
        disable-pagination
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-year-view-calendar {
  :deep(.nc-date-week-header) {
    @apply !border-b-1 pb-2 border-gray-200;
  }
}
</style>
