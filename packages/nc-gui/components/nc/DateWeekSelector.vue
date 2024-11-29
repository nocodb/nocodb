<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  size?: 'medium'
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  activeDates?: Array<dayjs.Dayjs>
  isMondayFirst?: boolean
  isWeekPicker?: boolean
  hideCalendar?: boolean
  selectedWeek?: {
    start: dayjs.Dayjs
    end: dayjs.Dayjs
  } | null
  isCellInputField?: boolean
  pickerType?: 'date' | 'time' | 'year' | 'month'
  showCurrentDateOption?: boolean | 'disabled'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  selectedDate: null,
  isMondayFirst: true,
  pageDate: () => dayjs(),
  isWeekPicker: false,
  activeDates: () => [] as Array<dayjs.Dayjs>,
  selectedWeek: null,
  hideCalendar: false,
  isCellInputField: false,
  pickerType: 'date',
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate', 'update:selectedWeek', 'update:pickerType', 'currentDate'])
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const activeDates = useVModel(props, 'activeDates', emit)

const selectedWeek = useVModel(props, 'selectedWeek', emit)

const pickerType = useVModel(props, 'pickerType', emit)

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
  } else {
    return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  }
})

const currentMonthYear = computed(() => {
  return dayjs(pageDate.value).format('MMMM YYYY')
})

const currentMonth = computed(() => {
  return dayjs(pageDate.value).format('MMMM')
})

const currentYear = computed(() => {
  return dayjs(pageDate.value).format('YYYY')
})

const selectWeek = (date: dayjs.Dayjs) => {
  const dayOffset = +props.isMondayFirst
  const dayOfWeek = (date.day() - dayOffset + 7) % 7
  const startDate = date.subtract(dayOfWeek, 'day')
  const newWeek = {
    start: startDate,
    end: startDate.endOf('week'),
  }
  selectedWeek.value = newWeek
  emit('update:selectedWeek', newWeek)
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
  } else if (props.isCellInputField) {
    selectedDate.value = date
    emit('update:selectedDate', date)
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
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex justify-between border-b-1 nc-date-week-header items-center box-border"
      :class="{
        'px-2 py-1 h-10': isCellInputField,
        'px-3 py-0.5': !isCellInputField,
      }"
    >
      <NcTooltip hide-on-click>
        <NcButton class="!border-0" size="small" type="text" @click="paginate('prev')">
          <component :is="iconMap.arrowLeft" class="h-4 w-4" />
        </NcButton>
        <template #title>
          <span>{{ $t('labels.previous') }}</span>
        </template>
      </NcTooltip>

      <div v-if="isCellInputField" class="text-gray-700 text-sm font-semibold">
        <span class="nc-month-picker-btn cursor-pointer hover:text-brand-500" @click="pickerType = 'month'">{{
          currentMonth
        }}</span>
        {{ ' ' }}
        <span class="nc-year-picker-btn cursor-pointer hover:text-brand-500" @click="pickerType = 'year'">{{ currentYear }}</span>
      </div>
      <span v-else class="text-gray-700 text-sm font-semibold">{{ currentMonthYear }}</span>

      <NcTooltip hide-on-click>
        <NcButton class="!border-0" data-testid="nc-calendar-next-btn" size="small" type="text" @click="paginate('next')">
          <component :is="iconMap.arrowRight" class="h-4 w-4" />
        </NcButton>
        <template #title>
          <span>{{ $t('labels.next') }}</span>
        </template>
      </NcTooltip>
    </div>
    <div v-if="!hideCalendar" class="max-w-[320px] rounded-y-xl">
      <div class="py-1 px-2.5 h-10">
        <div
          class="flex justify-between gap-1"
          :class="{
            'border-b-1 border-gray-200 ': isCellInputField,
          }"
        >
          <span
            v-for="(day, index) in days"
            :key="index"
            class="flex w-8 h-8 items-center uppercase font-medium justify-center text-gray-500"
            >{{ day[0] }}</span
          >
        </div>
      </div>
      <div
        class="grid gap-1 py-1 nc-date-week-grid-wrapper grid-cols-7"
        :class="{
          'px-2': isCellInputField,
          'px-2.5': !isCellInputField,
        }"
      >
        <span
          v-for="(date, index) in dates"
          :key="index"
          :class="{
            'rounded-lg': !isWeekPicker && !isCellInputField,
            'border-1 ': isSelectedDate(date) && !isWeekPicker && isDayInPagedMonth(date),
            'bg-gray-200 !font-bold': isSelectedDate(date) && !isWeekPicker && isDayInPagedMonth(date) && !isCellInputField,
            'bg-gray-300 !font-weight-600': isSelectedDate(date) && !isWeekPicker && isDayInPagedMonth(date) && isCellInputField,
            'hover:(border-1 border-gray-200 bg-gray-100)': !isSelectedDate(date) && !isWeekPicker,
            'nc-selected-week !font-semibold z-1': isDateInSelectedWeek(date) && isWeekPicker,
            'border-none': isWeekPicker,
            'border-transparent': !isWeekPicker,
            'text-gray-400': !isDateInCurrentMonth(date),
            'nc-selected-week-start': isSameDate(date, selectedWeek?.start),
            'nc-selected-week-end': isSameDate(date, selectedWeek?.end),
            'rounded-md text-brand-500 !font-semibold nc-calendar-today': isSameDate(date, dayjs()) && isDateInCurrentMonth(date),
            'text-gray-500': date.get('day') === 0 || date.get('day') === 6,
            'nc-date-item font-weight-400': isCellInputField,
            'font-medium': !isCellInputField,
            'rounded': !isWeekPicker && isCellInputField,
          }"
          class="px-1 h-8 w-8 py-1 relative transition border-1 flex text-gray-700 items-center cursor-pointer justify-center"
          data-testid="nc-calendar-date"
          :title="isCellInputField ? date.format('YYYY-MM-DD') : undefined"
          @click="handleSelectDate(date)"
        >
          <span
            v-if="isActiveDate(date)"
            :class="{
              '!border-white': isSelectedDate(date),
              '!border-brand-50': isSameDate(date, dayjs()),
            }"
            class="absolute top-1 transition right-1 h-1.5 w-1.5 z-2 border-1 rounded-full border-white bg-brand-500"
          ></span>
          <span class="nc-date-item-inner z-2">
            {{ date.get('date') }}
          </span>
        </span>
      </div>
      <div v-if="isCellInputField" class="flex items-center justify-center px-2 pb-2 pt-1 gap-2">
        <NcButton class="nc-date-picker-now-btn !h-7" size="small" type="secondary" @click="handleSelectDate(dayjs())">
          <span class="text-small"> {{ $t('labels.today') }} </span>
        </NcButton>
        <NcTooltip v-if="showCurrentDateOption" :disabled="showCurrentDateOption !== 'disabled'">
          <template #title>
            {{ $t('tooltip.currentDateNotAvail') }}
          </template>
          <NcButton
            class="nc-date-picker-current-date-btn !h-7"
            size="small"
            type="secondary"
            :disabled="showCurrentDateOption === 'disabled'"
            @click="emit('currentDate')"
          >
            <span class="text-small"> {{ $t('labels.currentDate') }} </span>
          </NcButton>
        </NcTooltip>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-selected-week {
  @apply relative transition-all;
}

.nc-selected-week:before {
  @apply absolute top-0 left-0 w-full h-full bg-gray-200;
  content: '';
  width: 134%;
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
