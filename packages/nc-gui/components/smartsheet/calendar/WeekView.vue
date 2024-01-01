<script lang="ts" setup>
import dayjs from 'dayjs'

const { selectedDateRange, formattedData, calendarRange } = useCalendarViewStoreOrThrow()

const weekDates = computed(() => {
  const startOfWeek = new Date(selectedDateRange.value.start)
  const endOfWeek = new Date(selectedDateRange.value.end)
  const datesArray = []
  while (startOfWeek.getDate() <= endOfWeek.getDate()) {
    datesArray.push(new Date(startOfWeek))
    startOfWeek.setDate(startOfWeek.getDate() + 1)
  }
  return datesArray
})

const getData = (date: Date) => {
  const range = calendarRange.value[0]
  if (!range) return []
  if (!formattedData.value) return []
  return formattedData.value.filter((record) => dayjs(date).isSame(dayjs(record.row[range.fk_from_col.title])))
}
</script>

<template>
  <div class="flex flex-col">
    <div class="flex">
      <div
        v-for="date in weekDates"
        :key="date.toISOString()"
        class="w-1/7 text-center text-sm text-gray-500 w-full py-1 !last:mr-2.5 border-gray-200 border-b-1 border-r-1 bg-gray-50"
      >
        {{ dayjs(date).format('DD ddd') }}
      </div>
    </div>
    <div class="flex overflow-auto nc-scrollbar-md h-[calc(100vh-12rem)]">
      <div v-for="date in weekDates" :key="date.toISOString()" class="flex flex-col items-center w-1/7">
        <LazySmartsheetCalendarDayView :data="getData(date)" :is-embed="true" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
