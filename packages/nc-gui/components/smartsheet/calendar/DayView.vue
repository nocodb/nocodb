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
      return 'none'
    }
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
  for (const record of formattedData.value) {
    if (endCol && startCol) {
      const startDate = dayjs(record.row[startCol.title])
      const endDate = dayjs(record.row[endCol.title])
      if (
        (startDate.isSame(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) ||
        (startDate.isBefore(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) ||
        (startDate.isSame(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day'))
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

const renderData = computed(() => {
  if (data.value) {
    return data.value
  }
  return formattedData.value
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
      <div v-if="getSpanningRecords && getSpanningRecords.length" class="pb-3 bg-gray-50">
        <span class="text-xs text-gray-500 pl-3 pt-3 font-bold"> Records spanning multiple days </span>
        <LazySmartsheetRow
          v-for="(record, rowIndex) in getSpanningRecords.slice(0, 3)"
          :key="rowIndex"
          :row="record"
          class="mb-2"
        >
          <LazySmartsheetCalendarRecordCard
            :date="dayjs(record.row[calendarRange[0].fk_from_col.title]).format('H:mm')"
            :name="record.row[displayField.title]"
            :position="getRecordPosition(record)"
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
        <div class="absolute left-0 right-0 w-full">
          <LazySmartsheetRow
            v-for="(record, rowIndex) in formattedData.filter((rec) => !getSpanningRecords.includes(rec))"
            :key="rowIndex"
            :row="record"
          >
            <LazySmartsheetCalendarRecordCard
              :key="rowIndex"
              :date="dayjs(record.row[calendarRange[0].fk_from_col.title]).format('H:mm')"
              :name="record.row[displayField.title]"
              :position="getRecordPosition(record)"
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
