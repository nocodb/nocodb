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
  timezone?: string
  header?: 'v1' | 'v2'
  isJalali?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  pageDate: () => dayjs(),
  isYearPicker: false,
  hideCalendar: false,
  isCellInputField: false,
  pickerType: 'date',
  header: 'v1',
  isJalali: false,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate', 'update:pickerType', 'currentDate'])

const pageDate = useVModel(props, 'pageDate', emit)

const selectedDate = useVModel(props, 'selectedDate', emit)

const pickerType = useVModel(props, 'pickerType', emit)

const timezoneDayjs = computed(() => {
  return withTimezone(props.timezone)
})

const years = computed(() => {
  const date = pageDate.value
  const years: dayjs.Dayjs[] = []
  if (props.isJalali) {
    const jy = jalaliPartsOf(date).jy
    for (let i = 0; i < 12; i++) {
      years.push(timezoneDayjs.value.timezonize(jalaliDate(date, jy + i, 1, 1)))
    }
    return years
  }
  const startOfYear = date.startOf('year')
  for (let i = 0; i < 12; i++) {
    years.push(timezoneDayjs.value.timezonize(startOfYear.add(i, 'year')))
  }
  return years
})

const months = computed(() => {
  const months: dayjs.Dayjs[] = []
  if (props.isJalali) {
    const jy = jalaliPartsOf(pageDate.value).jy
    for (let i = 0; i < 12; i++) {
      months.push(jalaliDate(pageDate.value, jy, i + 1, 1))
    }
    return months
  }
  for (let i = 0; i < 12; i++) {
    months.push(pageDate.value.set('month', i))
  }
  return months
})

const compareDates = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  if (props.isJalali) {
    return isSameJalaliMonth(date1, date2)
  }
  return date1.isSame(date2, 'month') && date1.isSame(date2, 'year')
}

const isMonthSelected = (date: dayjs.Dayjs) => {
  if (!timezoneDayjs.value.dayjsTz(selectedDate.value).isValid()) return false
  return compareDates(date, selectedDate.value)
}

const paginateMonth = (action: 'next' | 'prev') => {
  let date = pageDate.value
  const delta = action === 'next' ? 1 : -1
  date = props.isJalali ? jalaliAddYears(date, delta) : date.add(delta, 'year')
  pageDate.value = date
  emit('update:pageDate', date)
}

const paginateYear = (action: 'next' | 'prev') => {
  let date = timezoneDayjs.value.dayjsTz(pageDate.value)
  const delta = action === 'next' ? 12 : -12
  date = props.isJalali ? jalaliAddYears(date, delta) : date.add(delta, 'year')
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
  if (props.isJalali) {
    return isSameJalaliYear(date1, date2)
  }
  return date1.isSame(date2, 'year')
}
</script>

