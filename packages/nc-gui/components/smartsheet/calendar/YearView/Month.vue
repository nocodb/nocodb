<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  size?: 'medium' | 'small'
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  activeDates?: Array<dayjs.Dayjs>
  isMondayFirst?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  selectedDate: null,
  isMondayFirst: true,
  pageDate: dayjs(),
  activeDates: [] as Array<dayjs.Dayjs>,
})

const emit = defineEmits(['dblClick', 'update:selectedDate', 'update:pageDate'])

const { timezoneDayjs } = useCalendarViewStoreOrThrow()

// Get the shared cache from the parent component
const sharedCalendarCache = inject(
  'sharedCalendarCache',
  reactive({
    dateComparisonCache: new Map<string, boolean>(),
    monthComparisonCache: new Map<string, boolean>(),
    activeDateCache: new Map<string, boolean>(),
    datesCache: new Map<string, any[]>(),
    activeDatesByMonth: new Map<string, Set<string>>(),
    clearAllCaches() {
      this.dateComparisonCache.clear()
      this.monthComparisonCache.clear()
      this.activeDateCache.clear()
      this.datesCache.clear()
      this.activeDatesByMonth.clear()
    },
    isActiveDateInMonth(date: dayjs.Dayjs): boolean {
      const monthKey = date.format('YYYY-MM')
      if (!this.activeDatesByMonth.has(monthKey)) {
        this.activeDatesByMonth.set(monthKey, new Set())
      }
      const activeDatesInMonth = this.activeDatesByMonth.get(monthKey)
      if (activeDatesInMonth) {
        return activeDatesInMonth.has(date.format('YYYY-MM-DD'))
      }
      return false
    },
  }),
)

// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const activeDates = useVModel(props, 'activeDates', emit)

// Cache key generator for date comparisons
const getDateComparisonCacheKey = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  return `${date1?.format('YYYY-MM-DD')}_${date2?.format('YYYY-MM-DD')}`
}

// Cache key generator for month comparison
const getMonthComparisonCacheKey = (date: dayjs.Dayjs) => {
  return `${date?.format('YYYY-MM')}_${pageDate.value?.format('YYYY-MM')}`
}

// Cache key for the dates array
const getDatesCacheKey = () => {
  return `${pageDate.value?.format('YYYY-MM')}_${selectedDate.value?.format('YYYY-MM-DD')}_${activeDates.value.length}`
}

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  } else {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  }
})

const currentMonthYear = computed(() => {
  return timezoneDayjs.dayjsTz(pageDate.value).format('MMMM')
})

// Used to check if two dates are the same - with shared caching
const isSameDate = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false

  const cacheKey = getDateComparisonCacheKey(date1, date2)
  if (sharedCalendarCache.dateComparisonCache.has(cacheKey)) {
    return sharedCalendarCache.dateComparisonCache.get(cacheKey)
  }

  const result = date1.isSame(date2, 'day')
  sharedCalendarCache.dateComparisonCache.set(cacheKey, result)
  return result
}

const isSelectedDate = (dObj: dayjs.Dayjs) => {
  if (!selectedDate.value) return false
  const propDate = timezoneDayjs.dayjsTz(selectedDate.value)
  return props.selectedDate ? isSameDate(propDate, dObj) : false
}

const isDayInPagedMonth = (date: dayjs.Dayjs) => {
  const cacheKey = getMonthComparisonCacheKey(date)
  if (sharedCalendarCache.monthComparisonCache.has(cacheKey)) {
    return sharedCalendarCache.monthComparisonCache.get(cacheKey)
  }

  const result = date.month() === timezoneDayjs.dayjsTz(pageDate.value).month()
  sharedCalendarCache.monthComparisonCache.set(cacheKey, result)
  return result
}

// Used to check if a date is in the current month
const isDateInCurrentMonth = (date: dayjs.Dayjs) => {
  const cacheKey = getMonthComparisonCacheKey(date)
  if (sharedCalendarCache.monthComparisonCache.has(cacheKey)) {
    return sharedCalendarCache.monthComparisonCache.get(cacheKey)
  }

  const result = date.month() === timezoneDayjs.dayjsTz(pageDate.value).month()
  sharedCalendarCache.monthComparisonCache.set(cacheKey, result)
  return result
}

// Used to Check if an event is in the date - using month-based grouping for efficiency
const isActiveDate = (date: dayjs.Dayjs) => {
  // Use the optimized month-based grouping lookup
  return sharedCalendarCache.isActiveDateInMonth(date)
}

