<script setup lang="ts">
import dayjs from 'dayjs'
import type { Row } from '#imports'

const props = defineProps<{
  records: Row[]
}>()

const emit = defineEmits(['expandRecord', 'newRecord'])

const container = ref<null | HTMLElement>(null)

const { width: containerWidth } = useElementSize(container)

const meta = inject(MetaInj, ref())

const { isUIAllowed } = useRoles()

const records = toRef(props, 'records')

const fields = inject(FieldsInj, ref())

const { fields: _fields } = useViewColumnsOrThrow()

const fieldStyles = computed(() => {
  return (_fields.value ?? []).reduce((acc, field) => {
    acc[field.fk_column_id!] = {
      bold: !!field.bold,
      italic: !!field.italic,
      underline: !!field.underline,
    }
    return acc
  }, {} as Record<string, { bold?: boolean; italic?: boolean; underline?: boolean }>)
})

const {
  selectedDate,
  formattedData,
  formattedSideBarData,
  calendarRange,
  updateRowProperty,
  selectedDateRange,
  viewMetaProperties,
  displayField,
  activeCalendarView,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const maxVisibleDays = computed(() => {
  return activeCalendarView.value === 'week' ? (viewMetaProperties.value?.hide_weekend ? 5 : 7) : 1
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

const viewStartDate = computed(() => {
  if (activeCalendarView.value === 'week') {
    return selectedDateRange.value.start
  } else {
    return selectedDate.value
  }
})

const isInRange = (date: dayjs.Dayjs) => {
  if (activeCalendarView.value === 'day') {
    return date.isSame(selectedDate.value, 'day')
  } else {
    const rangeEndDate =
      maxVisibleDays.value === 5 ? dayjs(selectedDateRange.value.end).subtract(2, 'day') : dayjs(selectedDateRange.value.end)

    return (
      date && date.isBetween(dayjs(selectedDateRange.value.start).startOf('day'), dayjs(rangeEndDate).endOf('day'), 'day', '[]')
    )
  }
}

const calendarData = computed(() => {
  if (!records.value?.length || !calendarRange.value) return []

  const recordsInDay = Array.from({ length: 7 }, () => ({})) as Record<number, Record<number, boolean>>

  const perDayWidth = containerWidth.value / maxVisibleDays.value

  const recordsInRange = [] as Row[]
  calendarRange.value.forEach(({ fk_from_col, fk_to_col }) => {
    if (!fk_from_col || !fk_to_col) return
    for (const record of records.value) {
      const id = record.rowMeta.id ?? generateRandomNumber()

      const startDate = dayjs(record.row[fk_from_col.title!])
      const endDate = dayjs(record.row[fk_to_col.title!])

      const startDayIndex = Math.max(startDate.diff(viewStartDate.value, 'day'), 0)
      const endDayIndex = Math.min(endDate.diff(viewStartDate.value, 'day'), maxVisibleDays.value - 1)

      const spanDays = endDayIndex - startDayIndex + 1

      const row = findFirstSuitableRow(recordsInDay, startDayIndex, spanDays)

      for (let i = 0; i < spanDays; i++) {
        const dayIndex = startDayIndex + i
        recordsInDay[dayIndex][row] = true
      }

      const isStartInRange = isInRange(startDate)
      const isEndInRange = isInRange(endDate)

      let position = 'none'
      if (isStartInRange && isEndInRange) position = 'rounded'
      else if (isStartInRange) position = 'leftRounded'
      else if (isEndInRange) position = 'rightRounded'

      const style: Partial<CSSStyleDeclaration> = {
        top: `${row * 28 + row * 8 + 8}px`,
        left: `${startDayIndex * perDayWidth}px`,
        width: `${spanDays * perDayWidth}px`,
      }

      recordsInRange.push({
        ...record,
        rowMeta: {
          ...record.rowMeta,
          style,
          position,
          range: { fk_from_col, fk_to_col },
          id,
        },
      })
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

const isExpanded = ref(false)

// This method is used to calculate the new start and end date of a record when dragging and dropping
const calculateNewRow = (event: MouseEvent, updateSideBarData?: boolean) => {
  if (!container.value || !dragRecord.value) return { updatedProperty: [], newRow: null }
  const { width, left } = container.value.getBoundingClientRect()

  // Calculate the percentage of the width based on the mouse position
  // This is used to calculate the day index

  const relativeX = event.clientX - left

  // TODO: @DarkPhoenix2704 handle offset
  // if (dragOffset.value.x) {
  //  relativeX -= dragOffset.value.x
  // }

  const percentX = Math.max(0, Math.min(1, relativeX / width))

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return { updatedProperty: [], newRow: null }

  // Calculate the day index based on the percentage of the width
  // The day index is a number between 0 and 6
  const day = Math.floor(percentX * maxVisibleDays.value)

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
    let newStartDate = ogStartDate.clone()

    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we need to adjust the end date to the start date
    if (dayjs(newEndDate).isSameOrBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone().add(1, 'hour')
      newStartDate = ogStartDate.clone().subtract(1, 'hour')
      updateProperty.push(fromCol.title!)
    }

    if (!newEndDate.isValid()) return

    updateRecord = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format(updateFormat.value),
        [fromCol.title!]: newStartDate.format(updateFormat.value),
      },
    }
  } else if (resizeDirection.value === 'left') {
    // Calculate the new start date based on the day index by adding the day index to the start date of the selected date range
    let newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day')
    let newEndDate = ogEndDate.clone()
    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we need to adjust the start date to the end date
    if (dayjs(newStartDate).isSameOrAfter(ogEndDate)) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone()
      newEndDate = dayjs(newStartDate).clone().add(1, 'hour')
      updateProperty.push(toCol.title!)
    }
    if (!newStartDate) return

    updateRecord = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format(updateFormat.value),
        [toCol.title!]: dayjs(newEndDate).format(updateFormat.value),
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

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!container.value || !dragRecord.value) return
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

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (resizeInProgress.value) return
  let target = event.target as HTMLElement

  if (activeCalendarView.value === 'day') {
    emit('expandRecord', record)
    return
  }

  isDragging.value = false

  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    // TODO: Implement dragOffset @DarkPhoenix2704
    /*    dragOffset.value = {
      x: event.clientX - target.getBoundingClientRect().left,
      y: event.clientY - target.getBoundingClientRect().top,
    } */

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
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emit('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const isSpanningRecordExpanded = () => isExpanded.value

defineExpose({
  isSpanningRecordExpanded,
})
</script>

<template>
  <div style="z-index: 100" class="sticky flex top-0 bg-white border-b-1 border-gray-200 shadow-sm prevent-select">
    <div
      :style="{
        maxWidth: `${activeCalendarView === 'week' ? '64px' : '66px'}`,
        minWidth: `${activeCalendarView === 'week' ? '64px' : '66px'}`,
      }"
      :class="{
        'p-2': activeCalendarView === 'day',
        'py-2 pr-1': activeCalendarView === 'week',
      }"
      class="text-xs top-0 text-right z-50 !sticky h-full left-0 text-[#6A7184]"
    >
      All day

      <NcButton size="xsmall" class="mt-2" type="text" @click="isExpanded = !isExpanded">
        <GeneralIcon v-if="!isExpanded" class="w-4 h-4 text-gray-800" icon="maximize" />
        <GeneralIcon v-else-if="isExpanded" class="w-4 h-4 text-gray-800" icon="minimize" />
      </NcButton>
    </div>
    <div
      ref="container"
      :style="{
        width: `calc(100% - ${activeCalendarView === 'week' ? '64' : '66'}px)`,
      }"
      :class="{
        'border-gray-100': activeCalendarView === 'day',
        'border-gray-200': activeCalendarView === 'week',
        'min-h-32 max-h-32 ': isExpanded,
        'h-20': !isExpanded,
      }"
      class="relative border-l-1 transition-all overflow-y-scroll z-30"
    >
      <div class="pointer-events-none h-full inset-y-0 relative">
        <div
          v-if="maxVisibleDays === 7"
          class="absolute !right-0 h-full bg-gray-100 inset-y-0"
          :style="{
            width: `${(containerWidth / 7) * 2}px`,
          }"
        ></div>
        <template v-for="(record, id) in calendarData" :key="id">
          <div
            v-if="record.rowMeta.style?.display !== 'none'"
            :data-testid="`nc-calendar-week-record-${record.row[displayField!.title!]}`"
            :data-unique-id="record.rowMeta.id"
            :style="{
              ...record.rowMeta.style,
            }"
            class="absolute group draggable-record pointer-events-auto nc-calendar-week-record-card"
            @mouseleave="hoverRecord = null"
            @mouseover="hoverRecord = record.rowMeta.id"
            @mousedown.stop="dragStart($event, record)"
          >
            <LazySmartsheetRow :row="record">
              <LazySmartsheetCalendarRecordCard
                :hover="hoverRecord === record.rowMeta.id"
                :dragging="resizeRecord?.rowMeta.id === record.rowMeta.id || dragRecord?.rowMeta.id === record.rowMeta.id"
                :position="record.rowMeta.position"
                :record="record"
                :resize="activeCalendarView === 'week'"
                @dblclick.stop="emit('expandRecord', record)"
                @resize-start="onResizeStart"
              >
                <template v-for="(field, index) in fields" :key="index">
                  <LazySmartsheetPlainCell
                    v-if="!isRowEmpty(record, field!)"
                    v-model="record.row[field!.title!]"
                    class="text-xs"
                    :column="field"
                    :bold="!!fieldStyles[field.id]?.bold"
                    :italic="!!fieldStyles[field.id]?.italic"
                    :underline="!!fieldStyles[field.id]?.underline"
                  />
                </template>
              </LazySmartsheetCalendarRecordCard>
            </LazySmartsheetRow>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.prevent-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}
</style>
