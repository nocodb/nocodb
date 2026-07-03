<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import {
  CALENDAR_CARD_MAX_FIELDS,
  CALENDAR_CARD_ROW_GAP,
  cardHeightForFieldCount,
  computeColumnPackedLayout,
} from '../calendarRecordCardHeight'
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
  isSyncedFromColumn,
  recordHeightMode,
  isDayAnchoredMode,
  dayAnchoredSpan,
} = useCalendarViewStoreOrThrow()

const { isSyncedTable } = useSmartsheetStoreOrThrow()

const maxVisibleDays = computed(() => {
  // Day-anchored modes ('3day', custom + day-unit) render exactly N day columns
  // (weekends always included). Week mode honours hide_weekend → 5 columns.
  if (isDayAnchoredMode.value) return dayAnchoredSpan.value
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

// True only when weekends are actually hidden (week mode + hide_weekend). A day-anchored
// 5-day custom window also yields maxVisibleDays === 5 but is NOT weekend-hidden, so the
// weekend-skip logic must guard on this, not on the column count.
const isWeekendHidden = computed(() => !isDayAnchoredMode.value && maxVisibleDays.value === 5)

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

// All non-empty visible fields for a record.
const nonEmptyCardFields = (record: Row) => (fields.value ?? []).filter((f) => f && !isRowEmpty(record, f))

// Fields actually rendered on the card. When there are more than the cap, the
// last line is reserved for a "+N more" hint, so we render one fewer field.
const cardFields = (record: Row) => {
  const all = nonEmptyCardFields(record)
  return all.length > CALENDAR_CARD_MAX_FIELDS ? all.slice(0, CALENDAR_CARD_MAX_FIELDS - 1) : all
}

// Count of non-empty fields not shown on the card (0 when everything fits).
const hiddenFieldCount = (record: Row) => {
  const total = nonEmptyCardFields(record).length
  return total > CALENDAR_CARD_MAX_FIELDS ? total - (CALENDAR_CARD_MAX_FIELDS - 1) : 0
}

// Lines the card renders: the shown fields plus the "+N more" line, if any.
const cardLineCount = (record: Row) => cardFields(record).length + (hiddenFieldCount(record) > 0 ? 1 : 0)

// Calculate the dates of the week
const weekDates = computed(() => {
  let startOfWeek = dayjs(selectedDateRange.value.start)
  let endOfWeek = dayjs(selectedDateRange.value.end)

  if (isWeekendHidden.value) {
    endOfWeek = endOfWeek.subtract(2, 'day')
  }
  const datesArray = []
  while (startOfWeek.isBefore(endOfWeek) || startOfWeek.isSame(endOfWeek, 'day')) {
    datesArray.push(dayjs(startOfWeek))
    startOfWeek = startOfWeek.add(1, 'day')
  }

  return datesArray
})

// --- Collapsed-weekend column model -----------------------------------------
// When collapse_weekend is on (week mode → 7 columns), Sat & Sun render in
// narrower columns. Record positioning is px-based, so expose per-column
// width/offset helpers; when not collapsed they return the uniform values, so
// show / hide are unchanged.
const WEEKEND_COLLAPSE_RATIO = 0.5

const isWeekendCollapsed = computed(() => !!viewMetaProperties.value?.collapse_weekend && maxVisibleDays.value === 7)

const columnWeights = computed<number[]>(() =>
  weekDates.value.map((d) => (isWeekendCollapsed.value && (d.day() === 0 || d.day() === 6) ? WEEKEND_COLLAPSE_RATIO : 1)),
)

const totalColumnWeight = computed(() => columnWeights.value.reduce((sum, w) => sum + w, 0))

const columnWidthPx = (index: number) => {
  if (!isWeekendCollapsed.value) return containerWidth.value / maxVisibleDays.value
  return (containerWidth.value * columnWeights.value[index]) / totalColumnWeight.value
}

const columnOffsetPx = (index: number) => {
  if (!isWeekendCollapsed.value) return index * (containerWidth.value / maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < index; i++) offset += columnWidthPx(i)
  return offset
}

const columnFromX = (x: number) => {
  if (!isWeekendCollapsed.value) return Math.floor((x / containerWidth.value) * maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < weekDates.value.length; i++) {
    offset += columnWidthPx(i)
    if (x < offset) return i
  }
  return weekDates.value.length - 1
}

// Flex column width (%) for the day headers and day columns.
const columnWidthPct = (index: number) => `${(columnWeights.value[index] / totalColumnWeight.value) * 100}%`

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
  const rangeEndDate = isWeekendHidden.value
    ? dayjs(selectedDateRange.value.end).subtract(2, 'day')
    : dayjs(selectedDateRange.value.end)

  return (
    date && date.isBetween(dayjs(selectedDateRange.value.start).startOf('day'), dayjs(rangeEndDate).endOf('day'), 'day', '[]')
  )
}

const calendarData = computed(() => {
  if (!formattedData.value || !calendarRange.value) return []

  const recordsInDay = Array.from({ length: maxVisibleDays.value }, () => ({})) as Record<number, Record<number, boolean>>
  const recordsInRange = [] as Row[]

  calendarRange.value.forEach(({ fk_from_col, fk_to_col }) => {
    if (!fk_from_col) return

    const processRecord = (record: Row) => {
      const id = record.rowMeta.id ?? generateRandomNumber()
      // Use whichever date is available; fall back to the other if one is missing
      let startDate = record.row[fk_from_col.title!]
        ? dayjs(record.row[fk_from_col.title!])
        : fk_to_col && record.row[fk_to_col.title!]
        ? dayjs(record.row[fk_to_col.title!])
        : dayjs(record.row[fk_from_col.title!])
      const ogStartDate = startDate.clone()
      const endDate = fk_to_col && record.row[fk_to_col.title!] ? dayjs(record.row[fk_to_col.title!]) : startDate

      // Single-date records with no end column cannot span; if the date sits outside
      // the visible week (e.g. backend over-fetched a boundary day), skip rather
      // than clamping it onto Monday with a cutoff indicator.
      if (!fk_to_col && !isInRange(ogStartDate)) {
        return
      }

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

      // Card height grows with the number of non-empty visible fields (capped),
      // so week-view cards can show several fields over multiple lines.
      const cardHeight = cardHeightForFieldCount(cardLineCount(record))

      recordsInRange.push({
        ...record,
        rowMeta: {
          ...record.rowMeta,
          range: { fk_from_col, fk_to_col },
          position,
          id,
          rowIndex: suitableRow,
          spanningDays: Math.abs(ogStartDate.diff(endDate, 'day')) - Math.abs(startDate.diff(endDate, 'day')),
          // Stashed for the post-pass that packs cards down each column.
          suitableRow,
          cardHeight,
          startCol: startDaysDiff,
          spanCols: spanDays,
          style: {
            width: `calc(max(${
              columnOffsetPx(startDaysDiff + spanDays - 1) +
              columnWidthPx(startDaysDiff + spanDays - 1) -
              columnOffsetPx(startDaysDiff) +
              0.5
            }px, ${columnWidthPx(startDaysDiff) + 0.5}px))`,
            // Snap the card's left to a whole pixel so the colored accent bar
            // lands at the same sub-pixel offset in every column (otherwise
            // columns on a .5px boundary, e.g. Sunday, render the thin bar
            // softened/narrower than the others).
            left: `${Math.round(columnOffsetPx(startDaysDiff)) - 1}px`,
          },
        },
      })
    }

    if (fk_to_col) {
      formattedData.value
        .filter((r) => {
          const startDate = r.row[fk_from_col.title!] ? dayjs(r.row[fk_from_col.title!]) : null
          const endDate = r.row[fk_to_col.title!] ? dayjs(r.row[fk_to_col.title!]) : null
          // If both dates missing, skip
          if (!startDate && !endDate) return false
          // If either date is missing, treat as single-day event
          if (!startDate || !endDate) return true
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

  // Each card keeps its own natural height and packs tightly down its column;
  // multi-day bars sit below whatever is already in the columns they span.
  const tops = computeColumnPackedLayout(
    recordsInRange.map((r) => ({
      startCol: r.rowMeta.startCol!,
      spanCols: r.rowMeta.spanCols!,
      rowIndex: r.rowMeta.suitableRow!,
      height: r.rowMeta.cardHeight!,
    })),
  )
  recordsInRange.forEach((r, i) => {
    if (!r.rowMeta.style) r.rowMeta.style = {}
    r.rowMeta.style.top = `${tops[i]}px`
    r.rowMeta.style.height = `${r.rowMeta.cardHeight}px`
  })

  return recordsInRange
})

// --- Compact / Expanded record height ---------------------------------------
// Compact (default): the grid is locked to the viewport height and records scroll
// inside the overlay. Expanded: the grid grows to fit the tallest day's stack so
// every record is visible and the page scrolls instead.
const isExpanded = computed(() => recordHeightMode.value === 'expanded')

// Height needed to show every card in the tallest column. Cards are variable-height and
// packed by computeColumnPackedLayout (their final `top` + `cardHeight` live on rowMeta),
// so the content bottom is the max of `top + cardHeight` across all records, plus a gap.
const contentHeight = computed(() => {
  let maxBottom = 0
  for (const record of calendarData.value) {
    const top = Number.parseFloat(record.rowMeta.style?.top as string) || 0
    const height = (record.rowMeta as { cardHeight?: number }).cardHeight ?? 0
    if (top + height > maxBottom) maxBottom = top + height
  }
  return maxBottom + CALENDAR_CARD_ROW_GAP
})

const gridStyle = computed(() => {
  if (!isExpanded.value) return undefined
  return { height: `max(calc(100vh - 7.3rem), ${contentHeight.value}px)` }
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

  const day = columnFromX(percentX * containerWidth.value)

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

  // Column under the cursor (clamped to the visible range), then shifted back by
  // the record's leading span so a multi-day record's start lands correctly.
  // Using the cursor's own column — rather than subtracting the whole-grid
  // fraction — keeps the last column reachable for any column count (3-day / week).
  const cursorDay = Math.max(0, Math.min(maxVisibleDays.value - 1, columnFromX(percentX * containerWidth.value)))
  const day = cursorDay - dragRecord.value.rowMeta.spanningDays

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

  // Drag-to-reschedule is gated to editable, non-synced ranges; click-to-expand
  // (onMouseUp below) must work regardless so synced records can be opened.
  const canDrag = isUIAllowed('dataEdit') && !isSyncedFromColumn.value && !record.rowMeta.range?.is_readonly

  if (canDrag) {
    dragTimeout.value = setTimeout(() => {
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
  }

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
    } = parseProp(data)

    // Not a valid record
    if (!record?.rowMeta) return

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
  // Records can't be added to synced (read-only) tables — return if synced.
  // (This guard was inverted; the sibling MonthView/DateTimeView use the same check.)
  if (!isUIAllowed('dataEdit') || !calendarRange.value || isSyncedTable.value) return
  const fromCol = calendarRange.value[0]?.fk_from_col
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
        }"
        :style="{ width: columnWidthPct(weekIndex) }"
        class="cursor-pointer text-center text-[10px] font-semibold leading-4 flex items-center justify-center uppercase text-nc-content-gray-muted py-1 border-nc-border-gray-medium border-l-nc-border-gray-extralight border-t-nc-border-gray-extralight last:border-r-0 border-b-1 border-r-1 bg-nc-bg-gray-extralight"
        @click="selectDate(date)"
        @dblclick="addRecord(date)"
      >
        {{ dayjs(date).format('DD ddd') }}
      </div>
    </div>
    <div
      ref="container"
      class="flex w-full"
      :class="isExpanded ? 'min-h-[calc(100vh-7.3rem)]' : 'h-[calc(100vh-7.3rem)]'"
      :style="gridStyle"
    >
      <div
        v-for="(date, dateIndex) in weekDates"
        :key="dateIndex"
        :class="[
          {
            'selected-date': dayjs(date).isSame(selectedDate, 'day'),
            '!bg-nc-bg-gray-extralight': date.get('day') === 0 || date.get('day') === 6,
          },
          isExpanded ? 'min-h-full' : 'min-h-[100vh]',
        ]"
        :style="{ width: columnWidthPct(dateIndex) }"
        class="flex cursor-pointer flex-col border-r-1 last:border-r-0 items-center"
        data-testid="nc-calendar-week-day"
        @click="selectDate(date)"
        @dblclick="addRecord(date)"
      ></div>
    </div>
    <div
      class="absolute z-2 mt-6 pointer-events-none inset-0"
      :class="isExpanded ? 'overflow-visible' : 'nc-scrollbar-md overflow-y-auto'"
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
              size="auto"
              multiline
              :has-hidden-fields="hiddenFieldCount(record) > 0"
              @dblclick.stop="emits('expandRecord', record)"
              @resize-start="onResizeStart"
            >
              <template v-for="(field, index) in cardFields(record)" :key="index">
                <LazySmartsheetPlainCell
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="getFieldStyle(field).bold"
                  :column="field"
                  :italic="getFieldStyle(field).italic"
                  :underline="getFieldStyle(field).underline"
                />
              </template>
              <div
                v-if="hiddenFieldCount(record) > 0"
                class="nc-calendar-card-more truncate leading-5 text-bodySm text-nc-content-gray-muted"
              >
                {{ $t('msg.chat.showMore', { count: hiddenFieldCount(record) }) }}
              </div>
              <template #tooltip>
                <SmartsheetRecordFieldsTooltip :record="record" :fields="fields" />
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
  @apply relative !bg-nc-bg-brand;
  &:first-of-type::after {
    @apply left-0.5 w-[calc(100%_-_2px)];
  }
}

.selected-date-header {
  @apply relative;
  &:first-of-type::after {
    @apply left-0.25;
  }
}
</style>