// Generates all dates should be displayed in the calendar
// Includes all blank days at the start and end of the month
const dates = computed(() => {
  // Create a cache key based on the dependencies
  const cacheKey = getDatesCacheKey()

  // Return cached result if available
  if (sharedCalendarCache.datesCache.has(cacheKey)) {
    return sharedCalendarCache.datesCache.get(cacheKey)
  }

  const startOfMonth = timezoneDayjs.timezonize(pageDate.value.startOf('month'))
  const dayOffset = +props.isMondayFirst
  const firstDayOfWeek = startOfMonth.day()
  const startDay = startOfMonth.subtract((firstDayOfWeek - dayOffset + 7) % 7, 'day')

  const datesArray = []
  for (let i = 0; i < 42; i++) {
    const newDate = startDay.add(i, 'day')
    const isDateSelected = isSelectedDate(newDate)
    const isDayInCurrentMonth = isDateInCurrentMonth(newDate)
    const isSelectedAndIsInCurrentMonth = isDateSelected && isDayInPagedMonth(newDate)
    const isToday = isSameDate(newDate, timezoneDayjs.dayjsTz())
    const isTodayInCurrentMonth = isToday && isDayInCurrentMonth
    const isWeekend = newDate.get('day') === 0 || newDate.get('day') === 6
    const isActive = isActiveDate(newDate)
    const dayVal = newDate.get('date')

    datesArray.push({
      date: newDate,
      isSelected: isDateSelected,
      isDayInCurrentMonth,
      isSelectedAndIsInCurrentMonth,
      isToday,
      isTodayInCurrentMonth,
      isWeekend,
      isActive,
      dayVal,
    })
  }

  // Store in shared cache
  sharedCalendarCache.datesCache.set(cacheKey, datesArray)

  return datesArray
})

// Since we are using the same component for week picker and date picker we need to handle the date selection differently
const handleSelectDate = (date: dayjs.Dayjs) => {
  if (!isDayInPagedMonth(date)) {
    pageDate.value = date
    emit('update:pageDate', date)
  }
  selectedDate.value = date
  emit('update:selectedDate', date)
}

const emitDblClick = (date: dayjs.Dayjs) => {
  emit('dblClick', date)
}

watch(activeDates, (newActiveDates) => {
  sharedCalendarCache.clearAllCaches()
  newActiveDates.forEach((date) => {
    const monthKey = date.format('YYYY-MM')
    if (!sharedCalendarCache.activeDatesByMonth.has(monthKey)) {
      sharedCalendarCache.activeDatesByMonth.set(monthKey, new Set())
    }
    const activeDatesInMonth = sharedCalendarCache.activeDatesByMonth.get(monthKey)
    if (activeDatesInMonth) {
      activeDatesInMonth.add(date.format('YYYY-MM-DD'))
    }
  })
})
</script>

<template>
  <div>
    <div class="flex justify-center px-2 nc-date-week-header text-gray-700 text-sm py-2 font-semibold items-center">
      {{ currentMonthYear }}
    </div>
    <div
      :class="{
        'rounded-lg': size === 'small',
        'rounded-y-xl': size !== 'small',
      }"
      class="max-w-[320px]"
    >
      <div class="px-2.5">
        <div class="flex border-b-1 justify-between gap-0.5 border-gray-200">
          <span
            v-for="(day, index) in days"
            :key="index"
            :class="{
              'w-8 h-8 text-sm': size === 'medium',
              'text-xs w-6 h-6': size === 'small',
            }"
            class="flex items-center uppercase py-1 font-medium justify-center text-gray-500"
            >{{ day[0] }}</span
          >
        </div>
      </div>
      <div class="grid gap-x-0.5 gap-y-2 px-2.5 py-1 nc-date-week-grid-wrapper grid-cols-7">
        <span
          v-for="(date, index) in dates"
          :key="index"
          :class="{
            'bg-gray-300 border-1 !font-semibold': date.isSelectedAndIsInCurrentMonth,
            'hover:(border-1 border-gray-200 bg-gray-100)': !date.isSelected,
            'text-gray-400': !date.isDayInCurrentMonth,
            'text-brand-500 !font-semibold nc-calendar-today': date.isTodayInCurrentMonth,
            'text-gray-500': date.isWeekend,
            'h-8 w-8 text-sm': size === 'medium',
            'h-6 w-6 text-xs': size === 'small',
          }"
          class="px-1 py-1.5 relative rounded border-transparent transition border-1 font-medium flex text-gray-700 items-center cursor-pointer justify-center"
          data-testid="nc-calendar-date"
          @click="handleSelectDate(date.date)"
          @dblclick="emitDblClick(date.date)"
        >
          <span
            v-if="date.isActive"
            :class="{
              'h-1.25 w-1.25 top-0.5 right-0.5': size === 'small',
              'h-1.5 w-1.5 top-1 right-1': size === 'medium',
              '!border-white': date.isDateSelected,
              '!border-brand-50': date.isToday,
            }"
            class="absolute z-2 transition border-1 rounded-full border-white bg-brand-500"
          ></span>
          <span class="z-2">
            {{ date.dayVal }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
