<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

const emits = defineEmits(['expandRecord', 'newRecord'])

const {
  selectedDateRange,
  formattedData,
  formattedSideBarData,
  calendarRange,
  selectedDate,
  displayField,
  updateRowProperty,
  viewMetaProperties,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const maxVisibleDays = computed(() => {
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

const container = ref<null | HTMLElement>(null)

const { $e } = useNuxtApp()

const { width: containerWidth } = useElementSize(container)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref())

const { fields: _fields } = useViewColumnsOrThrow()

const fieldStyles = computed(() => {
  if (!_fields.value) return new Map()
  return new Map(
    _fields.value.map((field) => [
      field.fk_column_id,
      {
        underline: field.underline,
        bold: field.bold,
        italic: field.italic,
      },
    ]),
  )
})

const getFieldStyle = (field: ColumnType) => {
  return fieldStyles.value.get(field.id)
}

// Calculate the dates of the week
const weekDates = computed(() => {
  let startOfWeek = dayjs(selectedDateRange.value.start)
  let endOfWeek = dayjs(selectedDateRange.value.end)

  if (maxVisibleDays.value === 5) {
    endOfWeek = endOfWeek.subtract(2, 'day')
  }
  const datesArray = []
  while (startOfWeek.isBefore(endOfWeek) || startOfWeek.isSame(endOfWeek, 'day')) {
    datesArray.push(dayjs(startOfWeek))
    startOfWeek = startOfWeek.add(1, 'day')
  }

  return datesArray
})

// This function is used to find the first suitable row for a record
// It takes the recordsInDay object, the start day index and the span of the record in days
// It returns the first suitable row for the entire span of the record
const findFirstSuitableRow = (recordsInDay: any, startDayIndex: number, spanDays: number) => {
  let row = 0
  while (true) {
    let isRowSuitable = true
    // Check if the row is suitable for the entire span
    for (let i = 0; i < spanDays; i++) {
      const dayIndex = startDayIndex + i
      if (!recordsInDay[dayIndex]) {
        recordsInDay[dayIndex] = {}
      }
      // If the row is occupied, the entire span is not suitable
      if (recordsInDay[dayIndex][row]) {
        isRowSuitable = false
        break
      }
    }
    // If the row is suitable, return it
    if (isRowSuitable) {
      return row
    }
    row++
  }
}

const isInRange = (date: dayjs.Dayjs) => {
  const rangeEndDate =
    maxVisibleDays.value === 5 ? dayjs(selectedDateRange.value.end).subtract(2, 'day') : dayjs(selectedDateRange.value.end)

  return (
    date && date.isBetween(dayjs(selectedDateRange.value.start).startOf('day'), dayjs(rangeEndDate).endOf('day'), 'day', '[]')
  )
}

const calendarData = computed(() => {
  if (!formattedData.value || !calendarRange.value) return []

  const recordsInDay = Array.from({ length: 7 }, () => ({})) as Record<number, Record<number, boolean>>
  const recordsInRange = [] as Row[]
  const perDayWidth = containerWidth.value / maxVisibleDays.value

  calendarRange.value.forEach(({ fk_from_col, fk_to_col }) => {
    if (!fk_from_col) return

    const processRecord = (record: Row) => {
      const id = record.rowMeta.id ?? generateRandomNumber()
      let startDate = dayjs(record.row[fk_from_col.title!])
      const ogStartDate = startDate.clone()
      const endDate = fk_to_col ? dayjs(record.row[fk_to_col.title!]) : startDate

      if (startDate.isBefore(selectedDateRange.value.start)) {
        startDate = dayjs(selectedDateRange.value.start)
      }

      const startDaysDiff = startDate.diff(selectedDateRange.value.start, 'day')
      const spanDays = fk_to_col
        ? Math.min(Math.max(endDate.diff(startDate, 'day') + 1, 1), maxVisibleDays.value - startDaysDiff)
        : 1

      const suitableRow = findFirstSuitableRow(recordsInDay, startDaysDiff, spanDays)

      for (let i = 0; i < spanDays; i++) {
        const dayIndex = startDaysDiff + i
        if (!recordsInDay[dayIndex]) recordsInDay[dayIndex] = {}
        recordsInDay[dayIndex][suitableRow] = true
      }

      const isStartInRange = isInRange(ogStartDate)
      const isEndInRange = isInRange(endDate)

      let position = 'none'
      if (isStartInRange && isEndInRange) position = 'rounded'
      else if (isStartInRange) position = 'leftRounded'
      else if (isEndInRange) position = 'rightRounded'

      recordsInRange.push({
        ...record,
        rowMeta: {
          ...record.rowMeta,
          range: { fk_from_col, fk_to_col },
          position,
          id,
          spanningDays: Math.abs(ogStartDate.diff(endDate, 'day')) - Math.abs(startDate.diff(endDate, 'day')),
          style: {
            width: `calc(max(${spanDays * perDayWidth + 0.5}px, ${perDayWidth + 0.5}px))`,
            left: `${startDaysDiff * perDayWidth - 1}px`,
            top: `${suitableRow * 28 + Math.max(suitableRow + 1, 1) * 8}px`,
          },
        },
      })
    }

    if (fk_to_col) {
      formattedData.value
        .filter((r) => {
          const startDate = dayjs(r.row[fk_from_col.title!])
          const endDate = dayjs(r.row[fk_to_col.title!])
          return (
            startDate.isValid() &&
            endDate.isValid() &&
            !endDate.isBefore(startDate) &&
            !endDate.isBefore(selectedDateRange.value.start, 'day')
          )
        })
        .forEach(processRecord)
    } else {
      formattedData.value.forEach(processRecord)
    }
  })

  return recordsInRange
})

const dragElement = ref<HTMLElement | null>(null)

const resizeInProgress = ref(false)

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const isDragging = ref(false)

const dragRecord = ref<Row>()

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>(null)

const hoverRecord = ref<string | null>()

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

// This function is used to calculate the new start and end date of a record when resizing
const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !resizeRecord.value) return

  const { width, left } = container.value.getBoundingClientRect()

  // Calculate the percentage of the width based on the mouse position
  const percentX = (event.clientX - left - window.scrollX) / width

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col
  if (!fromCol || !toCol) return

  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title!])
  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title!])

  const day = Math.floor(percentX * maxVisibleDays.value)

  let updateProperty: string[] = []
  let updateRecord: Row

  if (resizeDirection.value === 'right') {
    // Calculate the new end date based on the day index by adding the day index to the start date of the selected date range
    let newEndDate = dayjs(selectedDateRange.value.start).add(day, 'day')
    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we need to adjust the end date to the start date
    if (dayjs(newEndDate).isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone()
    }

    if (!newEndDate.isValid()) return

    updateRecord = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format(updateFormat.value),
      },
    }
  } else if (resizeDirection.value === 'left') {
    // Calculate the new start date based on the day index by adding the day index to the start date of the selected date range
    let newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we need to adjust the start date to the end date
    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone()
    }
    if (!newStartDate) return

    updateRecord = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format(updateFormat.value),
      },
    }
  }

  // Update the record in the store
  const newPk = extractPkFromRow(updateRecord.row, meta.value!.columns!)
  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)

    return pk === newPk ? updateRecord : r
  })
  useDebouncedRowUpdate(updateRecord, updateProperty, false)
}

