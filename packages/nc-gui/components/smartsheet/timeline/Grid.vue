<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  records: RowType[]
  visibleDates: dayjs.Dayjs[]
  timelineRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>
  zoomLevel: 'day' | 'week' | 'month'
  hideHeader?: boolean
}>()

const emit = defineEmits<{
  (event: 'expandRecord', row: RowType): void
  (event: 'newRecord', startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): void
  (event: 'navigateTo', date: dayjs.Dayjs): void
}>()

const { t } = useI18n()

const meta = inject(MetaInj, ref())

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const {
  updateRowProperty,
  updateFormat,
  formattedData: storeFormattedData,
} = useTimelineViewStoreOrThrow()

// Visible fields from the Fields menu (injected by parent Smartsheet/shared-view)
const fields = inject(FieldsInj, ref())

// View column configs (for bold/italic/underline styles)
const { fields: viewFields } = useViewColumnsOrThrow()

// Build a lookup: columnId → { bold, italic, underline }
const fieldStyles = computed(() => {
  return (viewFields.value ?? []).reduce(
    (acc, field) => {
      acc[field.fk_column_id!] = {
        bold: !!field.bold,
        italic: !!field.italic,
        underline: !!field.underline,
      }
      return acc
    },
    {} as Record<string, { bold?: boolean; italic?: boolean; underline?: boolean }>,
  )
})

// Extract row color styles (from Colour toolbar config)
const getRowColorStyle = (record: RowType) => {
  return extractRowBackgroundColorStyle(record)
}

// #18: Reactive today — re-evaluates on visibility change so it stays current past midnight
const today = ref(dayjs())

const refreshToday = () => {
  const now = dayjs()
  if (!now.isSame(today.value, 'day')) {
    today.value = now
  }
}

// Re-check when the tab becomes visible again
const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    refreshToday()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 32

// Measure the grid container to compute dynamic column widths
const gridContainerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(gridContainerRef)

// #4: Column width — for month view, always fit all days in the container;
// for day/week views, enforce a minimum so columns aren't excessively wide
const MIN_COL_WIDTH_DAY_WEEK = 48
const colWidth = computed(() => {
  if (!containerWidth.value || !props.visibleDates.length) return 120
  const naturalWidth = containerWidth.value / props.visibleDates.length
  // Month view: always fit all days without horizontal scroll
  if (props.zoomLevel === 'month') return naturalWidth
  return Math.max(naturalWidth, MIN_COL_WIDTH_DAY_WEEK)
})

// Total grid width — may exceed container for horizontal scroll
const totalGridWidth = computed(() => {
  return props.visibleDates.length * colWidth.value
})

// Whether horizontal scrolling is needed
const needsHorizontalScroll = computed(() => {
  return totalGridWidth.value > containerWidth.value
})

// --- Resize state ---
const resizeInProgress = ref(false)
const resizeDirection = ref<'left' | 'right'>()
const resizeRecord = ref<RowType | null>(null)
const gridBodyRef = ref<HTMLElement | null>(null)

// Flag to suppress the click that fires right after mouseup ends a resize/drag
const justFinishedResize = ref(false)
let resizeCooldownTimer: ReturnType<typeof setTimeout> | null = null

// --- Drag-to-move state (#1) ---
const dragInProgress = ref(false)
const dragRecord = ref<RowType | null>(null)
const dragStartDayIndex = ref<number>(0)
let dragTimeout: ReturnType<typeof setTimeout> | null = null
const isDragReady = ref(false) // becomes true after 200ms hold

// Debounced row update (500ms, matching calendar)
const useDebouncedRowUpdate = useDebounceFn((row: RowType, updateProperty: string[], undo: boolean) => {
  updateRowProperty(row, updateProperty, undo)
}, 500)

// --- Resize event handlers ---

