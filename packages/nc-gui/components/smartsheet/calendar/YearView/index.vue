<script lang="ts" setup>
import type dayjs from 'dayjs'

const { selectedDate, activeDates, activeCalendarView } = useCalendarViewStoreOrThrow()

// Create a shared cache service for all Month components in Year View
const sharedCalendarCache = reactive({
  // Cache for date comparisons
  dateComparisonCache: new Map<string, boolean>(),
  // Cache for month comparisons
  monthComparisonCache: new Map<string, boolean>(),
  // Cache for active dates
  activeDateCache: new Map<string, boolean>(),
  // Cache for date arrays
  datesCache: new Map<string, any[]>(),
  // Group active dates by month for efficient lookup
  // Key format: 'YYYY-MM'
  activeDatesByMonth: new Map<string, Set<string>>(),

  // Clear all caches
  clearAllCaches() {
    this.dateComparisonCache.clear()
    this.monthComparisonCache.clear()
    this.activeDateCache.clear()
    this.datesCache.clear()
    // Don't clear activeDatesByMonth as it's our primary optimization
  },

  // Group active dates by month for more efficient lookup
  groupActiveDatesByMonth(dates: Array<dayjs.Dayjs>) {
    this.activeDatesByMonth.clear()

    dates.forEach((date) => {
      if (!date) return

      const monthKey = date.format('YYYY-MM')
      const dateKey = date.format('YYYY-MM-DD')

      if (!this.activeDatesByMonth.has(monthKey)) {
        this.activeDatesByMonth.set(monthKey, new Set())
      }

      this.activeDatesByMonth.get(monthKey)!.add(dateKey)
    })
  },

  // Check if a date is active using the month-based grouping
  isActiveDateInMonth(date: dayjs.Dayjs): boolean {
    if (!date) return false

    const monthKey = date.format('YYYY-MM')
    const dateKey = date.format('YYYY-MM-DD')

    // If we don't have any dates for this month, return false immediately
    if (!this.activeDatesByMonth.has(monthKey)) return false

    // Check if the specific date exists in the month's set
    return this.activeDatesByMonth.get(monthKey)!.has(dateKey)
  },
})

// Provide the shared cache to all child components
provide('sharedCalendarCache', sharedCalendarCache)

sharedCalendarCache.groupActiveDatesByMonth(activeDates.value)

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
  // Clear computation caches when changing view to ensure fresh data
  sharedCalendarCache.clearAllCaches()
  selectedDate.value = date
  activeCalendarView.value = 'day'
}

// Update the active dates grouping when activeDates change
watch(
  activeDates,
  (newActiveDates) => {
    // Update our month-based grouping
    sharedCalendarCache.groupActiveDatesByMonth(newActiveDates)
    // Clear computation caches
    sharedCalendarCache.clearAllCaches()
  },
  { deep: true },
)

// Clear caches when selectedDate changes
watch(
  selectedDate,
  () => {
    sharedCalendarCache.clearAllCaches()
  },
  { deep: true },
)

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