const onResizeEnd = () => {
  resizeInProgress.value = false
  resizeDirection.value = null
  resizeRecord.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const dragOffset = ref<{
  x: number | null
  y: number | null
}>({ x: null, y: null })

// This method is used to calculate the new start and end date of a record when dragging and dropping
const calculateNewRow = (event: MouseEvent, updateSideBarData?: boolean) => {
  const { width, left } = container.value?.getBoundingClientRect()

  const relativeX = event.clientX - left

  /* if (dragOffset.value.x && dragRecord.value?.rowMeta.spanningDays === 1) {
    relativeX -= dragOffset.value.x
  } */

  const percentX = relativeX / width

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return { updatedProperty: [], newRow: null }

  // Calculate the day index based on the percentage of the width
  const day = Math.floor(
    percentX * maxVisibleDays.value - dragRecord.value.rowMeta.spanningDays - Math.max(0, Math.min(1, relativeX / width)),
  )

  // Calculate the new start date based on the day index by adding the day index to the start date of the selected date range
  const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
  if (!newStartDate) return { updatedProperty: [], newRow: null }

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format(updateFormat.value),
    },
  }

  const updateProperty = [fromCol.title!]

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? dayjs(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!] ? dayjs(dragRecord.value.row[toCol.title!]) : null

    // Calculate the new end date based on the day index by adding the day index to the start date of the selected date range
    // If the record has an end date, we need to calculate the new end date based on the difference between the start and end date
    // If the record doesn't have an end date, we need to calculate the new end date based on the start date
    // If the record has an end date and no start Date, we set the end date to the start date
    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format(updateFormat.value)
    updateProperty.push(toCol.title!)
  }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  if (updateSideBarData) {
    // If the record is being dragged from the sidebar, we need to remove the record from the sidebar data
    // and add the new record to the calendar data
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })
  } else {
    // If the record is being dragged within the calendar, we need to update the record in the calendar data
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk === newPk ? newRow : r
    })
  }

  return { updateProperty, newRow }
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !dragRecord.value) return
  event.preventDefault()

  calculateNewRow(event, false)
}