const onResizeStart = (direction: 'left' | 'right', event: MouseEvent, record: RowType) => {
  if (!isUIAllowed('dataEdit')) return
  if (record.rowMeta?.range?.is_readonly) return

  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  hoverColIndex.value = null

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResize = (event: MouseEvent) => {
  if (!resizeRecord.value || !gridBodyRef.value) return

  const range = props.timelineRange[0]
  if (!range) return

  const fromCol = range.fk_from_col
  const toCol = range.fk_to_col

  // Calculate which day the mouse is over
  const { left } = gridBodyRef.value.getBoundingClientRect()
  const scrollLeft = gridBodyRef.value.parentElement?.scrollLeft ?? 0
  const relativeX = event.clientX - left + scrollLeft
  const dayIndex = Math.floor(relativeX / colWidth.value)
  const clampedDayIndex = Math.max(0, Math.min(dayIndex, props.visibleDates.length - 1))
  const newDate = props.visibleDates[clampedDayIndex]

  if (!newDate) return

  // Get current dates from the record
  const ogStartDate = parseDate(resizeRecord.value, fromCol)
  const ogEndDate = toCol ? parseDate(resizeRecord.value, toCol) : ogStartDate

  if (!ogStartDate) return

  // Determine date format based on column type
  const isDateOnly = fromCol.uidt === UITypes.Date
  const dateFormat = isDateOnly ? 'YYYY-MM-DD' : updateFormat.value

  // Mutate the record's row data in-place so the change propagates
  // to both flat (storeFormattedData) and grouped (grp.rows) views,
  // since they share the same object reference.
  let updateProperty: string[] = []

  if (resizeDirection.value === 'right' && toCol?.title) {
    // Resizing end date
    let newEndDate = newDate.endOf('day')
    // Clamp: end date must not be before start date
    if (newEndDate.isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone().endOf('day')
    }
    resizeRecord.value.row[toCol.title] = isDateOnly
      ? newEndDate.format('YYYY-MM-DD')
      : newEndDate.format(dateFormat)
    updateProperty = [toCol.title]
  } else if (resizeDirection.value === 'left' && fromCol?.title) {
    // Resizing start date
    let newStartDate = newDate
    const effectiveEnd = ogEndDate || ogStartDate
    // Clamp: start date must not be after end date
    if (newStartDate.isAfter(effectiveEnd, 'day')) {
      newStartDate = effectiveEnd.clone()
    }
    resizeRecord.value.row[fromCol.title] = isDateOnly
      ? newStartDate.format('YYYY-MM-DD')
      : newStartDate.format(dateFormat)
    updateProperty = [fromCol.title]
  } else {
    return
  }

  // Debounced API update
  useDebouncedRowUpdate(resizeRecord.value, updateProperty, false)
}

const onResizeEnd = () => {
  $e('c:timeline:resize-record')
  resizeInProgress.value = false
  resizeDirection.value = undefined
  resizeRecord.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)

  // Suppress the click event that follows mouseup on the same element.
  // mouseup → click fires synchronously in the same frame, so we set a
  // short cooldown that outlasts the click dispatch.
  justFinishedResize.value = true
  if (resizeCooldownTimer) clearTimeout(resizeCooldownTimer)
  resizeCooldownTimer = setTimeout(() => {
    justFinishedResize.value = false
  }, 50)
}

// --- Drag-to-move event handlers (#1) ---

const getDayIndexFromEvent = (event: MouseEvent): number => {
  if (!gridBodyRef.value) return 0
  const { left } = gridBodyRef.value.getBoundingClientRect()
  const scrollLeft = gridBodyRef.value.parentElement?.scrollLeft ?? 0
  const relativeX = event.clientX - left + scrollLeft
  const dayIndex = Math.floor(relativeX / colWidth.value)
  return Math.max(0, Math.min(dayIndex, props.visibleDates.length - 1))
}

const onDragStart = (event: MouseEvent, record: RowType) => {
  if (!isUIAllowed('dataEdit')) return
  if (record.rowMeta?.range?.is_readonly) return

  // Use a short hold delay (200ms) to distinguish drag from click
  const startDayIdx = getDayIndexFromEvent(event)
  isDragReady.value = false

  dragTimeout = setTimeout(() => {
    isDragReady.value = true
    dragInProgress.value = true
    dragRecord.value = record
    hoverColIndex.value = null
    dragStartDayIndex.value = startDayIdx

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', onDragEnd)
  }, 200)

  // Listen for mouseup to cancel if released before hold threshold
  const earlyRelease = () => {
    if (dragTimeout) {
      clearTimeout(dragTimeout)
      dragTimeout = null
    }
    document.removeEventListener('mouseup', earlyRelease)
  }
  document.addEventListener('mouseup', earlyRelease)
}

const onDrag = (event: MouseEvent) => {
  if (!dragRecord.value || !gridBodyRef.value) return

  const range = props.timelineRange[0]
  if (!range) return

  const fromCol = range.fk_from_col
  const toCol = range.fk_to_col

  const currentDayIdx = getDayIndexFromEvent(event)
  const dayDelta = currentDayIdx - dragStartDayIndex.value

  if (dayDelta === 0) return

  const ogStartDate = parseDate(dragRecord.value, fromCol)
  const ogEndDate = toCol ? parseDate(dragRecord.value, toCol) : null

  if (!ogStartDate) return

  const isDateOnly = fromCol.uidt === UITypes.Date
  const dateFormat = isDateOnly ? 'YYYY-MM-DD' : updateFormat.value

  // Shift both start and end by the delta
  const newStart = ogStartDate.add(dayDelta, 'day')
  dragRecord.value.row[fromCol.title!] = isDateOnly
    ? newStart.format('YYYY-MM-DD')
    : newStart.format(dateFormat)

  const updateProperty = [fromCol.title!]

  if (toCol?.title && ogEndDate) {
    const newEnd = ogEndDate.add(dayDelta, 'day')
    dragRecord.value.row[toCol.title] = isDateOnly
      ? newEnd.format('YYYY-MM-DD')
      : newEnd.format(dateFormat)
    updateProperty.push(toCol.title)
  }

  // Update the reference day index so delta is always relative
  dragStartDayIndex.value = currentDayIdx

  useDebouncedRowUpdate(dragRecord.value, updateProperty, false)
}

