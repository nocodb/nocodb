<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  selectedDate?: dayjs.Dayjs | null
  isDisabled?: boolean
  pageDate?: dayjs.Dayjs
  yearPicker?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  isDisabled: false,
  pageDate: dayjs(),
  yearPicker: false,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate'])
const pageDate = useVModel<dayjs.Dayjs>(props, 'pageDate', emit)
const selectedDate = useVModel<dayjs.Dayjs>(props, 'selectedDate', emit)

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
    date = date.add(12, 'year').clone()
  } else {
    date = date.subtract(12, 'year').clone()
  }
  pageDate.value = date
  emit('update:pageDate', date)
}

const paginate = (action: 'next' | 'prev') => {
  if (props.yearPicker) {
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
  <div class="p-4 flex flex-col gap-4">
    <div class="flex justify-between items-center">
      <NcTooltip>
        <NcButton size="small" type="secondary" @click="paginate('prev')">
          <component :is="iconMap.doubleLeftArrow" class="h-4 w-4" />
        </NcButton>
        <template #title>
          <span>{{ $t('labels.previousYear') }}</span>
        </template>
      </NcTooltip>
      <span class="font-bold text-gray-700">{{ yearPicker ? 'Select Year' : pageDate.year() }}</span>
      <NcTooltip>
        <NcButton size="small" type="secondary" @click="paginate('next')">
          <component :is="iconMap.doubleRightArrow" class="h-4 w-4" />
        </NcButton>
        <template #title>
          <span>{{ $t('labels.nextYear') }}</span>
        </template>
      </NcTooltip>
    </div>
    <div class="border-1 border-gray-200 rounded-y-xl max-w-[350px]">
      <div class="grid grid-cols-4 gap-2 p-2">
        <template v-if="!yearPicker">
          <span
            v-for="(month, id) in months"
            :key="id"
            :class="{
              '!bg-brand-50 !border-1 !border-brand-500': isMonthSelected(month),
            }"
            class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
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
              '!bg-brand-50 !border-1 !border-brand-500': compareYear(year, selectedDate),
            }"
            class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
            @click="selectedDate = year"
          >
            {{ year.format('YYYY') }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
