<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib'

const emits = defineEmits(['expand-record'])

const { selectedDateRange, formattedData, calendarRange, selectedDate, displayField } = useCalendarViewStoreOrThrow()

const container = ref(null)

const { width: containerWidth } = useElementSize(container)

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

const getRecordPosition = (record: Row) => {
  if (!calendarRange.value) return ''
  if (!record.rowMeta.range) return ''
  const range = record.rowMeta.range
  const startCol = range.fk_from_col
  const endCol = range.fk_to_col
  if (!endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])

    return startDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')
      ? 'rounded'
      : startDate.isBefore(selectedDateRange.value.start)
      ? 'rightRounded'
      : 'leftRounded'
  } else if (endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    const endDate = dayjs(record.row[endCol.title])

    // StartDate is same/after as selectedDateRange start and EndDate is same/before as selectedDateRange end -> No Spanning - none
    // EndDate is same/after selectedDateRange start and StartDate is same/before selectedDateRange end -> No Spanning - none
    // StartDate is same as selectedDateRange start and no EndDate -> no Spanning - none
    // EndDate is same as selectedDateRange end and no StartDate -> no Spanning - none

    // StartDate is same/after as selectedDateRange start and EndDate is after selectedDateRange end -> Spanning Right
    // EndDate is same/after selectedDateRange start and StartDate is after selectedDateRange end -> Spanning Right

    // StartDate is before selectedDateRange start and EndDate is before selectedDateRange end -> Spanning Left
    // EndDate is before selectedDateRange start and StartDate is before selectedDateRange end -> Spanning Left

    // StartDate is before selectedDateRange start and EndDate is after selectedDateRange end -> Spanning Both
    // StartDate is after selectedDateRange end and EndDate is before selectedDateRange start -> Spanning Both

    if (startDate.isSameOrAfter(selectedDateRange.value.start) && endDate.isSameOrBefore(selectedDateRange.value.end)) {
      return 'rounded'
    } else if (endDate.isSameOrAfter(selectedDateRange.value.start) && startDate.isSameOrBefore(selectedDateRange.value.end)) {
      return 'rounded'
    } else if ((startDate && !endDate) || (endDate && !startDate)) {
      return 'rounded'
    } else if (startDate.isSameOrAfter(selectedDateRange.value.start) && endDate.isAfter(selectedDateRange.value.end)) {
      return 'leftRounded'
    } else if (endDate.isSameOrAfter(selectedDateRange.value.start) && startDate.isAfter(selectedDateRange.value.end)) {
      return 'leftRounded'
    } else if (startDate.isBefore(selectedDateRange.value.start) && endDate.isBefore(selectedDateRange.value.end)) {
      return 'rightRounded'
    } else if (endDate.isBefore(selectedDateRange.value.start) && startDate.isBefore(selectedDateRange.value.end)) {
      return 'rightRounded'
    } else if (startDate.isBefore(selectedDateRange.value.start) && endDate.isAfter(selectedDateRange.value.end)) {
      return 'rounded'
    } else if (startDate.isAfter(selectedDateRange.value.end) && endDate.isBefore(selectedDateRange.value.start)) {
      return 'rounded'
    }
  }
}

const calculateRecordStyle = (record: Row, id: number) => {
  const range = record.rowMeta.range
  if (!range) return {}

  const startCol = range.fk_from_col
  const endCol = range.fk_to_col
  const perDayWidth = containerWidth.value / 7

  const startDate = dayjs(record.row[startCol.title])
  const startDay = dayjs(selectedDateRange.value.start)
  const daysDiff = startDate.diff(startDay, 'day')

  let widthStyle

  if (endCol) {
    const endDate = dayjs(record.row[endCol.title])
    const endDaysDiff = endDate.diff(startDay, 'day')
    const spanDays = endDaysDiff - daysDiff + 1
    widthStyle = `calc(max(${spanDays} * ${perDayWidth}px, ${perDayWidth}px))`
  } else {
    widthStyle = `calc(${perDayWidth}px)`
  }

  return {
    left: `${daysDiff * perDayWidth}px`,
    top: `${id * 50}px`,
    width: widthStyle,
  }
}

const calendarData = computed(() => {
  if (!formattedData.value || !calendarRange.value) return []
  const recordsInRange: Array<Row> = []
  calendarRange.value.forEach((range) => {
    if (range.fk_from_col && range.fk_to_col) {
      const fromCol = range.fk_from_col
      const toCol = range.fk_to_col

      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol])
        const endDate = dayjs(record.row[toCol])
        if (
          (startDate.isSameOrAfter(selectedDateRange.value.start) && endDate.isSameOrBefore(selectedDateRange.value.end)) ||
          (endDate.isSameOrAfter(selectedDateRange.value.start) && startDate.isSameOrBefore(selectedDateRange.value.end)) ||
          (startDate.isSameOrAfter(selectedDateRange.value.start) && endDate.isAfter(selectedDateRange.value.end)) ||
          (endDate.isSameOrAfter(selectedDateRange.value.start) && startDate.isAfter(selectedDateRange.value.end)) ||
          (startDate.isBefore(selectedDateRange.value.start) && endDate.isBefore(selectedDateRange.value.end)) ||
          (endDate.isBefore(selectedDateRange.value.start) && startDate.isBefore(selectedDateRange.value.end)) ||
          (startDate.isBefore(selectedDateRange.value.start) && endDate.isAfter(selectedDateRange.value.end)) ||
          (startDate.isAfter(selectedDateRange.value.end) && endDate.isBefore(selectedDateRange.value.start))
        ) {
          recordsInRange.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              range,
            },
          })
        }
      }
    } else if (range.fk_from_col) {
      const fromCol = range.fk_from_col
      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol.title])
        if (startDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')) {
          recordsInRange.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              range,
            },
          })
        }
      }
    }
  })

  return recordsInRange
})
</script>

<template>
  <div class="flex relative flex-col">
    <div class="flex">
      <div
        v-for="date in weekDates"
        :key="date.toISOString()"
        class="w-1/7 text-center text-sm text-gray-500 w-full py-1 border-gray-200 border-b-1 border-r-1 bg-gray-50"
      >
        {{ dayjs(date).format('DD ddd') }}
      </div>
    </div>
    <div ref="container" class="flex h-[calc(100vh-11.6rem)]">
      <div
        v-for="date in weekDates"
        :key="date.toISOString()"
        :class="{
          '!border-2 border-brand-500': dayjs(date).isSame(selectedDate, 'day'),
        }"
        class="flex flex-col border-r-1 last:border-r-0 items-center w-1/7"
        @click="selectedDate = date"
      ></div>
    </div>
    <div class="absolute mt-9 inset-0">
      <div
        v-for="(record, id) in calendarData"
        :key="id"
        :class="{
          'ml-3': getRecordPosition(record) === 'leftRounded',
          'mr-3': getRecordPosition(record) === 'rightRounded',
          '': getRecordPosition(record) === 'rounded',
        }"
        :style="calculateRecordStyle(record, id)"
        class="absolute"
        draggable="true"
        @dragover.prevent
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :date="record.row[record.rowMeta.range.fk_from_col.title]"
            :position="getRecordPosition(record)"
            :title="record.row[displayField.title]"
            color="blue"
            @click="emits('expand-record', record)"
          />
        </LazySmartsheetRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