const onDragEnd = () => {
  $e('c:timeline:drag-record')
  dragInProgress.value = false
  dragRecord.value = null
  isDragReady.value = false
  if (dragTimeout) {
    clearTimeout(dragTimeout)
    dragTimeout = null
  }
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', onDragEnd)

  // Suppress click after drag
  justFinishedResize.value = true
  if (resizeCooldownTimer) clearTimeout(resizeCooldownTimer)
  resizeCooldownTimer = setTimeout(() => {
    justFinishedResize.value = false
  }, 50)
}

// Whether any interaction (resize or drag) is happening
const isInteracting = computed(() => resizeInProgress.value || dragInProgress.value || dragCreateActive.value)
const interactionRecord = computed(() => resizeRecord.value || dragRecord.value)

// Clean up listeners and timers on unmount
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('mousemove', onDragCreateMove)
  document.removeEventListener('mouseup', onDragCreateEnd)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  if (resizeCooldownTimer) clearTimeout(resizeCooldownTimer)
  if (dragTimeout) clearTimeout(dragTimeout)
  if (typeof useDebouncedRowUpdate.cancel === 'function') useDebouncedRowUpdate.cancel()
})

// --- Helpers ---

// Check if a record has a visible bar within the current date range
const isRecordVisible = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return false

  const startDate = parseDate(row, range.fk_from_col)
  const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate

  if (!startDate) return false

  const effectiveEnd = endDate || startDate
  const firstVisibleDate = props.visibleDates[0]
  const lastVisibleDate = props.visibleDates[props.visibleDates.length - 1]

  if (!firstVisibleDate || !lastVisibleDate) return false

  return !effectiveEnd.isBefore(firstVisibleDate, 'day') && !startDate.isAfter(lastVisibleDate, 'day')
}

// Filtered + sorted records: only visible bars, ordered by start date
const visibleRecords = computed(() => {
  const range = props.timelineRange[0]
  if (!range) return []

  return props.records
    .filter((record) => isRecordVisible(record))
    .sort((a, b) => {
      const aStart = parseDate(a, range.fk_from_col)
      const bStart = parseDate(b, range.fk_from_col)
      if (!aStart && !bStart) return 0
      if (!aStart) return 1
      if (!bStart) return -1
      return aStart.valueOf() - bStart.valueOf()
    })
})

// Swimlane packing: group non-overlapping records into lanes so bars sit side by side
// Each lane is an array of { record, colorIndex } where colorIndex is the record's
// position in the global visibleRecords list (for stable coloring).
const swimlanes = computed<Array<Array<{ record: RowType; colorIndex: number }>>>(() => {
  const range = props.timelineRange[0]
  if (!range) return []

  const lanes: Array<{ records: Array<{ record: RowType; colorIndex: number }>; lastEnd: dayjs.Dayjs }> = []

  visibleRecords.value.forEach((record, idx) => {
    const startDate = parseDate(record, range.fk_from_col)
    const endDate = range.fk_to_col ? parseDate(record, range.fk_to_col) : startDate
    if (!startDate) return

    const effectiveEnd = endDate || startDate

    // Find the first lane where this record fits (no overlap)
    let placed = false
    for (const lane of lanes) {
      if (startDate.isAfter(lane.lastEnd, 'day')) {
        lane.records.push({ record, colorIndex: idx })
        lane.lastEnd = effectiveEnd
        placed = true
        break
      }
    }

    // No existing lane fits — create a new one
    if (!placed) {
      lanes.push({
        records: [{ record, colorIndex: idx }],
        lastEnd: effectiveEnd,
      })
    }
  })

  return lanes.map((lane) => lane.records)
})

// Parse date from row for a given column
const parseDate = (row: RowType, col: ColumnType | undefined | null) => {
  if (!col?.title) return null
  const val = row.row?.[col.title]
  if (!val) return null
  const d = dayjs(val)
  return d.isValid() ? d : null
}

// Get bar position and width for a record
const getBarStyle = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return null

  const startDate = parseDate(row, range.fk_from_col)
  const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate

  if (!startDate) return null

  const effectiveEnd = endDate || startDate

  // Skip records where end date is before start date
  if (endDate && effectiveEnd.isBefore(startDate, 'day')) {
    return null
  }

  const firstVisibleDate = props.visibleDates[0]
  const lastVisibleDate = props.visibleDates[props.visibleDates.length - 1]

  if (!firstVisibleDate || !lastVisibleDate) return null

  // Check if bar is within visible range at all
  if (effectiveEnd.isBefore(firstVisibleDate, 'day') || startDate.isAfter(lastVisibleDate, 'day')) {
    return null
  }

  // Calculate start position
  const clampedStart = startDate.isBefore(firstVisibleDate, 'day') ? firstVisibleDate : startDate
  const clampedEnd = effectiveEnd.isAfter(lastVisibleDate, 'day') ? lastVisibleDate : effectiveEnd

  const startOffset = clampedStart.diff(firstVisibleDate, 'day')
  const duration = clampedEnd.diff(clampedStart, 'day') + 1

  return {
    left: `${startOffset * colWidth.value}px`,
    width: `${Math.max(duration * colWidth.value - 4, 20)}px`,
  }
}

