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
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const activeDates = useVModel(props, 'activeDates', emit)

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  } else {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  }
})

const currentMonthYear = computed(() => {
  return dayjs(pageDate.value).format('MMMM')
})

// Generates all dates should be displayed in the calendar
// Includes all blank days at the start and end of the month
const dates = computed(() => {
  const startOfMonth = dayjs(pageDate.value).startOf('month')
  const dayOffset = +props.isMondayFirst
  const firstDayOfWeek = startOfMonth.day()
  const startDay = startOfMonth.subtract((firstDayOfWeek - dayOffset + 7) % 7, 'day')

  const datesArray = []
  for (let i = 0; i < 42; i++) {
    datesArray.push(startDay.add(i, 'day'))
  }

  return datesArray
})

// Used to check if two dates are the same
const isSameDate = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  return date1.isSame(date2, 'day')
}

// Used in DatePicker for checking if the date is currently selected
const isSelectedDate = (dObj: dayjs.Dayjs) => {
  if (!selectedDate.value) return false
  const propDate = dayjs(selectedDate.value)
  return props.selectedDate ? isSameDate(propDate, dObj) : false
}

const isDayInPagedMonth = (date: dayjs.Dayjs) => {
  return date.month() === dayjs(pageDate.value).month()
}

// Since we are using the same component for week picker and date picker we need to handle the date selection differently
const handleSelectDate = (date: dayjs.Dayjs) => {
  if (!isDayInPagedMonth(date)) {
    pageDate.value = date
    emit('update:pageDate', date)
  }
  selectedDate.value = date
  emit('update:selectedDate', date)
}

// Used to check if a date is in the current month
const isDateInCurrentMonth = (date: dayjs.Dayjs) => {
  return date.month() === dayjs(pageDate.value).month()
}

// Used to Check if an event is in the date
const isActiveDate = (date: dayjs.Dayjs) => {
  return activeDates.value.some((d) => isSameDate(d, date))
}

const emitDblClick = (date: dayjs.Dayjs) => {
  emit('dblClick', date)
}
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
            'bg-gray-300 border-1 !font-semibold': isSelectedDate(date) && isDayInPagedMonth(date),
            'hover:(border-1 border-gray-200 bg-gray-100)': !isSelectedDate(date),
            'text-gray-400': !isDateInCurrentMonth(date),
            'text-brand-500 !font-semibold nc-calendar-today': isSameDate(date, dayjs()) && isDateInCurrentMonth(date),
            'text-gray-500': date.get('day') === 0 || date.get('day') === 6,
            'h-8 w-8 text-sm': size === 'medium',
            'h-6 w-6 text-xs': size === 'small',
          }"
          class="px-1 py-1.5 relative rounded border-transparent transition border-1 font-medium flex text-gray-700 items-center cursor-pointer justify-center"
          data-testid="nc-calendar-date"
          @click="handleSelectDate(date)"
          @dblclick="emitDblClick(date)"
        >
          <span
            v-if="isActiveDate(date)"
            :class="{
              'h-1.25 w-1.25 top-0.5 right-0.5': size === 'small',
              '!border-white': isSelectedDate(date),
              '!border-brand-50': isSameDate(date, dayjs()),
            }"
            class="absolute z-2 h-1.5 top-1 right-1 w-1.5 transition border-1 rounded-full border-white bg-brand-500"
          ></span>
          <span class="z-2">
            {{ date.get('date') }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
