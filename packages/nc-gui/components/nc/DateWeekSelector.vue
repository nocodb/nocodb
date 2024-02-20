<script lang="ts" setup>
interface Props {
  selectedDate?: Date | null
  isDisabled?: boolean
  pageDate?: Date
  activeDates?: Array<Date>
  isMondayFirst?: boolean
  weekPicker?: boolean
  disablePagination?: boolean
  selectedWeek?: {
    start: Date
    end: Date
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  isDisabled: false,
  isMondayFirst: false,
  pageDate: new Date(),
  weekPicker: false,
  disablePagination: false,
  activeDates: [],
  selectedWeek: null,
})
const emit = defineEmits(['change', 'update:selected-date', 'update:page-date', 'update:selected-week'])
// Page date is the date we use to manage which month/date that is currently being displayed
const pageDate = useVModel(props, 'pageDate', emit)
const selectedDate = useVModel(props, 'selectedDate', emit)
const activeDates = useVModel(props, 'activeDates', emit)
const selectedWeek = useVModel(props, 'selectedWeek', emit)

const days = computed(() => {
  if (props.isMondayFirst) {
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }
})

// Used to display the current month and year
const currentMonth = computed(() => {
  return `${pageDate.value.toLocaleString('default', { month: 'long' })} ${pageDate.value.getFullYear()}`
})

const selectWeek = (date: Date) => {
  if (!date) return
  const dayOffset = props.isMondayFirst ? 1 : 0
  const dayOfWeek = (date.getDay() - dayOffset + 7) % 7
  const startDate = new Date(date)
  startDate.setDate(date.getDate() - dayOfWeek)
  selectedWeek.value = {
    start: startDate,
    end: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6),
  }
}

// Generates all dates should be displayed in the calendar
// Includes all blank days at the start and end of the month
const dates = computed(() => {
  const startOfMonth = new Date(pageDate.value.getFullYear(), pageDate.value.getMonth(), 1)
  const dayOffset = props.isMondayFirst ? 1 : 0
  const dayOfWeek = (startOfMonth.getDay() - dayOffset + 7) % 7
  startOfMonth.setDate(startOfMonth.getDate() - dayOfWeek)
  const datesArray = []
  while (datesArray.length < 42) {
    datesArray.push(new Date(startOfMonth))
    startOfMonth.setDate(startOfMonth.getDate() + 1)
  }
  return datesArray
})

// Check if the date is in the selected week
const isDateInSelectedWeek = (date: Date) => {
  if (!selectedWeek.value) return false
  return date >= selectedWeek.value.start && date <= selectedWeek.value.end
}

// Used to check if two dates are the same
const isSameDate = (date1: Date, date2: Date) => {
  if (!date1 || !date2) return false
  return (
    date1.getDate() === date2.getDate() && date1.getMonth() === date2.getMonth() && date1.getFullYear() === date2.getFullYear()
  )
}

// Used in DatePicker for checking if the date is currently selected
const isSelectedDate = (dObj: Date) => {
  if (!selectedDate.value) return false
  const propDate = new Date(selectedDate.value)
  return props.selectedDate ? isSameDate(propDate, dObj) : false
}

const isDayInPagedMonth = (date: Date) => {
  return date.getMonth() === pageDate.value.getMonth()
}

// Since we are using the same component for week picker and date picker we need to handle the date selection differently
const handleSelectDate = (date: Date) => {
  if (props.weekPicker) {
    selectWeek(date)
  } else {
    if (!isDayInPagedMonth(date)) {
      pageDate.value = new Date(date)
      emit('update:page-date', date)
    }
    selectedDate.value = date
    emit('update:selected-date', date)
  }
}

// Used to check if a date is in the current month
const isDateInCurrentMonth = (date: Date) => {
  return date.getMonth() === pageDate.value.getMonth()
}

// Used to Check if an event is in the date
const isActiveDate = (date: Date) => {
  return activeDates.value.some((d) => isSameDate(d, date))
}

// Paginate the calendar
const paginate = (action: 'next' | 'prev') => {
  const newDate = new Date(pageDate.value)
  if (action === 'next') {
    newDate.setMonth(newDate.getMonth() + 1)
  } else {
    newDate.setMonth(newDate.getMonth() - 1)
  }
  pageDate.value = newDate
  emit('update:page-date', newDate)
}
</script>

<template>
  <div class="p-4 flex flex-col gap-4">
    <div
      :class="{
        'justify-center': disablePagination,
        'justify-between': !disablePagination,
      }"
      class="flex items-center"
    >
      <NcButton v-if="!disablePagination" size="small" type="secondary" @click="paginate('prev')">
        <component :is="iconMap.doubleLeftArrow" class="h-4 w-4" />
      </NcButton>
      <span class="font-bold text-gray-700">{{ currentMonth }}</span>
      <NcButton v-if="!disablePagination" size="small" type="secondary" @click="paginate('next')">
        <component :is="iconMap.doubleRightArrow" class="h-4 w-4" />
      </NcButton>
    </div>
    <div class="border-1 border-gray-200 rounded-y-xl max-w-[320px]">
      <div class="flex flex-row bg-gray-100 gap-2 rounded-t-xl justify-between p-2">
        <span v-for="day in days" :key="day" class="h-9 flex items-center justify-center w-9 text-gray-500">{{ day }}</span>
      </div>
      <div class="grid grid-cols-7 gap-2 p-2">
        <span
          v-for="date in dates"
          :key="date"
          :class="{
            'rounded-lg': !weekPicker,
            'bg-brand-50 border-2 !border-brand-500': isSelectedDate(date) && !weekPicker && isDayInPagedMonth(date),
            'hover:(border-1 border-gray-200 bg-gray-100)': !isSelectedDate(date) && !weekPicker,
            'nc-selected-week z-1': isDateInSelectedWeek(date) && weekPicker,
            'text-gray-400': !isDateInCurrentMonth(date),
            'nc-selected-week-start': isSameDate(date, selectedWeek?.start),
            'nc-selected-week-end': isSameDate(date, selectedWeek?.end),
          }"
          class="h-9 w-9 px-1 py-2 relative font-medium flex items-center cursor-pointer justify-center"
          @click="handleSelectDate(date)"
        >
          <span v-if="isActiveDate(date)" class="absolute z-2 h-1.5 w-1.5 rounded-full bg-brand-500 top-1 right-1"></span>
          <span class="z-2">
            {{ date.getDate() }}
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
  @apply absolute top-0 left-0 w-full h-full border-y-2 bg-brand-50 border-brand-500;
  content: '';
  width: 124%;
  height: 100%;
}

.nc-selected-week-start:before {
  @apply !border-l-2 !rounded-l-lg;
}

.nc-selected-week-end:before {
  width: 100%;
  @apply !border-r-2 !rounded-r-lg;
}
</style>