// Check if editing is allowed and range is not readonly
const canResize = computed(() => {
  return isUIAllowed('dataEdit') && !props.timelineRange[0]?.is_readonly
})

// #11: Build tooltip text for a record bar — improved format with em-dash and year
const getBarTooltip = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return ''

  const startDate = parseDate(row, range.fk_from_col)
  const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate

  if (!startDate) return ''

  const effectiveEnd = endDate || startDate
  const days = effectiveEnd.diff(startDate, 'day') + 1

  if (days <= 1) {
    return startDate.format('MMM D, YYYY')
  }

  // Show year on both sides if they differ, otherwise only on end
  const sameYear = startDate.year() === effectiveEnd.year()
  const startFmt = sameYear ? 'MMM D' : 'MMM D, YYYY'
  return `${startDate.format(startFmt)} — ${effectiveEnd.format('MMM D, YYYY')}  ·  ${days} days`
}

// Determine if a date is today
const isToday = (date: dayjs.Dayjs) => {
  return date.isSame(today.value, 'day')
}

// Determine if a date is a weekend
const isWeekend = (date: dayjs.Dayjs) => {
  return date.day() === 0 || date.day() === 6
}

// Check if record's start date is visible (not clamped to before the viewport)
const isStartVisible = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return false
  const startDate = parseDate(row, range.fk_from_col)
  if (!startDate) return false
  const firstVisibleDate = props.visibleDates[0]
  if (!firstVisibleDate) return false
  return !startDate.isBefore(firstVisibleDate, 'day')
}

// Check if record's end date is visible (not clamped to after the viewport)
const isEndVisible = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return false
  const startDate = parseDate(row, range.fk_from_col)
  const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate
  const effectiveEnd = endDate || startDate
  if (!effectiveEnd) return false
  const lastVisibleDate = props.visibleDates[props.visibleDates.length - 1]
  if (!lastVisibleDate) return false
  return !effectiveEnd.isAfter(lastVisibleDate, 'day')
}

// Today indicator position
const todayPosition = computed(() => {
  const firstDate = props.visibleDates[0]
  if (!firstDate) return null
  const offset = today.value.diff(firstDate, 'day')
  if (offset < 0 || offset >= props.visibleDates.length) return null
  return offset * colWidth.value + colWidth.value / 2
})

// Per-bar navigation: get the start/end date for a clipped record
const getRecordStartDate = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return null
  return parseDate(row, range.fk_from_col)
}

const getRecordEndDate = (row: RowType) => {
  const range = props.timelineRange[0]
  if (!range) return null
  const startDate = parseDate(row, range.fk_from_col)
  const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate
  return endDate || startDate
}

const navigateToRecordStart = (row: RowType) => {
  const startDate = getRecordStartDate(row)
  if (startDate) emit('navigateTo', startDate)
}

const navigateToRecordEnd = (row: RowType) => {
  const endDate = getRecordEndDate(row)
  if (endDate) emit('navigateTo', endDate)
}

// Grid-level navigation: for fully off-screen records (no bars visible at all)
const hasFullyOffScreenBefore = computed(() => {
  const firstVisibleDate = props.visibleDates[0]
  if (!firstVisibleDate) return false
  const range = props.timelineRange[0]
  if (!range) return false

  return props.records.some((row) => {
    const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : parseDate(row, range.fk_from_col)
    const effectiveEnd = endDate || parseDate(row, range.fk_from_col)
    return effectiveEnd && effectiveEnd.isBefore(firstVisibleDate, 'day')
  })
})

const hasFullyOffScreenAfter = computed(() => {
  const lastVisibleDate = props.visibleDates[props.visibleDates.length - 1]
  if (!lastVisibleDate) return false
  const range = props.timelineRange[0]
  if (!range) return false

  return props.records.some((row) => {
    const startDate = parseDate(row, range.fk_from_col)
    return startDate && startDate.isAfter(lastVisibleDate, 'day')
  })
})

// Only show Grid-level arrows when there are fully off-screen records AND no visible swimlanes
// (when bars are visible, per-bar arrows handle navigation instead)
const hasRecordsBefore = computed(() => hasFullyOffScreenBefore.value && !swimlanes.value.length)
const hasRecordsAfter = computed(() => hasFullyOffScreenAfter.value && !swimlanes.value.length)

const navigateToPrev = () => {
  const firstVisibleDate = props.visibleDates[0]
  if (!firstVisibleDate) return
  const range = props.timelineRange[0]
  if (!range) return

  let closestDate: dayjs.Dayjs | null = null
  for (const row of props.records) {
    const startDate = parseDate(row, range.fk_from_col)
    if (!startDate) continue
    const endDate = range.fk_to_col ? parseDate(row, range.fk_to_col) : startDate
    const effectiveEnd = endDate || startDate
    if (effectiveEnd.isBefore(firstVisibleDate, 'day')) {
      if (!closestDate || startDate.isAfter(closestDate, 'day')) {
        closestDate = startDate
      }
    }
  }
  if (closestDate) emit('navigateTo', closestDate)
}

