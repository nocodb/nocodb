<script lang="ts" setup>
import dayjs from 'dayjs'

interface Props {
  selectedDate?: Date | null
  isDisabled?: boolean
  pageDate?: Date
  yearPicker?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedDate: null,
  isDisabled: false,
  pageDate: new Date(),
  yearPicker: false,
})
const emit = defineEmits(['update:selectedDate', 'update:pageDate'])
const pageDate = useVModel(props, 'pageDate', emit)
const selectedDate = useVModel(props, 'selectedDate', emit)

const years = computed(() => {
  const date = dayjs(pageDate.value)
  const startOfYear = date.startOf('year')
  const years: dayjs.Dayjs[] = []
  for (let i = 0; i < 12; i++) {
    years.push(dayjs(startOfYear).add(i, 'year'))
  }
  return years
})

const currentYear = computed(() => {
  return pageDate.value.getFullYear()
})

const months = computed(() => {
  const date = dayjs(pageDate.value)

  const months: dayjs.Dayjs[] = []
  for (let i = 0; i < 12; i++) {
    months.push(date.set('month', i))
  }
  return months
})

const compareDates = (date1: dayjs.Dayjs, date2: dayjs.Dayjs) => {
  if (!date1 || !date2) return false
  return date1.isSame(date2, 'month') && date1.isSame(date2, 'year')
}

const isMonthSelected = (date: dayjs.Dayjs) => {
  if (!selectedDate.value) return false
  return compareDates(date, dayjs(selectedDate.value))
}

const paginateMonth = (action: 'next' | 'prev') => {
  let date = dayjs(pageDate.value)
  if (action === 'next') {
    date = date.add(1, 'year')
  } else {
    date = date.subtract(1, 'year')
  }
  pageDate.value = date.toDate()
  emit('update:pageDate', date.toDate())
}

const paginateYear = (action: 'next' | 'prev') => {
  let date = dayjs(pageDate.value)
  if (action === 'next') {
    date = date.add(12, 'year').clone()
  } else {
    date = date.subtract(12, 'year').clone()
  }
  pageDate.value = date.toDate()
  emit('update:pageDate', date.toDate())
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
      <span class="font-bold text-gray-700">{{ yearPicker ? 'Select Year' : currentYear }}</span>
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
              '!bg-brand-50 !border-2 !border-brand-500': isMonthSelected(month),
            }"
            class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
            @click="selectedDate = month.toDate()"
          >
            {{ month.format('MMM') }}
          </span>
        </template>
        <template v-else>
          <span
            v-for="(year, id) in years"
            :key="id"
            :class="{
              '!bg-brand-50 !border-2 !border-brand-500': compareYear(year, dayjs(selectedDate)),
            }"
            class="h-9 rounded-lg flex font-medium items-center justify-center hover:(border-1 border-gray-200 bg-gray-100) text-gray-500 cursor-pointer"
            @click="selectedDate = year.toDate()"
          >
            {{ year.format('YYYY') }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
