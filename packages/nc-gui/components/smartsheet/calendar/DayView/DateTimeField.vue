<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const container = ref()

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { selectedDate, selectedTime, calDataType, formattedData, calendarRange } = useCalendarViewStoreOrThrow()

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []
  for (let i = 0; i < 24; i++) {
    hours.push(
      dayjs()
        .hour(i)
        .minute(0)
        .second(0)
        .millisecond(0)
        .year(selectedDate.value.getFullYear() || dayjs().year())
        .month(selectedDate.value.getMonth() || dayjs().month())
        .date(selectedDate.value.getDate() || dayjs().date()),
    )
  }
  return hours
})

function getRandomNumbers() {
  const typedArray = new Uint8Array(10)
  const randomValues = window.crypto.getRandomValues(typedArray)
  return randomValues.join('')
}

const recordsAcrossAllRange = computed<Row[]>(() => {
  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  const overlaps = {}

  const perRecordHeight = 40

  if (!calendarRange.value) return []

  let recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col
    if (fromCol && endCol) {
      for (const record of formattedData.value) {
        const id = record.rowMeta.id ?? getRandomNumbers()
        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        if (!startDate.isValid()) continue

        const topInPixels = (startDate.hour() + startDate.minute() / 60) * 80
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const startHour = startDate.hour()
        const endHour = endDate.hour()

        let startMinutes = startDate.minute() + startHour * 60

        const endMinutes = endDate.minute() + endHour * 60

        while (startMinutes < endMinutes) {
          if (!overlaps[startMinutes]) {
            overlaps[startMinutes] = []
          }
          overlaps[startMinutes].push(id)
          startMinutes += 15
        }

        const style: Partial<CSSStyleDeclaration> = {
          top: `${topInPixels + 10}px`,
          height: `${heightInPixels}px`,
        }

        let position = 'none'
        const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(selectedDate.value, 'day')

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
            id,
            range: range as any,
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol.title!])
        const scaleMin = (scheduleEnd - scheduleStart) / 60000

        const startMinutes = Math.max((startDate - scheduleStart) / 60000, 0)
        const endMinutes = Math.min((startDate - scheduleStart) / 60000, scaleMin)

        const height = ((endMinutes - startMinutes) / scaleMin) * 100
        const top = (startMinutes / scaleMin) * 100

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style: {
              width: '100%',
              left: `${50}px`,
              top: `${top}%`,
            },
            position: 'rounded',
          },
        })
      }
    }
  })

  recordsByRange = recordsByRange.map((record) => {
    let maxOverlaps = 1
    let overlapIndex = 0
    for (const minutes in overlaps) {
      if (overlaps[minutes].includes(record.rowMeta.id)) {
        maxOverlaps = Math.max(maxOverlaps, overlaps[minutes].length)
        console.log(
          record.row[displayField.value.title!],
          maxOverlaps,
          overlaps[minutes],
          overlaps[minutes].indexOf(record.rowMeta.id),
        )
        overlapIndex = Math.max(overlaps[minutes].indexOf(record.rowMeta.id), overlapIndex)
      }
    }

    const width = 100 / maxOverlaps
    const left = width * overlapIndex

    record.rowMeta.style = {
      ...record.rowMeta.style,
      left: left === 0 ? '50px' : `calc(${left}% + 30px)`,
      width: `${width}%`,
    }
    return record
  })

  return recordsByRange
})
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.length"
    ref="container"
    class="w-full relative h-[calc(100vh-10.8rem)] overflow-y-auto nc-scrollbar-md"
  >
    <div
      v-for="(hour, index) in hours"
      :key="index"
      :class="{
        '!border-brand-500': hour.isSame(selectedTime),
      }"
      class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
      @click="selectedTime = hour.toDate()"
    >
      <div class="pt-2 px-4 text-xs text-gray-500 font-semibold h-20">
        {{ dayjs(hour).format('H A') }}
      </div>
      <div></div>
      <NcButton
        :class="{
          '!block': hour.isSame(selectedTime),
          '!hidden': !hour.isSame(selectedTime),
        }"
        class="mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
        size="xsmall"
        type="secondary"
        @click="emit('new-record', { row: {} })"
      >
        <component :is="iconMap.plus" class="h-4 w-4 text-gray-700 transition-all" />
      </NcButton>
    </div>

    <div
      v-for="(record, rowIndex) in recordsAcrossAllRange"
      :key="rowIndex"
      :draggable="UITypes.DateTime === calDataType"
      :style="record.rowMeta.style"
      class="absolute mt-2"
      @dragstart="dragStart($event, record)"
      @dragover.prevent
    >
      <LazySmartsheetRow :row="record">
        <LazySmartsheetCalendarRecordCard
          :date="dayjs(record.row[record.rowMeta.range!.fk_from_col.title!]).format('HH:mm')"
          :name="record.row[displayField!.title!]"
          :position="record.rowMeta.position"
          :record="record"
          :resize="false"
          color="blue"
          size="auto"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
    </div>
  </div>

  <div v-else ref="container" class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center">
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