const navigateToNext = () => {
  const lastVisibleDate = props.visibleDates[props.visibleDates.length - 1]
  if (!lastVisibleDate) return
  const range = props.timelineRange[0]
  if (!range) return

  let closestDate: dayjs.Dayjs | null = null
  for (const row of props.records) {
    const startDate = parseDate(row, range.fk_from_col)
    if (!startDate) continue
    if (startDate.isAfter(lastVisibleDate, 'day')) {
      if (!closestDate || startDate.isBefore(closestDate, 'day')) {
        closestDate = startDate
      }
    }
  }
  if (closestDate) emit('navigateTo', closestDate)
}

// --- Drag-to-create: click and drag on empty grid to create a record with date range ---
const dragCreateActive = ref(false)
const dragCreateStartIdx = ref<number | null>(null)
const dragCreateEndIdx = ref<number | null>(null)
const dragCreateLaneIdx = ref<number | null>(null)

const dragCreateRange = computed(() => {
  if (dragCreateStartIdx.value === null || dragCreateEndIdx.value === null) return null
  const minIdx = Math.min(dragCreateStartIdx.value, dragCreateEndIdx.value)
  const maxIdx = Math.max(dragCreateStartIdx.value, dragCreateEndIdx.value)
  return { minIdx, maxIdx }
})

// Compute the pixel-based style for the dotted rectangle overlay
const dragCreateStyle = computed(() => {
  const range = dragCreateRange.value
  if (!range || dragCreateLaneIdx.value === null) return null
  const left = range.minIdx * colWidth.value
  const width = (range.maxIdx - range.minIdx + 1) * colWidth.value
  const top = dragCreateLaneIdx.value * ROW_HEIGHT + 4 // 4px top inset (matches bar top-1 = 4px)
  const height = ROW_HEIGHT - 8 // matches bar height
  return { left: `${left}px`, width: `${width}px`, top: `${top}px`, height: `${height}px` }
})

const getLaneIndexFromEvent = (event: MouseEvent): number => {
  if (!gridBodyRef.value) return 0
  const { top } = gridBodyRef.value.getBoundingClientRect()
  const relativeY = event.clientY - top
  const laneIdx = Math.floor(relativeY / ROW_HEIGHT)
  return Math.max(0, laneIdx)
}

const onGridBodyMouseDown = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  if (!gridBodyRef.value) return
  // Only left mouse button
  if (event.button !== 0) return
  // Don't start drag-to-create if clicking on a bar
  const target = event.target as HTMLElement
  if (target.closest('.nc-timeline-bar') || target.closest('.nc-timeline-resize-handle') || target.closest('.nc-timeline-nav-arrow') || target.closest('.nc-timeline-nav-btn')) return

  const dayIdx = getDayIndexFromEvent(event)
  const laneIdx = getLaneIndexFromEvent(event)
  dragCreateActive.value = true
  dragCreateStartIdx.value = dayIdx
  dragCreateEndIdx.value = dayIdx
  dragCreateLaneIdx.value = laneIdx

  document.addEventListener('mousemove', onDragCreateMove)
  document.addEventListener('mouseup', onDragCreateEnd)
}

const onDragCreateMove = (event: MouseEvent) => {
  if (!dragCreateActive.value || !gridBodyRef.value) return
  const dayIdx = getDayIndexFromEvent(event)
  dragCreateEndIdx.value = dayIdx
  // Lane stays locked to where the user initially clicked
}

const onDragCreateEnd = () => {
  document.removeEventListener('mousemove', onDragCreateMove)
  document.removeEventListener('mouseup', onDragCreateEnd)

  if (!dragCreateActive.value) return

  const range = dragCreateRange.value
  if (range) {
    const startDate = props.visibleDates[range.minIdx]
    const endDate = props.visibleDates[range.maxIdx]
    if (startDate && endDate) {
      emit('newRecord', startDate, endDate)
    }
  }

  dragCreateActive.value = false
  dragCreateStartIdx.value = null
  dragCreateEndIdx.value = null
  dragCreateLaneIdx.value = null
}

// #21: Keyboard navigation between bars
const onBarKeydown = (event: KeyboardEvent, record: RowType, laneIdx: number, barIdx: number) => {
  if (event.key === 'Enter') {
    if (!isInteracting.value && !justFinishedResize.value) {
      emit('expandRecord', record)
    }
    return
  }

  // Arrow key navigation: find next/prev bar
  let targetLane = laneIdx
  let targetBar = barIdx

  if (event.key === 'ArrowDown' && laneIdx < swimlanes.value.length - 1) {
    targetLane = laneIdx + 1
    targetBar = Math.min(barIdx, swimlanes.value[targetLane].length - 1)
  } else if (event.key === 'ArrowUp' && laneIdx > 0) {
    targetLane = laneIdx - 1
    targetBar = Math.min(barIdx, swimlanes.value[targetLane].length - 1)
  } else if (event.key === 'ArrowRight') {
    if (barIdx < swimlanes.value[laneIdx].length - 1) {
      targetBar = barIdx + 1
    }
  } else if (event.key === 'ArrowLeft') {
    if (barIdx > 0) {
      targetBar = barIdx - 1
    }
  } else {
    return
  }

  event.preventDefault()
  // Focus the target bar
  const targetEl = gridBodyRef.value?.querySelector(
    `[data-lane="${targetLane}"][data-bar="${targetBar}"]`,
  ) as HTMLElement | null
  targetEl?.focus()
}

