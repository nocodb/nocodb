<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  size?: 'medium' | 'large' | 'small'
  selectedDate?: dayjs.Dayjs | null
  isDisabled?: boolean
  pageDate?: dayjs.Dayjs
  activeDates?: Array<dayjs.Dayjs>
  isMondayFirst?: boolean
  isWeekPicker?: boolean
  disableHeader?: boolean
  disablePagination?: boolean
  hideCalendar?: boolean
  selectedWeek?: {
    start: dayjs.Dayjs
    end: dayjs.Dayjs
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  size: 'large',
  selectedDate: null,
  isDisabled: false,
  isMondayFirst: true,
  pageDate: dayjs(),
  isWeekPicker: false,
  disableHeader: false,
  disablePagination: false,
  activeDates: [] as Array<dayjs.Dayjs>,
  selectedWeek: null,
  hideCalendar: false,
})
const emit = defineEmits(['change', 'update:selectedDate', 'update:pageDate', 'update:selectedWeek'])
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const activeDates = useVModel(props, 'activeDates', emit)

const selectedWeek = useVModel(props, 'selectedWeek', emit)

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  } else {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  }
})

// Used to display the current month and year
const currentMonthYear = computed(() => {
  if (props.isWeekPicker) {
    if (selectedWeek.value?.start.isSame(selectedWeek.value?.end, 'month')) {
      return `${selectedWeek.value.start.format('D')} - ${selectedWeek.value.end.format('D MMM YY')}`
    } else if (selectedWeek.value?.start.isSame(selectedWeek.value.end, 'year')) {
      return `${selectedWeek.value?.start.format('D MMM')} - ${selectedWeek.value.end.format('D MMM YY')}`
    } else {
      return `${selectedWeek.value?.start.format('D MMM YY')} - ${selectedWeek.value?.end.format('D MMM YY')}`
    }
  } else {
    return dayjs(selectedDate.value).format('D MMM YYYY')
  }
})

const selectWeek = (date: dayjs.Dayjs) => {
  const dayOffset = +props.isMondayFirst
  const dayOfWeek = (date.day() - dayOffset + 7) % 7
  const startDate = date.subtract(dayOfWeek, 'day')
  selectedWeek.value = {
    start: startDate,
    end: startDate.endOf('week'),
  }
}

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

// Check if the date is in the selected week
const isDateInSelectedWeek = (date: dayjs.Dayjs) => {
  if (!selectedWeek.value) return false
  return date.isBetween(selectedWeek.value.start, selectedWeek.value.end, 'day', '[]')
}

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
  if (props.isWeekPicker) {
    selectWeek(date)
  } else {
    if (!isDayInPagedMonth(date)) {
      pageDate.value = date
      emit('update:pageDate', date)
    }
    selectedDate.value = date
    emit('update:selectedDate', date)
  }
}

// Used to check if a date is in the current month
const isDateInCurrentMonth = (date: dayjs.Dayjs) => {
  return date.month() === dayjs(pageDate.value).month()
}

// Used to Check if an event is in the date
const isActiveDate = (date: dayjs.Dayjs) => {
  return activeDates.value.some((d) => isSameDate(d, date))
}

// Paginate the calendar
const paginate = (action: 'next' | 'prev') => {
  let newDate = dayjs(pageDate.value)
  if (action === 'next') {
    newDate = newDate.add(1, 'month')
  } else {
    newDate = newDate.subtract(1, 'month')
  }
  pageDate.value = newDate
  emit('update:pageDate', newDate)
}

const changeDate = (action: 'prev' | 'next') => {
  if (props.isWeekPicker) {
    const temp = selectedWeek.value || { start: dayjs(), end: dayjs().add(7, 'day') }
    if (action === 'next') {
      temp.start = dayjs(temp?.start).add(1, 'week')
      temp.end = dayjs(temp?.end).add(1, 'week')
    } else {
      temp.start = dayjs(temp?.start).subtract(1, 'week')
      temp.end = dayjs(temp?.end).subtract(1, 'week')
    }
    emit('update:selectedWeek', temp)
  } else {
    let date = dayjs(selectedDate.value)

    if (action === 'next') {
      date = date.add(1, 'day')
    } else {
      date = date.subtract(1, 'day')
    }
    emit('update:selectedDate', date)
  }
}
</script>

