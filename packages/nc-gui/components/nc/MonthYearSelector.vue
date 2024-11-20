<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  selectedDate?: dayjs.Dayjs | null
  pageDate?: dayjs.Dayjs
  isYearPicker?: boolean
  hideCalendar?: boolean
  isCellInputField?: boolean
  pickerType?: 'date' | 'time' | 'year' | 'month'
  showCurrentDateOption?: boolean | 'disabled'
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  pageDate: () => dayjs(),
  isYearPicker: false,
  hideCalendar: false,
  isCellInputField: false,
  pickerType: 'date',
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate', 'update:pickerType', 'currentDate'])

const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const pickerType = useVModel(props, 'pickerType', emit)

const years = computed(() => {
  const date = pageDate.value
  const startOfYear = date.startOf('year')
  const years: dayjs.Dayjs[] = []
  for (let i = 0; i < 12; i++) {
    years.push(dayjs(startOfYear).add(i, 'year'))
  }
  return years
})

const months = computed(() => {
  const months: dayjs.Dayjs[] = []
  for (let i = 0; i < 12; i++) {
    months.push(pageDate.value.set('month', i))
  }
  return months
})

const compareDates = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  return date1.isSame(date2, 'month') && date1.isSame(date2, 'year')
}

const isMonthSelected = (date: dayjs.Dayjs) => {
  if (!dayjs(selectedDate.value).isValid()) return false
  return compareDates(date, selectedDate.value)
}

const paginateMonth = (action: 'next' | 'prev') => {
  let date = pageDate.value
  if (action === 'next') {
    date = date.add(1, 'year')
  } else {
    date = date.subtract(1, 'year')
  }
  pageDate.value = date
  emit('update:pageDate', date)
}

const paginateYear = (action: 'next' | 'prev') => {
  let date = dayjs(pageDate.value)
  if (action === 'next') {
    date = date.add(12, 'year')
  } else {
    date = date.subtract(12, 'year')
  }
  pageDate.value = date
  emit('update:pageDate', date)
}

const paginate = (action: 'next' | 'prev') => {
  if (props.isYearPicker) {
    paginateYear(action)
  } else {
    paginateMonth(action)
  }
}

const compareYear = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  return date1.isSame(date2, 'year')
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex border-b-1 nc-month-picker-pagination justify-between items-center"
      :class="{
        'px-2 py-1 h-10': isCellInputField,
        'px-2 py-0.5': !isCellInputField,
      }"
    >
      <div class="flex">
        <NcTooltip hide-on-click>
          <NcButton class="nc-prev-page-btn !border-0" size="small" type="text" @click="paginate('prev')">
            <component :is="iconMap.arrowLeft" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.previous') }}</span>
          </template>
        </NcTooltip>
      </div>

      <span
        class="nc-year-picker-btn text-gray-700 font-semibold"
        :class="{
          'cursor-pointer hover:text-brand-500': isCellInputField && !isYearPicker,
        }"
        @click="!isYearPicker ? (pickerType = 'year') : () => undefined"
        >{{
          isYearPicker
            ? isCellInputField
              ? dayjs(selectedDate).year() || dayjs().year()
              : dayjs(selectedDate).year()
            : dayjs(pageDate).format('YYYY')
        }}</span
      >
      <div class="flex">
        <NcTooltip hide-on-click>
          <NcButton class="nc-next-page-btn !border-0" size="small" type="text" @click="paginate('next')">
            <component :is="iconMap.arrowRight" class="h-4 w-4" />
          </NcButton>
          <template #title>
            <span>{{ $t('labels.next') }}</span>
          </template>
        </NcTooltip>
      </div>
    </div>
    <div
      v-if="!hideCalendar"
      class="rounded-y-xl max-w-[350px]"
      :class="{
        'px-2  py-1': isCellInputField,
        'px-2.5 py-2': !isCellInputField,
      }"
    >
      <div class="grid grid-cols-4 gap-2">
        <template v-if="!isYearPicker">
          <span
            v-for="(month, id) in months"
            :key="id"
            :class="{
              'bg-gray-200 !text-brand-900 !font-bold': isMonthSelected(month) && !isCellInputField,
              'bg-gray-300 !font-weight-600 ': isMonthSelected(month) && isCellInputField,
              'hover:(border-1 border-gray-200 bg-gray-100)': !isMonthSelected(month),
              '!text-brand-500': dayjs().isSame(month, 'month'),
              'font-weight-400': isCellInputField,
              'font-medium': !isCellInputField,
            }"
            class="nc-month-item h-8 flex items-center rounded transition-all justify-center text-gray-700 cursor-pointer"
            :title="isCellInputField ? month.format('YYYY-MM') : undefined"
            @click="selectedDate = month"
          >
            {{ month.format('MMM') }}
          </span>
        </template>
        <template v-else>
          <span
            v-for="(year, id) in years"
            :key="id"
            :class="{
              'bg-gray-200 !font-bold ': compareYear(year, selectedDate) && !isCellInputField,
              'bg-gray-300 !text-brand-500 !font-weight-600 ': compareYear(year, selectedDate) && isCellInputField,
              'hover:(border-1 border-gray-200 bg-gray-100)': !compareYear(year, selectedDate),
              '!text-brand-500': dayjs().isSame(year, 'year'),
              'font-weight-400 text-gray-700': isCellInputField,
              'font-medium text-gray-900': !isCellInputField,
            }"
            class="nc-year-item h-8 flex items-center rounded transition-all justify-center cursor-pointer"
            :title="isCellInputField ? year.format('YYYY') : undefined"
            @click="selectedDate = year"
          >
            {{ year.format('YYYY') }}
          </span>
        </template>
      </div>

      <div v-if="showCurrentDateOption" class="flex items-center justify-center px-2 pb-2 pt-1">
        <NcTooltip :disabled="showCurrentDateOption !== 'disabled'">
          <template #title>
            {{ $t('tooltip.currentDateNotAvail') }}
          </template>
          <NcButton
            class="nc-date-picker-now-btn !h-7"
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

<style lang="scss" scoped></style>