const stopDrag = (event: MouseEvent) => {
  event.preventDefault()
  clearTimeout(dragTimeout.value!)

  if (!isUIAllowed('dataEdit')) return
  if (!isDragging.value || !container.value || !dragRecord.value) return

  const { updateProperty, newRow } = calculateNewRow(event)

  if (!newRow) return

  // Open drop the record, we reset the opacity of the other records
  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value = null
  }

  dragRecord.value = undefined

  updateRowProperty(newRow, updateProperty, false)

  dragOffset.value = {
    x: null,
    y: null,
  }

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (resizeInProgress.value) return
  let target = event.target as HTMLElement

  isDragging.value = false

  dragOffset.value = {
    x: event.clientX - target.getBoundingClientRect().left,
    y: event.clientY - target.getBoundingClientRect().top,
  }

  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    const allRecords = document.querySelectorAll('.draggable-record')
    allRecords.forEach((el) => {
      if (!el.getAttribute('data-unique-id').includes(record.rowMeta.id!)) {
        el.style.opacity = '30%'
      }
    })

    isDragging.value = true
    dragElement.value = target
    dragRecord.value = record

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 200)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value!)

    dragOffset.value = {
      x: null,
      y: null,
    }

    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emits('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit')) return
  event.preventDefault()

  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
    }: {
      record: Row
    } = JSON.parse(data)

    dragRecord.value = record

    const { updateProperty, newRow } = calculateNewRow(event, true)

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)

    $e('c:calendar:day:drag-record')
  }
}

const selectDate = (day: dayjs.Dayjs) => {
  selectedDate.value = day
  dragRecord.value = undefined
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const addRecord = (date: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value) return
  const fromCol = calendarRange.value[0].fk_from_col
  if (!fromCol) return
  const newRecord = {
    row: {
      [fromCol.title!]: date.format(updateFormat.value),
    },
  }
  emits('newRecord', newRecord)
}
</script>

