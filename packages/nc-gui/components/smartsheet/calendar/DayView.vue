<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const container = ref()

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { selectedTime, selectedDate, calDataType, formattedData, calendarRange } = useCalendarViewStoreOrThrow()

const recordsAcrossAllRange = computed<Row[]>(() => {
  if (!calendarRange.value) return []

  const recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col
    if (fromCol && endCol) {
      for (const record of formattedData.value) {
        const scheduleStart = dayjs(selectedDate.value).startOf('day')
        const scheduleEnd = dayjs(selectedDate.value).endOf('day')
        const startDate = dayjs(record.row[fromCol.title])
        const endDate = dayjs(record.row[endCol.title])
        const scaleMin = (scheduleEnd - scheduleStart) / 60000
        const startMinutes = Math.max((startDate - scheduleStart) / 60000, 0)
        const endMinutes = Math.min((endDate - scheduleStart) / 60000, scaleMin)

        const height = ((endMinutes - startMinutes) / scaleMin) * 100
        const top = (startMinutes / scaleMin) * 100

        const columnIndex = 0 // getColumnIndexFromGroup(record)
        const totalColumns = 0 // getTotalColumns(record)

        const width = 100 / totalColumns
        const left = width * columnIndex

        const style: Partial<CSSStyleDeclaration> = {
          top: `${top}%`,
          height: `max(${height}%, 40px)`,
          width: columnIndex === 0 && calDataType.value === UITypes.DateTime ? `calc(${width}% - 69px)` : `${width}%`,
          left: columnIndex === 0 && calDataType.value === UITypes.DateTime ? `calc(${left}% + 69px)` : `${left}%`,
        }

        let position = 'none'
        const isSelectedDay = (date) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date) => date.isAfter(selectedDate.value, 'day')

        console.log(selectedDate.value, startDate, endDate)
        console.log(isSelectedDay(startDate), isSelectedDay(endDate))
        if (isSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rounded'
        } else if (isBeforeSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'none'
        } else if (isSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'leftRounded'
        } else if (isBeforeSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rightRounded'
        } else {
          position = 'none'
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            position,
            style,
            range,
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range,
            position: 'rounded',
          },
        })
      }
    }
  })
  return recordsByRange
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
        .year(selectedDate.value.getFullYear() || dayjs().year())
        .month(selectedDate.value.getMonth() || dayjs().month())
        .date(selectedDate.value.getDate() || dayjs().date())
        .toDate(),
    )
  }
  return hours
})

const dragStart = (event: DragEvent, record: Row) => {
  const eventRect = (event.target as HTMLElement).getBoundingClientRect()
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
      dayjs(record.row[record.rowMeta.range.fk_to_col.title]).diff(
        dayjs(record.row[record.rowMeta.range.fk_to_col.title]),
        'minutes',
      ),
      'minutes',
    )

    // TODO: Update record with new start and end time
  }
}
</script>

<template>
  <template v-if="recordsAcrossAllRange && recordsAcrossAllRange.length && displayField">
    <div
      v-if="calDataType === UITypes.Date"
      class="flex flex-col pt-3 !gap-2 h-full w-full h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md"
    >
      <LazySmartsheetRow v-for="(record, rowIndex) in recordsAcrossAllRange" :key="rowIndex" :row="record">
        <LazySmartsheetCalendarRecordCard
          :key="rowIndex"
          :date="record.row[record.rowMeta.range.fk_from_col.title]"
          :name="record.row[displayField.title]"
          :position="record.rowMeta.position"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
      <div class="h-full"></div>
    </div>
    <div
      v-else-if="calDataType === UITypes.DateTime"
      class="flex flex-col w-full h-calc(100vh-10.8rem) overflow-y-auto nc-scrollbar-md"
    >
      <div ref="container" class="relative" @drop="dropEvent($event)">
        <div
          v-for="(hour, index) in hours"
          :key="index"
          :class="{
            '!border-brand-500': dayjs(hour).isSame(selectedTime),
          }"
          class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
          @click="selectedTime = hour"
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
          v-for="(record, rowIndex) in recordsAcrossAllRange"
          :key="rowIndex"
          :class="{
            'ml-3': record.rowMeta.position === 'leftRounded',
            'mr-3': record.rowMeta.position === 'rightRounded',
            '': record.rowMeta.position === 'rounded',
          }"
          :style="record.rowMeta.style"
          class="absolute"
          draggable="true"
          @dragstart="dragStart($event, record)"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :date="dayjs(record.row[record.rowMeta.range.fk_from_col.title]).format('H:mm')"
              :name="record.row[displayField.title]"
              :position="record.rowMeta.position"
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
  <div v-else-if="!recordsAcrossAllRange" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
