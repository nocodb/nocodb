<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes } from 'nocodb-sdk'
import type { Row } from '~/lib'

const emits = defineEmits(['expand-record'])

const { selectedDateRange, formattedData, calendarRange, selectedDate, displayField, calDataType } = useCalendarViewStoreOrThrow()

const container = ref(null)

const { width: containerWidth } = useElementSize(container)

const weekDates = computed(() => {
  const startOfWeek = new Date(selectedDateRange.value.start)
  const endOfWeek = new Date(selectedDateRange.value.end)
  const datesArray = []
  while (startOfWeek.getTime() <= endOfWeek.getTime()) {
    datesArray.push(new Date(startOfWeek))
    startOfWeek.setDate(startOfWeek.getDate() + 1)
  }
  return datesArray
})

const findFirstSuitableColumn = (recordsInDay: any, startDayIndex: number, spanDays: number) => {
  let column = 0
  while (true) {
    let isColumnSuitable = true
    for (let i = 0; i < spanDays; i++) {
      const dayIndex = startDayIndex + i
      if (!recordsInDay[dayIndex]) {
        recordsInDay[dayIndex] = {}
      }
      if (recordsInDay[dayIndex][column]) {
        isColumnSuitable = false
        break
      }
    }

    if (isColumnSuitable) {
      return column
    }
    column++
  }
}

const calendarData = computed(() => {
  if (!formattedData.value || !calendarRange.value) return []
  const recordsInDay: {
    [key: number]: {
      [key: number]: boolean
    }
  } = {
    0: {},
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
    6: {},
  }

  const recordsInRange: Array<Row> = []
  const perDayWidth = containerWidth.value / 7

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col
    if (fromCol && toCol) {
      for (const record of [...formattedData.value].filter((r) => {
        const startDate = dayjs(r.row[fromCol.title])
        const endDate = dayjs(r.row[toCol.title])
        return !endDate.isBefore(startDate)
      })) {
        let startDate = dayjs(record.row[fromCol.title])
        const ogStartDate = startDate.clone()
        const endDate = dayjs(record.row[toCol.title])

        if (startDate.isBefore(selectedDateRange.value.start)) {
          startDate = dayjs(selectedDateRange.value.start)
        }

        const startDaysDiff = startDate.diff(selectedDateRange.value.start, 'day')
        const spanDays = Math.max(Math.min(endDate.diff(startDate, 'day'), 6) + 1, 1)
        const widthStyle = `calc(max(${spanDays} * ${perDayWidth}px, ${perDayWidth}px))`

        let suitableColumn = -1
        for (let i = 0; i < spanDays; i++) {
          const dayIndex = startDaysDiff + i

          if (!recordsInDay[dayIndex]) {
            recordsInDay[dayIndex] = {}
          }

          if (suitableColumn === -1) {
            suitableColumn = findFirstSuitableColumn(recordsInDay, dayIndex, spanDays)
          }
        }

        // Mark the suitable column as occupied for the entire span
        for (let i = 0; i < spanDays; i++) {
          const dayIndex = startDaysDiff + i
          recordsInDay[dayIndex][suitableColumn] = true
        }

        let position = ''

        const isStartInRange =
          ogStartDate && ogStartDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')
        const isEndInRange = endDate && endDate.isBetween(selectedDateRange.value.start, selectedDateRange.value.end, 'day', '[]')

        if (isStartInRange && isEndInRange) {
          position = 'rounded'
        } else if (
          startDate &&
          endDate &&
          startDate.isBefore(selectedDateRange.value.start) &&
          endDate.isAfter(selectedDateRange.value.end)
        ) {
          position = 'none'
        } else if (
          startDate &&
          endDate &&
          (startDate.isAfter(selectedDateRange.value.end) || endDate.isBefore(selectedDateRange.value.start))
        ) {
          position = 'none'
        } else if (isStartInRange) {
          position = 'leftRounded'
        } else if (isEndInRange) {
          position = 'rightRounded'
        }

        recordsInRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range,
            position,
            style: {
              width: widthStyle,
              left: `${startDaysDiff * perDayWidth}px`,
              top: `${suitableColumn * 50}px`,
            },
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol.title])
        const startDaysDiff = Math.max(startDate.diff(selectedDateRange.value.start, 'day'), 0)
        const suitableColumn = findFirstSuitableColumn(recordsInDay, startDaysDiff, 1)
        recordsInDay[startDaysDiff][suitableColumn] = true

        recordsInRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range,
            position: 'rounded',
            style: {
              width: `calc(${perDayWidth}px)`,
              left: `${startDaysDiff * perDayWidth}px`,
              top: `${suitableColumn * 50}px`,
            },
          },
        })
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
        class="flex flex-col border-r-1 min-h-[100vh] last:border-r-0 items-center w-1/7"
        @click="selectedDate = date"
      ></div>
    </div>
    <div class="absolute mt-9 pointer-events-none inset-0">
      <div
        v-for="(record, id) in calendarData"
        :key="id"
        :class="{
          'ml-3': record.rowMeta.position === 'leftRounded',
          'mr-3': record.rowMeta.position === 'rightRounded',
          '': record.rowMeta.position === 'rounded',
        }"
        :style="record.rowMeta.style"
        class="absolute pointer-events-auto"
        draggable="true"
        @dragover.prevent
      >
        <LazySmartsheetRow :row="record">
          <LazySmartsheetCalendarRecordCard
            :date="
              calDataType === UITypes.DateTime
                ? dayjs(record.row[record.rowMeta.range.fk_from_col.title]).format('DD-MM-YYYY HH:MM')
                : dayjs(record.row[record.rowMeta.range.fk_from_col.title]).format('DD-MM-YYYY')
            "
            :name="record.row[displayField.title]"
            :position="record.rowMeta.position"
            :record="record"
            color="blue"
            @click="emits('expand-record', record)"
          />
        </LazySmartsheetRow>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
