<script lang="ts" setup>
import { UITypes } from 'nocodb-sdk'
import dayjs from 'dayjs'
import { type Row, computed, ref } from '#imports'

const emit = defineEmits(['expand-record', 'new-record'])
const meta = inject(MetaInj, ref())
const fields = inject(FieldsInj, ref([]))

const container = ref()

const displayField = computed(() => meta.value?.columns?.find((c) => c.pv && fields.value.includes(c)) ?? null)

const { selectedTime, selectedDate, calDataType, formattedData, formattedSideBarData, calendarRange, updateRowProperty } =
  useCalendarViewStoreOrThrow()

const recordsAcrossAllRange = computed<Row[]>(() => {
  let dayRecordCount = 0
  const perRecordHeight = 40
  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  if (!calendarRange.value) return []

  const recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col
    if (fromCol && endCol) {
      for (const record of formattedData.value) {
        const startDate = dayjs(record.row[fromCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        dayRecordCount++

        const style: Partial<CSSStyleDeclaration> = {
          top: `${(dayRecordCount - 1) * perRecordHeight}px`,
          width: '100%',

          // left: columnIndex === 0 && calDataType.value === UITypes.DateTime ? `calc(${left}% + 69px)` : `${left}%`,
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
            range: range as any,
          },
        })
      }
    } else if (fromCol) {
      for (const record of formattedData.value) {
        dayRecordCount++
        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style: {
              width: '100%',
              left: '0',
              top: `${(dayRecordCount - 1) * perRecordHeight}px`,
            },
            position: 'rounded',
          },
        })
      }
    }
  })
  return recordsByRange
})

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
const dragElement = ref<HTMLElement | null>(null)

const dragStart = (event: DragEvent, record: Row) => {
  dragElement.value = event.target as HTMLElement

  dragElement.value.classList.add('hide')
  dragElement.value.style.boxShadow = '0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.10)'
  const eventRect = dragElement.value.getBoundingClientRect()

  const initialClickOffsetX = event.clientX - eventRect.left
  const initialClickOffsetY = event.clientY - eventRect.top

  event.dataTransfer?.setData(
    'text/plain',
    JSON.stringify({
      record,
      initialClickOffsetY,
      initialClickOffsetX,
    }),
  )
}

const dropEvent = (event: DragEvent) => {
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
      initialClickOffsetY,
      initialClickOffsetX,
    }: {
      record: Row
      initialClickOffsetY: number
      initialClickOffsetX: number
    } = JSON.parse(data)
    const { top, height, width, left } = container.value.getBoundingClientRect()

    const percentY = (event.clientY - top - window.scrollY) / height
    const percentX = (event.clientX - left - window.scrollX) / width
    /*
    const percentY = (event.clientY - top - initialClickOffsetY - window.scrollY) / height
    const percentX = (event.clientX - left - initialClickOffsetX - window.scrollX) / width
*/

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) return

    const newStartDate = dayjs(selectedDate.value)
      .startOf('day')
      .add(percentY * 1440, 'minutes')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD'),
      },
    }

    const updateProperty = [fromCol.title!]

    if (toCol) {
      const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
      const toDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

      if (fromDate && toDate) {
        endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }
      newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD')
      updateProperty.push(toCol.title!)
    }

    if (!newRow) return

    if (dragElement.value) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        if (pk === extractPkFromRow(newRow.row, meta.value!.columns!)) {
          return newRow
        }
        return r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)

        return pk !== extractPkFromRow(newRow.row, meta.value!.columns!)
      })
    }

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value.classList.remove('hide')

      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
  }
}
</script>

<template>
  <div
    v-if="recordsAcrossAllRange.length"
    ref="container"
    class="w-full relative h-[calc(100vh-10.8rem)] overflow-y-auto nc-scrollbar-md"
    @drop="dropEvent"
  >
    <template v-if="calDataType === UITypes.DateTime">
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
    </template>

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
          :date="dayjs(record.row[record.rowMeta.range!.fk_from_col.title!]).format('H:mm')"
          :name="record.row[displayField!.title!]"
          :position="record.rowMeta.position"
          :record="record"
          :resize="false"
          color="blue"
          size="small"
          @click="emit('expand-record', record)"
        />
      </LazySmartsheetRow>
    </div>
  </div>

  <div
    v-else
    ref="container"
    class="w-full h-full flex text-md font-bold text-gray-500 items-center justify-center"
    @drop="dropEvent"
  >
    No Records in this day
  </div>
</template>

<style lang="scss" scoped></style>