// Sync horizontal scroll between header and body
const headerScrollRef = ref<HTMLElement | null>(null)
const bodyScrollRef = ref<HTMLElement | null>(null)

const onBodyScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft
  }
}

// --- Hover date hairline ---
const hoverColIndex = ref<number | null>(null)

const onGridMouseMove = (event: MouseEvent) => {
  if (resizeInProgress.value || dragInProgress.value) return
  const target = bodyScrollRef.value || gridBodyRef.value
  if (!target) return
  const rect = target.getBoundingClientRect()
  const scrollLeft = bodyScrollRef.value?.scrollLeft ?? 0
  const x = event.clientX - rect.left + scrollLeft
  const idx = Math.floor(x / colWidth.value)
  if (idx >= 0 && idx < props.visibleDates.length) {
    hoverColIndex.value = idx
  } else {
    hoverColIndex.value = null
  }
}

const onHeaderMouseMove = (event: MouseEvent) => {
  const target = headerScrollRef.value
  if (!target) return
  const rect = target.getBoundingClientRect()
  const scrollLeft = target.scrollLeft
  const x = event.clientX - rect.left + scrollLeft
  const idx = Math.floor(x / colWidth.value)
  if (idx >= 0 && idx < props.visibleDates.length) {
    hoverColIndex.value = idx
  } else {
    hoverColIndex.value = null
  }
}

const onGridMouseLeave = () => {
  hoverColIndex.value = null
}

const hoverDate = computed(() => {
  if (hoverColIndex.value === null) return null
  return props.visibleDates[hoverColIndex.value] ?? null
})

const hoverLineLeft = computed(() => {
  if (hoverColIndex.value === null) return 0
  return hoverColIndex.value * colWidth.value + colWidth.value / 2
})
</script>