<template>
  <div class="flex flex-col">
    <div
      class="flex border-b-1 nc-month-picker-pagination justify-between items-center"
      :class="{
        'px-2 py-1 h-10': isCellInputField,
        'px-2 py-2': !isCellInputField,
      }"
    >
      <template v-if="header === 'v1'">
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
          class="nc-year-picker-btn text-nc-content-gray-subtle font-semibold"
          :class="{
            'cursor-pointer hover:text-nc-content-brand': isCellInputField && !isYearPicker,
          }"
          @click="!isYearPicker ? (pickerType = 'year') : () => undefined"
          >{{
            isYearPicker
              ? isCellInputField
                ? isJalali
                  ? timezoneDayjs.dayjsTz(selectedDate).isValid()
                    ? timezoneDayjs.dayjsTz(selectedDate).format('jYYYY')
                    : timezoneDayjs.dayjsTz().format('jYYYY')
                  : timezoneDayjs.dayjsTz(selectedDate).year() || timezoneDayjs.dayjsTz().year()
                : isJalali
                ? timezoneDayjs.dayjsTz(selectedDate).format('jYYYY')
                : timezoneDayjs.dayjsTz(selectedDate).year()
              : timezoneDayjs.dayjsTz(pageDate).format(isJalali ? 'jYYYY' : 'YYYY')
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
      </template>
      <template v-else>
        <div class="text-nc-content-gray-subtle text-sm font-semibold">
          <span class="px-1 font-bold leading-6 text-sm text-nc-content-gray-subtle py-2">
            {{
              isYearPicker
                ? isJalali
                  ? timezoneDayjs.dayjsTz(selectedDate).format('jYYYY')
                  : timezoneDayjs.dayjsTz(selectedDate).year()
                : timezoneDayjs.dayjsTz(pageDate).format(isJalali ? 'jYYYY' : 'YYYY')
            }}
          </span>
        </div>

        <div class="flex items-center justify-center">
          <NcTooltip hide-on-click>
            <NcButton class="!border-0" size="small" type="text" @click="paginate('prev')">
              <GeneralIcon icon="ncChevronLeft" class="h-4 w-4" />
            </NcButton>
            <template #title>
              <span>{{ $t('labels.previous') }}</span>
            </template>
          </NcTooltip>
          <NcTooltip hide-on-click>
            <NcButton class="!border-0" data-testid="nc-calendar-next-btn" size="small" type="text" @click="paginate('next')">
              <GeneralIcon icon="ncChevronRight" class="h-4 w-4" />
            </NcButton>
            <template #title>
              <span>{{ $t('labels.next') }}</span>
            </template>
          </NcTooltip>
        </div>
      </template>
    </div>
    <div
      v-if="!hideCalendar"
      class="nc-month-year-grid rounded-y-xl max-w-[350px]"
      :class="{
        'px-2 py-1': isCellInputField,
        'px-2.5 py-1': !isCellInputField,
      }"
    >
      <div class="grid grid-cols-4 gap-y-2 gap-x-1">
        <template v-if="!isYearPicker">
          <span
            v-for="(month, id) in months"
            :key="id"
            :class="{
              'bg-nc-bg-gray-medium !text-nc-brand-900 !font-bold': isMonthSelected(month) && !isCellInputField,
              'bg-nc-bg-gray-dark !font-weight-600 ': isMonthSelected(month) && isCellInputField,
              'hover:(border-1 border-nc-border-gray-medium bg-nc-bg-gray-light)': !isMonthSelected(month),
              '!text-nc-content-brand': isJalali
                ? isSameJalaliMonth(timezoneDayjs.dayjsTz(), month)
                : timezoneDayjs.dayjsTz().isSame(month, 'month'),
              'font-weight-400': isCellInputField,
              'font-medium': !isCellInputField,
            }"
            class="nc-month-item h-8 flex items-center rounded transition-all justify-center text-nc-content-gray-subtle cursor-pointer"
            :title="isCellInputField ? month.format(isJalali ? 'jYYYY-jMM' : 'YYYY-MM') : undefined"
            @click="selectedDate = month"
          >
            {{ isJalali ? month.format('jMMMM') : month.format('MMM') }}
          </span>
        </template>
        <template v-else>
          <span
            v-for="(year, id) in years"
            :key="id"
            :class="{
              'bg-nc-bg-gray-medium !font-bold ': compareYear(year, selectedDate) && !isCellInputField,
              'bg-nc-bg-gray-dark !text-nc-content-brand !font-weight-600 ': compareYear(year, selectedDate) && isCellInputField,
              'hover:(border-1 border-nc-border-gray-medium bg-nc-bg-gray-light)': !compareYear(year, selectedDate),
              '!text-nc-content-brand': isJalali
                ? isSameJalaliYear(timezoneDayjs.dayjsTz(), year)
                : timezoneDayjs.dayjsTz().format('YYYY') === year.format('YYYY'),
              'font-weight-400 text-nc-content-gray-subtle': isCellInputField,
              'font-medium text-nc-content-gray-emphasis': !isCellInputField,
            }"
            class="nc-year-item h-8 flex items-center rounded transition-all justify-center cursor-pointer"
            :title="isCellInputField ? year.format(isJalali ? 'jYYYY' : 'YYYY') : undefined"
            @click="selectedDate = year"
          >
            {{ isJalali ? year.format('jYYYY') : year.format('YYYY') }}
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
