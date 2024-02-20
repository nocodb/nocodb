<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

interface Props {
  isEmbed?: boolean
  renderDate?: Date | null
  data?: Row[] | null
}

const props = withDefaults(defineProps<Props>(), {
  isEmbed: false,
  renderDate: null,
  data: null,
})

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const container = ref()

const data = toRefs(props).data

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const {
  selectedTime,
  selectedDate: _selectedDate,
  calDataType,
  formattedData,
  calendarRange,
  selectedDateRange,
} = useCalendarViewStoreOrThrow()

const renderData = computed(() => {
  if (data.value) {
    return data.value
  }
  return formattedData.value
})

const selectedDate = computed(() => {
  if (props.isEmbed) {
    return props.renderDate ?? renderData
  }
  return _selectedDate.value
})

const recordsAcrossAllRange = computed<Row[]>(() => {
  if (!calendarRange.value) return []
  const recordsByRange = []

  calendarRange.value.forEach((range) => {
    if (range.fk_from_col && range.fk_to_col) {
      const startCol = range.fk_from_col.title
      const endCol = range.fk_to_col.title
      for (const record of renderData.value) {
        const startDate = dayjs(record.row[startCol])
        const endDate = dayjs(record.row[endCol])
        if (
          startDate.isSame(selectedDate.value, 'day') ||
          endDate.isSame(selectedDate.value, 'day') ||
          (startDate.isBefore(selectedDate.value, 'day') && endDate.isAfter(selectedDate.value, 'day')) ||
          (startDate.isSame(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day')) ||
          (startDate.isAfter(selectedDate.value, 'day') && endDate.isSame(selectedDate.value, 'day')) ||
          (startDate.isAfter(selectedDate.value, 'day') && endDate.isBefore(selectedDate.value, 'day'))
        ) {
          recordsByRange.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              range,
            },
          })
        }
      }
    } else if (range.fk_from_col) {
      const startCol = range.fk_from_col.title
      for (const record of renderData.value) {
        const startDate = dayjs(record.row[startCol])
        if (startDate.isSame(selectedDate.value, 'day')) {
          recordsByRange.push({
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
  return recordsByRange
})

const getRecordPosition = (record: Row) => {
  if (!calendarRange.value) return ''
  if (!record.rowMeta.range) return ''
  const range = record.rowMeta.range
  const startCol = range.fk_from_col
  const endCol = range.fk_to_col
  if (!endCol && startCol) {
    const startDate = dayjs(record.row[startCol.title])
    if (props.isEmbed) {
      return startDate.isSame(props.renderDate, 'day') ? 'rounded' : ''
    }
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
        .date(selectedDate.value.getDate())
        .toDate(),
    )
  }
  return hours
})

const getRecordStyle = (record: Row) => {
  if (!calendarRange.value || !record.rowMeta.range) return {}
  const range = record.rowMeta.range
  const startCol = range.fk_from_col.title
  const endCol = range.fk_to_col.title
  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')
  const startDate = dayjs(record.row[startCol])
  const endDate = dayjs(record.row[endCol])

  const scaleMin = (scheduleEnd - scheduleStart) / 60000
  const startMinutes = Math.max((startDate - scheduleStart) / 60000, 0)
  const endMinutes = Math.min((endDate - scheduleStart) / 60000, scaleMin)

  const height = ((endMinutes - startMinutes) / scaleMin) * 100
  const top = (startMinutes / scaleMin) * 100

  const columnIndex = getColumnIndexFromGroup(record)
  const totalColumns = getTotalColumns(record)

  const width = 100 / totalColumns
  const left = width * columnIndex
  return {
    top: `${top}%`,
    height: `max(${height}%, 40px)`,
    width: columnIndex === 0 && calDataType.value === UITypes.DateTime ? `calc(${width}% - 69px)` : `${width}%`,
    left: columnIndex === 0 && calDataType.value === UITypes.DateTime ? `calc(${left}% + 69px)` : `${left}%`,
  }
}

const dragStart = (event: DragEvent, record: Row) => {
  const eventRect = event.target.getBoundingClientRect()
  const initialClickOffsetY = event.clientY - eventRect.top

  event.dataTransfer?.setData(
    'text/plain',
    JSON.stringify({
      record,
      initialClickOffsetY,
    }),
  )
}

const dropEvent = (event: DragEvent) => {
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const { record, initialClickOffsetY } = JSON.parse(data)

    const { top, height } = container.value.getBoundingClientRect()

    const percent = (event.clientY - top - initialClickOffsetY - window.scrollY) / height

    const minutes = percent * 1440

    const newStartTime = dayjs(selectedDate.value).startOf('day').add(minutes, 'minutes')
    const newEndTime = dayjs(newStartTime).add(
      dayjs(record.row[calendarRange.value[0].fk_to_col.title]).diff(
        dayjs(record.row[calendarRange.value[0].fk_from_col.title]),
        'minutes',
      ),
      'minutes',
    )

    // TODO: Update record with new start and end time
  }
}
</script>

<template>
  <template v-if="((renderData && renderData.length) || isEmbed) && displayField">
    <div
      v-if="calDataType === UITypes.Date"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !isEmbed,
        'border-r-1 h-full border-gray-200 hover:bg-gray-50 ': isEmbed,
        'bg-gray-50': isEmbed && dayjs(selectedDate).isSame(renderDate, 'day'),
      }"
      class="flex flex-col pt-3 !gap-2 h-full w-full"
      @click="
        () => {
          if (renderDate) {
            selectedDate = renderDate
          }
        }
      "
    >
      <LazySmartsheetRow v-for="(record, rowIndex) in recordsAcrossAllRange" :key="rowIndex" :row="record">
        <LazySmartsheetCalendarRecordCard
          :key="rowIndex"
          :date="record.row[record.rowMeta.range.fk_from_col.title]"
          :name="record.row[displayField.title]"
          :position="getRecordPosition(record)"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
      <div class="h-full"></div>
    </div>
    <div
      v-else-if="calDataType === UITypes.DateTime"
      :class="{
        'h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md': !isEmbed,
        'border-r-1 h-full border-gray-200 ': isEmbed,
      }"
      class="flex flex-col w-full"
    >
      <div ref="container" class="relative" @drop="dropEvent($event)">
        <div
          v-for="(hour, index) in hours"
          :key="index"
          :class="{
            '!border-brand-500': dayjs(hour).isSame(selectedTime) && !isEmbed,
          }"
          class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
          @click="
            () => {
              if (!isEmbed) selectedTime = hour
            }
          "
        >
          <div
            v-if="(isEmbed && dayjs(hour).isSame(dayjs(selectedDateRange.start), 'day')) || !isEmbed"
            class="pt-2 px-4 text-xs text-gray-500 font-semibold h-20"
          >
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
          v-for="(record, rowIndex) in renderData"
          :key="rowIndex"
          :class="{
            'ml-3': getRecordPosition(record) === 'leftRounded',
            'mr-3': getRecordPosition(record) === 'rightRounded',
            '': getRecordPosition(record) === 'rounded',
          }"
          :style="getRecordStyle(record)"
          class="absolute"
          draggable="true"
          @dragstart="dragStart($event, record)"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :key="rowIndex"
              :date="dayjs(record.row[record.rowMeta.range.fk_from_col.title]).format('H:mm')"
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