<template>
  <div class="relative flex flex-col h-full overflow-hidden" :style="{ minHeight: (hasRecordsBefore || hasRecordsAfter) && !swimlanes.length ? `${ROW_HEIGHT}px` : undefined }">
    <!-- Date column headers (hidden when parent provides a shared header) -->
    <div v-if="!hideHeader" ref="gridContainerRef" class="flex-shrink-0 overflow-hidden">
      <div
        ref="headerScrollRef"
        class="overflow-x-hidden"
        @mousemove="onHeaderMouseMove"
        @mouseleave="onGridMouseLeave"
      >
        <div
          class="flex bg-nc-bg-default border-b border-nc-border-gray-medium"
          :style="{ width: needsHorizontalScroll ? `${totalGridWidth}px` : '100%' }"
        >
          <div
            v-for="(date, dateIdx) in visibleDates"
            :key="date.format('YYYY-MM-DD')"
            class="flex-shrink-0 border-r border-nc-border-gray-light flex flex-col items-center justify-center transition-colors duration-100"
            :class="{
              'bg-nc-bg-brand': isToday(date),
              'nc-timeline-header-hover': hoverColIndex === dateIdx && !isToday(date),
              'bg-nc-bg-gray-extralight': isWeekend(date) && !isToday(date) && hoverColIndex !== dateIdx,
            }"
            :style="{ width: `${colWidth}px`, height: `${HEADER_HEIGHT}px` }"
          >
            <span
              class="text-[10px] font-normal leading-tight"
              :class="{
                'text-nc-content-brand': isToday(date),
                'text-nc-content-gray-subtle': hoverColIndex === dateIdx && !isToday(date),
                'text-nc-content-gray-muted': hoverColIndex !== dateIdx && !isToday(date),
              }"
            >
              {{ zoomLevel === 'month' ? date.format('dd').charAt(0) : zoomLevel === 'week' ? date.format('ddd') : date.format('dddd') }}
            </span>
            <span
              class="text-[11px] leading-tight"
              :class="{
                'text-nc-content-brand': isToday(date),
                'font-semibold text-nc-content-gray-emphasis': hoverColIndex === dateIdx && !isToday(date),
                'font-normal text-nc-content-gray-muted': hoverColIndex !== dateIdx && !isToday(date),
              }"
            >
              {{ date.format('D') }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <!-- When header is hidden, still need a ref element to measure container width -->
    <div v-else ref="gridContainerRef" class="w-full h-0" />

    <!-- Scrollable grid body (#4: both axes scroll) -->
    <div
      ref="bodyScrollRef"
      :class="hideHeader ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 min-h-0 overflow-auto'"
      @scroll="onBodyScroll"
      @mousemove="onGridMouseMove"
      @mouseleave="onGridMouseLeave"
    >
      <div
        class="relative"
        :style="{ width: needsHorizontalScroll ? `${totalGridWidth}px` : '100%', minHeight: '100%' }"
      >
        <!-- Background layer: grid lines, weekend shading, today line — fills full height -->
        <div class="absolute inset-0 pointer-events-none">
          <!-- Weekend backgrounds -->
          <div
            v-for="(date, dateIdx) in visibleDates"
            :key="'bg-' + date.format('YYYY-MM-DD')"
            class="absolute top-0 bottom-0"
            :class="{ 'bg-nc-bg-gray-extralight': isWeekend(date) }"
            :style="{
              left: `${dateIdx * colWidth}px`,
              width: `${colWidth}px`,
            }"
          />
          <!-- Grid lines (vertical) -->
          <div
            v-for="(date, dateIdx) in visibleDates"
            :key="'line-' + date.format('YYYY-MM-DD')"
            class="absolute top-0 bottom-0 border-r border-nc-border-gray-light"
            :style="{ left: `${(dateIdx + 1) * colWidth}px` }"
          />
          <!-- Today indicator line -->
          <div
            v-if="todayPosition !== null"
            class="absolute top-0 bottom-0 bg-nc-content-brand"
            style="width: 1px"
            :style="{ left: `${todayPosition}px` }"
          />
          <!-- Hover date hairline -->
          <div
            v-if="hoverColIndex !== null && !dragCreateActive"
            class="absolute top-0 bottom-0 nc-timeline-hover-hairline"
            :style="{ left: `${hoverLineLeft}px` }"
          />
        </div>

        <!-- Content layer: bars and empty state — sits above backgrounds -->
        <div ref="gridBodyRef" class="relative w-full" style="z-index: 1" @mousedown="onGridBodyMouseDown">
          <!-- Swimlane rows -->
          <div
            v-for="(lane, laneIdx) in swimlanes"
            :key="laneIdx"
            class="relative border-b border-nc-border-gray-light"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <!-- Hover background -->
            <div class="absolute inset-0 hover:bg-nc-bg-gray-extralight transition-colors" />

            <!-- Bars in this lane -->
            <NcTooltip
              v-for="({ record, colorIndex }, barIdx) in lane"
              :key="colorIndex"
              :disabled="isInteracting"
              placement="top"
              class="absolute top-1"
              :style="getBarStyle(record)"
            >
              <template #title>
                <span class="text-xs font-semibold">{{ getBarTooltip(record) }}</span>
              </template>
              <div
                class="nc-timeline-bar border-1 flex items-center text-xs font-normal transition-shadow select-none group w-full relative overflow-hidden"
                :class="{
                  'cursor-pointer hover:shadow-md': !isInteracting,
                  'cursor-grabbing': dragInProgress && dragRecord === record,
                  'cursor-grab': !isInteracting && canResize,
                  'pointer-events-none opacity-30': isInteracting && interactionRecord !== record,
                  'z-100 shadow-lg': isInteracting && interactionRecord === record,
                  'bg-nc-bg-default border-nc-border-gray-dark text-nc-content-gray': !getRowColorStyle(record).rowBgColor?.backgroundColor,
                  'rounded-l-md': isStartVisible(record),
                  'rounded-r-md': isEndVisible(record),
                }"
                :style="{
                  height: `${ROW_HEIGHT - 8}px`,
                  ...getRowColorStyle(record).rowBgColor,
                }"
                :data-lane="laneIdx"
                :data-bar="barIdx"
                data-testid="nc-timeline-bar"
                :data-unique-id="record.rowMeta?.id"
                role="button"
                tabindex="0"
                @click="!isInteracting && !justFinishedResize && emit('expandRecord', record)"
                @keydown="onBarKeydown($event, record, laneIdx, barIdx)"
                @mousedown.stop="onDragStart($event, record)"
              >
                <!-- #17: Left border color accent — only when the record's start is in the visible range -->
                <div
                  v-if="isStartVisible(record)"
                  class="absolute left-0 top-0 bottom-0 w-1 rounded-l-md pointer-events-none"
                  :style="getRowColorStyle(record).rowLeftBorderColor?.backgroundColor
                    ? getRowColorStyle(record).rowLeftBorderColor
                    : { backgroundColor: 'var(--color-gray-900, #101015)' }"
                />
                <!-- Left resize handle (start date) — offset past the accent -->
                <div
                  v-if="canResize"
                  class="nc-timeline-resize-handle nc-timeline-resize-handle--left absolute left-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('left', $event, record)"
                >
                  <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <span
                  class="truncate inline-flex items-center"
                  :class="{
                    'pl-7': !isStartVisible(record),
                    'pl-2.5': isStartVisible(record),
                    'pr-7': !isEndVisible(record),
                    'pr-2': isEndVisible(record),
                  }"
                >
                  <template v-for="field in fields" :key="field.id">
                    <LazySmartsheetPlainCell
                      v-if="!isRowEmpty(record, field!)"
                      v-model="record.row[field!.title!]"
                      class="text-xs"
                      :bold="fieldStyles[field.id]?.bold"
                      :column="field"
                      :italic="fieldStyles[field.id]?.italic"
                      :underline="fieldStyles[field.id]?.underline"
                    />
                  </template>
                </span>

                <!-- Per-bar left nav arrow — when start is clipped -->
                <div
                  v-if="!isStartVisible(record)"
                  class="nc-timeline-nav-arrow absolute left-0 top-0 h-full z-20 flex items-center"
                  @click.stop="navigateToRecordStart(record)"
                  @mousedown.stop
                >
                  <div
                    class="flex items-center justify-center w-5 h-5 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors ml-0.5"
                  >
                    <GeneralIcon icon="arrowLeft" class="text-nc-content-gray-muted w-3 h-3" />
                  </div>
                </div>

                <!-- Right resize handle (end date) — only when end date column exists -->
                <div
                  v-if="canResize && timelineRange[0]?.fk_to_col"
                  class="nc-timeline-resize-handle nc-timeline-resize-handle--right absolute right-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('right', $event, record)"
                >
                  <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <!-- Per-bar right nav arrow — when end is clipped -->
                <div
                  v-if="!isEndVisible(record)"
                  class="nc-timeline-nav-arrow absolute right-0 top-0 h-full z-20 flex items-center"
                  @click.stop="navigateToRecordEnd(record)"
                  @mousedown.stop
                >
                  <div
                    class="flex items-center justify-center w-5 h-5 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors mr-0.5"
                  >
                    <GeneralIcon icon="arrowRight" class="text-nc-content-gray-muted w-3 h-3" />
                  </div>
                </div>
              </div>
            </NcTooltip>
          </div>

          <!-- Empty row for inserting a new record (flat mode only) -->
          <!-- Clicks and drags are handled by the parent onGridBodyMouseDown (drag-to-create) -->
          <div
            v-if="!hideHeader && isUIAllowed('dataEdit')"
            class="nc-timeline-add-row relative border-b border-nc-border-gray-light flex items-center cursor-cell transition-colors group"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <div class="flex items-center gap-2 pl-3 text-nc-content-gray-muted">
              <GeneralIcon icon="plus" class="w-4 h-4" />
            </div>
          </div>

          <!-- Drag-to-create dotted rectangle -->
          <div
            v-if="dragCreateActive && dragCreateStyle"
            class="absolute nc-timeline-drag-create-rect pointer-events-none"
            :style="dragCreateStyle"
          />

          <!-- #9: Empty state grid filler — using i18n -->
        </div>
      </div>
    </div>

    <!-- Grid-level nav arrows — only for fully off-screen records (no bars visible) -->
    <div
      v-if="hasRecordsBefore"
      class="absolute left-1 inset-y-0 z-10 flex items-center pointer-events-none"
    >
      <div
        class="nc-timeline-nav-btn flex items-center justify-center w-6 h-6 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors pointer-events-auto"
        data-testid="nc-timeline-nav-prev"
        @click.stop="navigateToPrev"
      >
        <GeneralIcon icon="arrowLeft" class="text-nc-content-gray-muted w-3.5 h-3.5" />
      </div>
    </div>

    <div
      v-if="hasRecordsAfter"
      class="absolute right-1 inset-y-0 z-10 flex items-center pointer-events-none"
    >
      <div
        class="nc-timeline-nav-btn flex items-center justify-center w-6 h-6 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors pointer-events-auto"
        data-testid="nc-timeline-nav-next"
        @click.stop="navigateToNext"
      >
        <GeneralIcon icon="arrowRight" class="text-nc-content-gray-muted w-3.5 h-3.5" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Resize handle — cursor + hit area */
