<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

interface Props {
  isEmbed?: boolean
  data?: Row[] | null
}

const props = withDefaults(defineProps<Props>(), {
  isEmbed: false,
  data: null,
})

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const data = toRefs(props).data

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { pageDate, selectedTime, selectedDate, calDataType, formattedData, calendarRange } = useCalendarViewStoreOrThrow()

const renderData = computed(() => {
  if (data.value) {
    return data.value
  }
  return formattedData.value
})
const getRecordPosition = (record: Row) => {
  if (!calendarRange.value || !calendarRange.value[0]) return ''
  const startCol = calendarRange.value[0].fk_from_col
  const endCol = calendarRange.value[0].fk_to_col
  if (!endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    return startDate.isSame(selectedDate.value, 'day') ? 'rounded' : ''
  } else if (endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    const endDate = dayjs(record.row[endCol.title])
    // StartDate is Same as selectedDate and EndDate is Same as selectedDate -> Same Day No Spanning - none
    // StartDate is Same as selectedDate and EndDate is After selectedDate -> Spanning Right
    // StartDate is Before selectedDate and EndDate is Same as selectedDate -> Spanning Left
    // StartDate is Before selectedDate and EndDate is After selectedDate -> Spanning Both
    // StartDate is same as selectedDate and EndDate is Before selectedDate -> Spanning Left
    // StartDate is after selectedDate and EndDate is same as selectedDate -> Spanning Right
    // StartDate is after selectedDate and EndDate is before selectedDate -> Spanning Both
    // StartDate and no EndDate -> Same Day No Spanning - none
    // EndDate and no StartDate -> Same Day No Spanning - none
    if (startDate.isSame(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) {
      return 'rounded'
    } else if (startDate.isSame(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) {
      return 'leftRounded'
    } else if (startDate.isBefore(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) {
      return 'rightRounded'
    } else if (startDate.isBefore(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) {
      return 'rounded'
    } else if (startDate.isSame(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day')) {
      return 'rightRounded'
    } else if (startDate.isAfter(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) {
      return 'leftRounded'
    } else if (startDate.isAfter(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day')) {
      return 'rounded'
    } else {
      return 'rounded'
    }
  }
}

const timeSlots = reactive({})
const getRecordStyles = (record) => {
  if (!calendarRange.value || !calendarRange.value[0]) return ''

  const startColTitle = calendarRange.value[0].fk_from_col.title
  const endColTitle = calendarRange.value[0].fk_to_col.title

  const scheduleStart = dayjs(selectedDate.value).startOf('day').toDate()
  const scheduleEnd = dayjs(selectedDate.value).endOf('day').toDate()

  let fromDate = record.row[startColTitle] ? new Date(record.row[startColTitle]) : null
  let endDate = record.row[endColTitle] ? new Date(record.row[endColTitle]) : null

  if (!fromDate && !endDate) return null

  if (!fromDate) {
    fromDate = new Date(endDate.getTime() - 60 * 60000)
  } else if (!endDate) {
    endDate = new Date(fromDate.getTime() + 60 * 60000)
  }

  const scaleMinutes = (scheduleEnd - scheduleStart) / 60000
  const startMinutes = Math.max(0, (fromDate - scheduleStart) / 60000)
  const endMinutes = Math.min(scaleMinutes, (endDate - scheduleStart) / 60000)

  if (endMinutes < startMinutes) return null

  const height = ((endMinutes - startMinutes) / scaleMinutes) * 100
  const timeslot = `${fromDate.getHours()}:${Math.floor(fromDate.getMinutes() / 15) * 15}`

  // Calculate the column index based on timeSlots
  let columnIndex = -1
  if (timeSlots[timeslot]) {
    columnIndex = timeSlots[timeslot].findIndex((colEndTime) => startMinutes >= colEndTime)
    if (columnIndex === -1 && timeSlots[timeslot].length < 10) {
      columnIndex = timeSlots[timeslot].length
    } else if (columnIndex === -1) {
      columnIndex = 9 // Last column if there are already 10 columns
    }
  }

  // Calculate the width and left based on the column index
  const numColumns = columnIndex !== -1 ? Math.min(timeSlots[timeslot].length, 10) : 1
  const width = 100 / numColumns
  const left = columnIndex !== -1 ? width * columnIndex : 0

  return {
    top: `${(startMinutes / scaleMinutes) * 100}%`,
    height: `${height}%`,
    left: `calc(${left}% + 40px)`,
    width: `${width}%`,
  }
}

const getSpanningRecords = computed(() => {
  if (!calendarRange.value || !calendarRange.value[0]) return []
  const startCol = calendarRange.value[0].fk_from_col
  const endCol = calendarRange.value[0].fk_to_col
  const recordsSpanning = []
  // StartDate is Same as selectedDate and EndDate is Same as selectedDate -> Same Day No Spanning
  // StartDate is Same as selectedDate and EndDate is After selectedDate -> Spanning Right
  // StartDate is Before selectedDate and EndDate is Same as selectedDate -> Spanning Left
  // StartDate is Before selectedDate and EndDate is After selectedDate -> Spanning Both
  // StartDate is same as selectedDate and EndDate is Before selectedDate -> Spanning Left
  // StartDate is after selectedDate and EndDate is same as selectedDate -> Spanning Right
  // StartDate is after selectedDate and EndDate is before selectedDate -> Spanning Both
  for (const record of renderData.value) {
    if (endCol && startCol) {
      const startDate = dayjs(record.row[startCol.title])
      const endDate = dayjs(record.row[endCol.title])
      if (
        (startDate.isSame(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) ||
        (startDate.isBefore(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) ||
        (startDate.isSame(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day')) ||
        (startDate.isAfter(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day'))
      ) {
        recordsSpanning.push(record)
      }
    }
  }
  return recordsSpanning
})

const hours = computed<dayjs.Dayjs>(() => {
  const hours = []
  for (let i = 0; i < 24; i++) {
    hours.push(
      dayjs()
        .hour(i)
        .minute(0)
        .second(0)
        .millisecond(0)
        .year(selectedDate.value.getFullYear())
        .month(selectedDate.value.getMonth())
        .date(selectedDate.value.getDate()),
    )
  }
  return hours
})
</script>

<template>
  <template v-if="renderData && renderData.length && displayField.title && calendarRange[0].fk_from_col">
    <div
      v-if="calDataType === UITypes.Date"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 hover:bg-gray-50 ': props.isEmbed,
      }"
      class="flex flex-col pt-3 !gap-2 h-full w-full"
    >
      <LazySmartsheetRow v-for="(record, rowIndex) in renderData" :key="rowIndex" :row="record">
        <LazySmartsheetCalendarRecordCard
          :key="rowIndex"
          :date="record.row[calendarRange[0].fk_from_col.title]"
          :name="record.row[displayField.title]"
          :position="getRecordPosition(record)"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
    </div>
    <div
      v-else-if="calDataType === UITypes.DateTime"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !props.isEmbed,
        'border-r-1 h-full border-gray-200 ': props.isEmbed,
      }"
      class="flex flex-col w-full"
    >
      <div v-if="getSpanningRecords && getSpanningRecords.length" class="pb-3">
        <div class="text-xs text-gray-500 pl-3 py-3 font-bold">Records spanning multiple days</div>
        <LazySmartsheetRow v-for="(record, rowIndex) in getSpanningRecords.slice(0, 4)" :key="rowIndex" :row="record">
          <LazySmartsheetCalendarRecordCard
            :date="dayjs(record.row[calendarRange[0].fk_from_col.title]).format('H:mm')"
            :name="record.row[displayField.title]"
            :position="getRecordPosition(record)"
            class="mb-2"
            color="blue"
            size="small"
            @click="emit('expand-record', record)"
          />
        </LazySmartsheetRow>
      </div>
      <div class="relative">
        <div
          v-for="hour in hours"
          :key="hour"
          :class="{
            '!border-brand-500': dayjs(hour).isSame(selectedTime),
          }"
          class="flex w-full relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
          @click="selectedTime = dayjs(hour).toDate()"
        >
          <div class="pt-2 px-4 text-xs text-gray-500 font-semibold h-20">
            {{ dayjs(hour).format('H A') }}
          </div>
          <div></div>
          <NcButton
            :class="{
              '!block': dayjs(hour).isSame(selectedTime),
              '!hidden': !dayjs(hour).isSame(selectedTime),
            }"
            class="mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
            size="xsmall"
            type="secondary"
            @click="emit('new-record')"
          >
            <component :is="iconMap.plus" class="h-4 w-4 text-gray-700 transition-all" />
          </NcButton>
        </div>
        <div
          v-for="(record, rowIndex) in renderData.filter((rec) => !getSpanningRecords.includes(rec))"
          :key="rowIndex"
          :class="{
            'ml-3': getRecordPosition(record) === 'leftRounded',
            'mr-3': getRecordPosition(record) === 'rightRounded',
            'mx-3': getRecordPosition(record) === 'rounded',
          }"
          :style="getRecordStyles(record)"
          class="absolute"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :key="rowIndex"
              :date="dayjs(record.row[calendarRange[0].fk_from_col.title]).format('H:mm')"
              :name="record.row[displayField.title]"
              :position="getRecordPosition(record)"
              class="!h-full"
              color="blue"
              size="small"
              @click="emit('expand-record', record)"
            />
          </LazySmartsheetRow>
        </div>
      </div>
    </div>
  </template>
  <div v-else-if="!data" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