<template>
  <div
    :class="{
      'gap-1': size === 'small',
      'gap-4': size === 'medium' || size === 'large',
    }"
    class="flex flex-col"
  >
    <div
      v-if="!disableHeader"
      :class="{
        ' justify-between': !disablePagination,
        ' justify-center': disablePagination,
      }"
      class="flex items-center"
    >
      <div v-if="!disablePagination" class="flex">
        <NcTooltip>
          <NcButton class="!border-0" size="small" type="secondary" @click="paginate('prev')">
            <component :is="iconMap.doubleLeftArrow" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.previousMonth') }}</span>
          </template>
        </NcTooltip>
        <NcTooltip>
          <NcButton class="!border-0" size="small" type="secondary" @click="changeDate('prev')">
            <component :is="iconMap.arrowLeft" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.next') }}</span>
          </template>
        </NcTooltip>
      </div>

      <span
        :class="{
          'text-xs': size === 'small',
          'text-sm': size === 'medium',
        }"
        class="text-gray-700"
        >{{ currentMonthYear }}</span
      >

      <div v-if="!disablePagination" class="flex">
        <NcTooltip>
          <NcButton class="!border-0" size="small" type="secondary" @click="changeDate('next')">
            <component :is="iconMap.arrowRight" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.next') }}</span>
          </template>
        </NcTooltip>
        <NcTooltip>
          <NcButton class="!border-0" size="small" type="secondary" @click="paginate('next')">
            <component :is="iconMap.doubleRightArrow" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.previousMonth') }}</span>
          </template>
        </NcTooltip>
      </div>
    </div>
    <div
      v-if="!hideCalendar"
      :class="{
        'rounded-lg': size === 'small',
        'rounded-y-xl': size !== 'small',
      }"
      class="max-w-[320px]"
    >
      <div
        :class="{
          'gap-1 px-1': size === 'medium',
          'gap-2': size === 'large',
          'px-2 py-1 !rounded-t-lg': size === 'small',
          'rounded-t-xl': size !== 'small',
        }"
        class="flex flex-row border-b-1 nc-date-week-header border-gray-200 justify-between"
      >
        <span
          v-for="(day, index) in days"
          :key="index"
          :class="{
            'w-9 h-9': size === 'large',
            'w-8 h-8': size === 'medium',
            'text-[10px]': size === 'small',
          }"
          class="flex items-center uppercase font-medium justify-center text-gray-500"
          >{{ day[0] }}</span
        >
      </div>
      <div
        :class="{
          'gap-2 pt-2': size === 'large',
          'gap-1 p-1': size === 'medium',
        }"
        class="grid nc-date-week-grid-wrapper grid-cols-7"
      >
        <span
          v-for="(date, index) in dates"
          :key="index"
          :class="{
            'rounded-lg': !isWeekPicker,
            'bg-gray-200 border-1 font-bold text-brand-500': isSelectedDate(date) && !isWeekPicker && isDayInPagedMonth(date),
            'hover:(border-1 border-gray-200 bg-gray-100)': !isSelectedDate(date) && !isWeekPicker,
            'nc-selected-week z-1': isDateInSelectedWeek(date) && isWeekPicker,
            'border-none': isWeekPicker,
            'border-transparent': !isWeekPicker,
            'text-gray-400': !isDateInCurrentMonth(date),
            'nc-selected-week-start': isSameDate(date, selectedWeek?.start),
            'nc-selected-week-end': isSameDate(date, selectedWeek?.end),
            'rounded-md bg-brand-50 text-brand-500 nc-calendar-today ': isSameDate(date, dayjs()) && isDateInCurrentMonth(date),
            'h-9 w-9': size === 'large',
            'h-8 w-8': size === 'medium',
            'h-6 w-6 text-[10px]': size === 'small',
          }"
          class="px-1 py-1 relative border-1 font-medium flex items-center cursor-pointer justify-center"
          data-testid="nc-calendar-date"
          @click="handleSelectDate(date)"
        >
          <span
            v-if="isActiveDate(date)"
            :class="{
              'h-2 w-2': size === 'large',
              'h-1 w-1': size === 'medium',
              'h-0.75 w-0.75': size === 'small',
              'top-1 right-1': size !== 'small',
              'top-0.5 right-0.5': size === 'small',
              '!border-white': isSelectedDate(date),
              'border-brand-50': isSameDate(date, dayjs()),
            }"
            class="absolute z-2 rounded-full border-2 border-white bg-brand-500"
          ></span>
          <span class="z-2">
            {{ date.get('date') }}
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-selected-week {
  @apply relative;
}

.nc-selected-week:before {
  @apply absolute top-0 left-0 w-full h-full bg-gray-200;
  content: '';
  width: 124%;
  height: 100%;
}

.nc-selected-week-start:before {
  @apply !border-l-1 !rounded-l-lg;
}

.nc-selected-week-end:before {
  width: 100%;
  @apply !border-r-1 !rounded-r-lg;
}
</style>