.nc-timeline-resize-handle {
  cursor: ew-resize !important;
}

/* Resize handle grip indicator — visible pill that appears on bar hover */
.nc-timeline-resize-grip {
  width: 4px;
  height: 14px;
  background-color: var(--nc-content-gray-muted);
  transition: background-color 0.15s ease;
}

/* Darken the grip on direct handle hover for extra feedback */
.nc-timeline-resize-handle:hover .nc-timeline-resize-grip {
  background-color: var(--nc-content-gray);
}

/* Slightly round inward edge for left handle */
.nc-timeline-resize-handle--left {
  border-radius: 4px 0 0 4px;
}

/* Slightly round inward edge for right handle */
.nc-timeline-resize-handle--right {
  border-radius: 0 4px 4px 0;
}

/* Neutral bar shadow matching calendar RecordCard */
.nc-timeline-bar {
  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);
}

.nc-timeline-bar:hover {
  box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.10), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);
}

/* Hover date hairline — thin vertical line following mouse column */
.nc-timeline-hover-hairline {
  width: 1px;
  background-color: var(--nc-border-gray-medium);
  pointer-events: none;
  z-index: 2;
}

/* Header cell highlight on hover */
.nc-timeline-header-hover {
  background-color: var(--nc-bg-gray-light);
}

/* Add-row: translucent wash so it reads as a placeholder, not a data row */
.nc-timeline-add-row::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--nc-bg-default);
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.nc-timeline-add-row:hover::before {
  opacity: 0;
}

.nc-timeline-add-row:hover {
  background-color: var(--nc-bg-gray-extralight);
}

/* Drag-to-create dotted rectangle */
.nc-timeline-drag-create-rect {
  border: 1.5px dashed var(--nc-border-brand);
  border-radius: 6px;
  background-color: var(--nc-bg-brand);
  opacity: 0.15;
  z-index: 10;
}
</style>