<template>
  <div class="flex relative flex-col prevent-select" data-testid="nc-calendar-week-view" @drop="dropEvent">
    <div class="flex h-6">
      <div
        v-for="(date, weekIndex) in weekDates"
        :key="weekIndex"
        :class="{
          'selected-date-header': dayjs(date).isSame(selectedDate, 'day'),
          'w-1/5': maxVisibleDays === 5,
          'w-1/7': maxVisibleDays === 7,
        }"
        class="cursor-pointer text-center text-[10px] font-semibold leading-4 flex items-center justify-center uppercase text-gray-500 w-full py-1 border-gray-200 border-l-gray-50 border-t-gray-50 last:border-r-0 border-1 bg-gray-50"
        @click="selectDate(date)"
        @dblclick="addRecord(date)"
      >
        {{ dayjs(date).format('DD ddd') }}
      </div>
    </div>
    <div ref="container" class="flex h-[calc(100vh-7.3rem)] w-full">
      <div
        v-for="(date, dateIndex) in weekDates"
        :key="dateIndex"
        :class="{
          'selected-date': dayjs(date).isSame(selectedDate, 'day'),
          '!bg-gray-50': date.get('day') === 0 || date.get('day') === 6,
          'w-1/5': maxVisibleDays === 5,
          'w-1/7': maxVisibleDays === 7,
        }"
        class="flex cursor-pointer flex-col border-r-1 min-h-[100vh] last:border-r-0 items-center"
        data-testid="nc-calendar-week-day"
        @click="selectDate(date)"
        @dblclick="addRecord(date)"
      ></div>
    </div>
    <div
      class="absolute nc-scrollbar-md overflow-y-auto z-2 mt-6 pointer-events-none inset-0"
      data-testid="nc-calendar-week-record-container"
    >
      <template v-for="(record, id) in calendarData" :key="id">
        <div
          v-if="record.rowMeta.style?.display !== 'none'"
          :data-testid="`nc-calendar-week-record-${record.row[displayField!.title!]}`"
          :data-unique-id="record.rowMeta.id"
          :style="{
            ...record.rowMeta.style,
            lineHeight: '18px',
          }"
          class="absolute group draggable-record pointer-events-auto nc-calendar-week-record-card"
          @mouseleave="hoverRecord = null"
          @mouseover="hoverRecord = record.rowMeta.id"
          @mousedown.stop="dragStart($event, record)"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :hover="hoverRecord === record.rowMeta.id"
              :dragging="record.rowMeta.id === dragRecord?.rowMeta?.id || record.rowMeta.id === resizeRecord?.rowMeta?.id"
              :position="record.rowMeta.position"
              :record="record"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              @dblclick.stop="emits('expandRecord', record)"
              @resize-start="onResizeStart"
            >
              <template v-for="(field, index) in fields" :key="index">
                <LazySmartsheetPlainCell
                  v-if="!isRowEmpty(record, field!)"
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="getFieldStyle(field).bold"
                  :column="field"
                  :italic="getFieldStyle(field).italic"
                  :underline="getFieldStyle(field).underline"
                />
              </template>
            </LazySmartsheetCalendarRecordCard>
          </LazySmartsheetRow>
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prevent-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.selected-date {
  @apply relative;
  &:after {
    @apply rounded-b-sm pointer-events-none absolute inset-0 w-full h-full;
    content: '';
    z-index: 1;
    box-shadow: 2px 0 0 #3366ff, -2px 0 0 #3366ff, 0 2px 0 #3366ff !important;
  }
  &:first-of-type::after {
    @apply left-0.5 w-[calc(100%_-_2px)];
  }
}

.selected-date-header {
  @apply relative;
  &:after {
    @apply rounded-t-sm pointer-events-none absolute inset-0 -left-0.25 w-[calc(100% + 2px)] h-full;
    content: '';
    z-index: 10;
    box-shadow: 2px 0 0 #3366ff, -2px 0 0 #3366ff, 0 -2px 0 #3366ff !important;
  }
  &:first-of-type::after {
    @apply left-0.25;
  }
}
</style>
