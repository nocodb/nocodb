<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'
import { TIMELINE_GROUP_HEADER_HEIGHT, type TimelineZoomLevel } from '../../../utils/timelineUtils'
import type { Row as RowType } from '#imports'

// Pre-computed per-bar geometry + style. Built once per swimlanes recompute
// (record / buffer / colWidth / rowMeta changes) so per-frame scroll
// handlers and the template only do numeric / property reads.
interface BarMeta {
  record: RowType
  // Stable per-record key for v-for. Comes from the row's primary key when
  // available — falls back to the records-array index so unsaved rows still
  // diff correctly. Stable across swimlanes recomputes (visibleRecords
  // changes, buffer trims) so Vue patches in place rather than remounting,
  // preserving NcTooltip hover state.
  key: string | number
  colorIndex: number
  startDate: dayjs.Dayjs
  endDate: dayjs.Dayjs
  startVisible: boolean
  endVisible: boolean
  leftPx: number
  widthPx: number
  // Row-coloring outputs (extractRowBackgroundColorStyle), pre-resolved so
  // the template doesn't call it 4× per bar.
  bgStyle: Record<string, string>
  borderStyle: Record<string, string>
  hasBgColor: boolean
}

const props = defineProps<{
  records: RowType[]
  visibleDates: dayjs.Dayjs[]
  timelineRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>
  zoomLevel: TimelineZoomLevel
  hideHeader?: boolean
}>()

const emit = defineEmits<{
  (event: 'expandRecord', row: RowType): void
  (event: 'newRecord', startDate: dayjs.Dayjs, endDate: dayjs.Dayjs): void
  (event: 'navigateTo', date: dayjs.Dayjs): void
}>()

const { isUIAllowed } = useRoles()

const { isAllowed } = usePermissions()

const { $e } = useNuxtApp()

const {
  updateRowProperty,
  updateFormat,
  colWidth,
  totalGridWidth,
  scrollLeft: storeScrollLeft,
  viewportWidth: storeViewportWidth,
  onScrollUpdate,
  setViewportWidth,
  onScrollAdjustment,
  majorHeaderTiers,
  gridlineOffsets,
  weekendOffsets,
  minorLabels,
} = useTimelineViewStoreOrThrow()

// Visible fields from the Fields menu (injected by parent Smartsheet/shared-view)
const fields = inject(FieldsInj, ref())

// Table meta — needed for primary-key extraction so each bar has a stable
// v-for key across swimlanes recomputes (instead of using its index in
// visibleRecords, which shifts when records are added/removed/reordered).
const meta = inject(MetaInj, ref())

// View column configs (for bold/italic/underline styles)
const { fields: viewFields } = useViewColumnsOrThrow()

// Build a lookup: columnId → { bold, italic, underline }
const fieldStyles = computed(() => {
  return (viewFields.value ?? []).reduce((acc, field) => {
    acc[field.fk_column_id!] = {
      bold: !!field.bold,
      italic: !!field.italic,
      underline: !!field.underline,
    }
    return acc
  }, {} as Record<string, { bold?: boolean; italic?: boolean; underline?: boolean }>)
})

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

// Horizontal scroll: the body is the user-scrolled element; the header
// follows via a watcher on the store's scrollLeft. In grouped mode multiple
// Grid instances exist — they all sync to the same store value.
const headerScrollRef = ref<HTMLElement | null>(null)
const bodyScrollRef = ref<HTMLElement | null>(null)

onMounted(() => {
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Sync DOM scrollLeft to the store's scrollLeft on mount. New Grid
  // instances (e.g., after a data reload that swapped in the loader, or after
  // switching back to the timeline view) start with scrollLeft=0; without
  // this, the first native scroll event from any source would call
  // onScrollUpdate(0) and stomp currentDate to "the date at viewport-centre
  // when scrolled to 0", which is not what the store says we're looking at.
  nextTick(() => {
    const target = storeScrollLeft.value
    if (target <= 0) return
    if (bodyScrollRef.value) bodyScrollRef.value.scrollLeft = target
    if (headerScrollRef.value) headerScrollRef.value.scrollLeft = target
  })
})

const ROW_HEIGHT = 36

// Measure the grid container — drives viewport width for scroll math
const gridContainerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(gridContainerRef)

// Push viewport width into the store so it can compute scroll targets and
// derive currentDate from viewport center.
watch(
  containerWidth,
  (w) => {
    if (w > 0) setViewportWidth(w)
  },
  { immediate: true },
)

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
const useDebouncedRowUpdate = useDebounceFn((row: RowType, updateProperty: string[]) => {
  updateRowProperty(row, updateProperty)
}, 500)

// Parse date from row for a given column
const parseDate = (row: RowType, col: ColumnType | undefined | null) => {
  if (!col?.title) return null
  const val = row.row?.[col.title]
  if (!val) return null
  const d = dayjs(val)
  return d.isValid() ? d : null
}

// --- Hover date hairline ---
const hoverColIndex = ref<number | null>(null)

// --- Resize event handlers ---

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
    resizeRecord.value.row[toCol.title] = isDateOnly ? newEndDate.format('YYYY-MM-DD') : newEndDate.format(dateFormat)
    updateProperty = [toCol.title]
  } else if (resizeDirection.value === 'left' && fromCol?.title) {
    // Resizing start date
    let newStartDate = newDate
    const effectiveEnd = ogEndDate || ogStartDate
    // Clamp: start date must not be after end date
    if (newStartDate.isAfter(effectiveEnd, 'day')) {
      newStartDate = effectiveEnd.clone()
    }
    resizeRecord.value.row[fromCol.title] = isDateOnly ? newStartDate.format('YYYY-MM-DD') : newStartDate.format(dateFormat)
    updateProperty = [fromCol.title]
  } else {
    return
  }

  // Debounced API update
  useDebouncedRowUpdate(resizeRecord.value, updateProperty)
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

// Check if editing is allowed and range is not readonly (system column type)
const isRangeEditable = computed(() => {
  return isUIAllowed('dataEdit') && !props.timelineRange[0]?.is_readonly
})

// Field-level edit permission for start date column
const canEditFromCol = computed(() => {
  const col = props.timelineRange[0]?.fk_from_col
  if (!col?.id) return true
  return isAllowed(PermissionEntity.FIELD, col.id, PermissionKey.RECORD_FIELD_EDIT)
})

// Field-level edit permission for end date column
const canEditToCol = computed(() => {
  const col = props.timelineRange[0]?.fk_to_col
  if (!col?.id) return true
  return isAllowed(PermissionEntity.FIELD, col.id, PermissionKey.RECORD_FIELD_EDIT)
})

// Can drag (move) a bar — requires edit permission on ALL date columns used
const canDrag = computed(() => {
  if (!isRangeEditable.value) return false
  if (!canEditFromCol.value) return false
  if (props.timelineRange[0]?.fk_to_col && !canEditToCol.value) return false
  return true
})

// Can resize left handle (start date)
const canResizeLeft = computed(() => isRangeEditable.value && canEditFromCol.value)

// Can resize right handle (end date)
const canResizeRight = computed(() => {
  if (!isRangeEditable.value) return false
  return props.timelineRange[0]?.fk_to_col ? canEditToCol.value : canEditFromCol.value
})

const onResizeStart = (direction: 'left' | 'right', event: MouseEvent, record: RowType) => {
  if (direction === 'left' && !canResizeLeft.value) return
  if (direction === 'right' && !canResizeRight.value) return

  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  hoverColIndex.value = null

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
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
  dragRecord.value.row[fromCol.title!] = isDateOnly ? newStart.format('YYYY-MM-DD') : newStart.format(dateFormat)

  const updateProperty = [fromCol.title!]

  if (toCol?.title && ogEndDate) {
    const newEnd = ogEndDate.add(dayDelta, 'day')
    dragRecord.value.row[toCol.title] = isDateOnly ? newEnd.format('YYYY-MM-DD') : newEnd.format(dateFormat)
    updateProperty.push(toCol.title)
  }

  // Update the reference day index so delta is always relative
  dragStartDayIndex.value = currentDayIdx

  useDebouncedRowUpdate(dragRecord.value, updateProperty)
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

const onDragStart = (event: MouseEvent, record: RowType) => {
  if (!canDrag.value) return

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

// Set true as soon as the pointer crosses a day boundary during a drag-create
// gesture. A plain click (mousedown→mouseup without crossing days) shouldn't
// open the new-record modal — only an actual drag or a dblclick should.
const dragCreateMoved = ref(false)

const onDragCreateMove = (event: MouseEvent) => {
  if (!dragCreateActive.value || !gridBodyRef.value) return
  const dayIdx = getDayIndexFromEvent(event)
  if (dayIdx !== dragCreateStartIdx.value) dragCreateMoved.value = true
  dragCreateEndIdx.value = dayIdx
  // Lane stays locked to where the user initially clicked
}

const onDragCreateEnd = () => {
  document.removeEventListener('mousemove', onDragCreateMove)
  document.removeEventListener('mouseup', onDragCreateEnd)

  if (!dragCreateActive.value) return

  if (dragCreateMoved.value) {
    const range = dragCreateRange.value
    if (range) {
      const startDate = props.visibleDates[range.minIdx]
      const endDate = props.visibleDates[range.maxIdx]
      if (startDate && endDate) {
        emit('newRecord', startDate, endDate)
      }
    }
  }

  dragCreateActive.value = false
  dragCreateStartIdx.value = null
  dragCreateEndIdx.value = null
  dragCreateLaneIdx.value = null
  dragCreateMoved.value = false
}

// Whether any interaction (resize or drag) is happening. Drag-create counts
// only AFTER the pointer has crossed a day boundary — otherwise a plain click
// would briefly flip this flag and dim every bar (opacity-30) for the
// duration of the click, producing a visible flash.
const isInteracting = computed(
  () => resizeInProgress.value || dragInProgress.value || (dragCreateActive.value && dragCreateMoved.value),
)
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

// Compute the painted viewport's date range. `props.visibleDates` spans
// the full date-axis buffer (months wider than what's on screen under
// infinite scroll), so using its first/last entries reports "visible"
// for any bar inside the buffer — far too generous for the clipped-bar
// nav arrows. Translate scrollLeft + viewportWidth into buffer indices
// to derive the actual painted edges, clamped to buffer bounds.
const viewportEdges = computed<{ first: dayjs.Dayjs; last: dayjs.Dayjs } | null>(() => {
  const buffer = props.visibleDates
  const cw = colWidth.value
  const vw = storeViewportWidth.value
  if (!buffer?.length || !cw || !vw) return null
  const firstIdx = Math.max(0, Math.floor(storeScrollLeft.value / cw))
  const lastIdx = Math.min(buffer.length - 1, Math.ceil((storeScrollLeft.value + vw) / cw) - 1)
  const first = buffer[firstIdx]
  const last = buffer[lastIdx]
  if (!first || !last) return null
  return { first, last }
})

// Swimlane packing: group non-overlapping records into lanes so bars sit side
// by side. Each entry carries pre-computed bar geometry (parsed dates,
// visibility flags, leftPx/widthPx) so the per-scroll-tick render path
// (`getLabelStyle`, bar `:style`, `:class`) only does numeric arithmetic.
// `colorIndex` is the record's position in `visibleRecords` (stable coloring).
const swimlanes = computed<BarMeta[][]>(() => {
  const range = props.timelineRange[0]
  if (!range) return []

  const firstBufferDate = props.visibleDates[0]
  const lastBufferDate = props.visibleDates[props.visibleDates.length - 1]
  if (!firstBufferDate || !lastBufferDate) return []

  // Visibility flags drive the per-bar nav arrows + corner rounding — they
  // must reflect the painted viewport, not the wider buffer. Fall back to
  // the buffer edges until measurements anchor (avoids a flash of stray
  // arrows on first paint).
  const edges = viewportEdges.value
  const viewportFirst = edges?.first ?? firstBufferDate
  const viewportLast = edges?.last ?? lastBufferDate

  const cw = colWidth.value
  const lanes: Array<{ records: BarMeta[]; lastEnd: dayjs.Dayjs }> = []

  visibleRecords.value.forEach((record, idx) => {
    const startDate = parseDate(record, range.fk_from_col)
    const endDate = range.fk_to_col ? parseDate(record, range.fk_to_col) : startDate
    if (!startDate) return

    const effectiveEnd = endDate || startDate
    if (endDate && effectiveEnd.isBefore(startDate, 'day')) return

    const startVisible = !startDate.isBefore(viewportFirst, 'day')
    const endVisible = !effectiveEnd.isAfter(viewportLast, 'day')
    // Clamp to the buffer (not the viewport) for geometry — leftPx/widthPx
    // are buffer-relative offsets so the bar paints at its real date even
    // when it extends past the viewport. Buffer clamping only kicks in
    // when the bar's dates fall outside the buffer entirely.
    const clampedStart = startDate.isBefore(firstBufferDate, 'day') ? firstBufferDate : startDate
    const clampedEnd = effectiveEnd.isAfter(lastBufferDate, 'day') ? lastBufferDate : effectiveEnd
    const startOffset = clampedStart.diff(firstBufferDate, 'day')
    const duration = clampedEnd.diff(clampedStart, 'day') + 1

    const colorStyle = extractRowBackgroundColorStyle(record)
    const leftBorder = colorStyle.rowLeftBorderColor as { backgroundColor?: string }
    const pk = extractPkFromRow(record.row, (meta.value?.columns ?? []) as ColumnType[])
    const barMeta: BarMeta = {
      record,
      key: pk ?? `__idx_${idx}`,
      colorIndex: idx,
      startDate,
      endDate: effectiveEnd,
      startVisible,
      endVisible,
      leftPx: startOffset * cw,
      // Allow bars to shrink to a 1px hairline at coarse zooms.
      widthPx: Math.max(duration * cw - 4, 1),
      bgStyle: colorStyle.rowBgColor as Record<string, string>,
      borderStyle: leftBorder?.backgroundColor
        ? (leftBorder as Record<string, string>)
        : { backgroundColor: 'var(--color-gray-900, #101015)' },
      hasBgColor: !!(colorStyle.rowBgColor as { backgroundColor?: string })?.backgroundColor,
    }

    let placed = false
    for (const lane of lanes) {
      if (startDate.isAfter(lane.lastEnd, 'day')) {
        lane.records.push(barMeta)
        lane.lastEnd = effectiveEnd
        placed = true
        break
      }
    }

    if (!placed) {
      lanes.push({ records: [barMeta], lastEnd: effectiveEnd })
    }
  })

  return lanes.map((lane) => lane.records)
})

// Pure arithmetic — no dayjs allocations, no string parsing. Reactive on
// `storeScrollLeft` / `storeViewportWidth`; everything else comes from the
// pre-computed `BarMeta`. The 28px reserves room for the per-bar nav arrows,
// which now anchor to the painted viewport edges (see arrow template). When
// an arrow is rendered (`!startVisible` / `!endVisible`), the label sticks
// past it; otherwise the label hugs the bar with the smaller default padding.
const getLabelStyle = (bar: BarMeta) => {
  const vpLeft = storeScrollLeft.value

  const startPad = !bar.startVisible ? 28 : 10
  const endPad = !bar.endVisible ? 28 : 8

  const scrolledPast = Math.max(0, vpLeft - bar.leftPx)
  const minLabelWidth = 8
  const maxLeftInBar = Math.max(startPad, bar.widthPx - endPad - minLabelWidth)
  const leftInBar = Math.min(scrolledPast + startPad, maxLeftInBar)

  return {
    left: `${leftInBar}px`,
    right: `${endPad}px`,
  }
}

// #11: Build tooltip text for a record bar — improved format with em-dash and year
const getBarTooltip = (bar: BarMeta) => {
  const days = bar.endDate.diff(bar.startDate, 'day') + 1

  if (days <= 1) {
    return bar.startDate.format('MMM D, YYYY')
  }

  // Show year on both sides if they differ, otherwise only on end
  const sameYear = bar.startDate.year() === bar.endDate.year()
  const startFmt = sameYear ? 'MMM D' : 'MMM D, YYYY'
  return `${bar.startDate.format(startFmt)} — ${bar.endDate.format('MMM D, YYYY')}  ·  ${days} days`
}

// Today indicator position (center of today's column, for the body's
// vertical line). `todayDayIdx` exposes the column index so overlays can
// position themselves at the cell's left edge with `colWidth` width.
const todayDayIdx = computed(() => {
  const firstDate = props.visibleDates[0]
  if (!firstDate) return -1
  const offset = today.value.diff(firstDate, 'day')
  if (offset < 0 || offset >= props.visibleDates.length) return -1
  return offset
})

const todayPosition = computed(() => {
  if (todayDayIdx.value < 0) return null
  return todayDayIdx.value * colWidth.value + colWidth.value / 2
})

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

// When embedded in a group (hideHeader), the grid must size to its content
// so the CSS Grid row in GroupBy expands to show all swimlane rows
const groupedGridHeight = computed(() => {
  if (!props.hideHeader) return undefined
  const lanes = Math.max(swimlanes.value.length, 1)
  return `${lanes * ROW_HEIGHT}px`
})

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
  if (
    target.closest('.nc-timeline-bar') ||
    target.closest('.nc-timeline-resize-handle') ||
    target.closest('.nc-timeline-nav-arrow') ||
    target.closest('.nc-timeline-nav-btn')
  )
    return

  const dayIdx = getDayIndexFromEvent(event)
  const laneIdx = getLaneIndexFromEvent(event)
  dragCreateActive.value = true
  dragCreateStartIdx.value = dayIdx
  dragCreateEndIdx.value = dayIdx
  dragCreateLaneIdx.value = laneIdx

  document.addEventListener('mousemove', onDragCreateMove)
  document.addEventListener('mouseup', onDragCreateEnd)
}

// Double-click on empty grid area = create a single-day record at the
// pointer's day. Skips when clicking on a bar/handle (same exclusions as
// onGridBodyMouseDown).
const onGridBodyDblClick = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit')) return
  const target = event.target as HTMLElement
  if (
    target.closest('.nc-timeline-bar') ||
    target.closest('.nc-timeline-resize-handle') ||
    target.closest('.nc-timeline-nav-arrow') ||
    target.closest('.nc-timeline-nav-btn')
  )
    return
  const dayIdx = getDayIndexFromEvent(event)
  const date = props.visibleDates[dayIdx]
  if (!date) return
  emit('newRecord', date, date)
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
  const targetEl = gridBodyRef.value?.querySelector(`[data-lane="${targetLane}"][data-bar="${targetBar}"]`) as HTMLElement | null
  targetEl?.focus()
}

const onBodyScroll = (event: Event) => {
  const target = event.target as HTMLElement
  // Idempotent guard: when the store updates scrollLeft and we mirror it back
  // onto this element, the resulting native scroll event would otherwise
  // re-enter the store. Bail when the value already matches.
  if (target.scrollLeft === storeScrollLeft.value) return
  onScrollUpdate(target.scrollLeft)
}

// Mirror store scrollLeft → DOM. Both header and body track it. `flush: sync`
// keeps the header in lockstep with the body during user scrolling — without
// it, the watch fires post-render and the header visibly lags.
watch(
  () => storeScrollLeft.value,
  (newLeft) => {
    if (headerScrollRef.value && headerScrollRef.value.scrollLeft !== newLeft) {
      headerScrollRef.value.scrollLeft = newLeft
    }
    if (bodyScrollRef.value && bodyScrollRef.value.scrollLeft !== newLeft) {
      bodyScrollRef.value.scrollLeft = newLeft
    }
  },
  { flush: 'sync' },
)

// Imperative scroll adjustments from the store (goToDate / today / prev /
// next / buffer extension). Applied after the DOM has rendered the new
// buffer width — both header and body move atomically to avoid a frame of
// visible drift.
onScrollAdjustment(({ type, value }) => {
  nextTick(() => {
    const apply = (el: HTMLElement | null) => {
      if (!el) return
      if (type === 'delta') el.scrollLeft += value
      else el.scrollLeft = value
    }
    apply(bodyScrollRef.value)
    apply(headerScrollRef.value)
  })
})

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
</script>

<template>
  <div
    class="relative flex flex-col overflow-hidden"
    :class="{ 'h-full': !hideHeader }"
    :style="{
      minHeight: (hasRecordsBefore || hasRecordsAfter) && !swimlanes.length ? `${ROW_HEIGHT}px` : undefined,
      height: groupedGridHeight,
    }"
  >
    <!-- Date column headers (hidden when parent provides a shared header) -->
    <div v-if="!hideHeader" ref="gridContainerRef" class="flex-shrink-0 overflow-hidden">
      <div ref="headerScrollRef" class="overflow-x-hidden" @mousemove="onHeaderMouseMove" @mouseleave="onGridMouseLeave">
        <SmartsheetSharedDateAxisHeader
          :major-header-tiers="majorHeaderTiers"
          :minor-labels="minorLabels"
          :weekend-offsets="weekendOffsets"
          :gridline-offsets="gridlineOffsets"
          :col-width="colWidth"
          :total-grid-width="totalGridWidth"
          :today-day-idx="todayDayIdx"
          :minor-height="TIMELINE_GROUP_HEADER_HEIGHT"
          :hover-col-index="hoverColIndex"
        />
      </div>
    </div>
    <!-- When header is hidden, still need a ref element to measure container width -->
    <div v-else ref="gridContainerRef" class="w-full h-0" />

    <!-- Scrollable grid body. Flat mode: scroll both axes. Grouped mode (hideHeader):
         scroll only horizontally; vertical scroll lives on the GroupBy wrapper.
         The horizontal scrollbar is hidden in grouped mode so users see only the
         shared scrollbar on the top date header. -->
    <div
      ref="bodyScrollRef"
      :class="hideHeader ? 'overflow-x-auto overflow-y-hidden nc-timeline-no-scrollbar' : 'flex-1 min-h-0 overflow-auto'"
      @scroll="onBodyScroll"
      @mousemove="onGridMouseMove"
      @mouseleave="onGridMouseLeave"
    >
      <div class="relative" :style="{ width: `${totalGridWidth}px`, minHeight: '100%' }">
        <!-- Background layer: grid lines, weekend shading, today line — fills full height -->
        <div class="absolute inset-0 pointer-events-none">
          <!-- Weekend stripes (only at fine zooms — see weekendOffsets in store) -->
          <div
            v-for="off in weekendOffsets"
            :key="`bg-${off.key}`"
            class="absolute top-0 bottom-0 bg-nc-bg-gray-extralight"
            :style="{ left: `${off.leftPx}px`, width: `${colWidth}px` }"
          />
          <!-- Grid lines at the current scale's gridline cadence -->
          <div
            v-for="off in gridlineOffsets"
            :key="`line-${off.key}`"
            class="absolute top-0 bottom-0 border-r border-nc-border-gray-light"
            :style="{ left: `${off.leftPx}px` }"
          />
          <!-- Today indicator line -->
          <div
            v-if="todayPosition !== null"
            class="absolute top-0 bottom-0 bg-nc-content-brand"
            style="width: 1px"
            :style="{ left: `${todayPosition}px` }"
          />
          <!-- Hover date column highlight -->
          <div
            v-if="hoverColIndex !== null && !dragCreateActive"
            class="absolute top-0 bottom-0 nc-timeline-content-hover pointer-events-none"
            :style="{ left: `${hoverColIndex * colWidth}px`, width: `${colWidth}px` }"
          />
        </div>

        <!-- Content layer: bars and empty state — sits above backgrounds -->
        <div
          ref="gridBodyRef"
          class="relative w-full"
          style="z-index: 1"
          @mousedown="onGridBodyMouseDown"
          @dblclick="onGridBodyDblClick"
        >
          <!-- Swimlane rows -->
          <div
            v-for="(lane, laneIdx) in swimlanes"
            :key="laneIdx"
            class="relative border-b border-nc-border-gray-light"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <!-- Hover background -->
            <div class="absolute inset-0 nc-timeline-row-hover transition-colors" />

            <!-- Bars in this lane -->
            <template v-for="(bar, barIdx) in lane" :key="bar.key">
              <NcTooltip
                :disabled="isInteracting"
                placement="top"
                class="absolute top-1"
                :style="{ left: `${bar.leftPx}px`, width: `${bar.widthPx}px` }"
              >
                <template #title>
                  <span class="text-xs font-semibold">{{ getBarTooltip(bar) }}</span>
                </template>
                <div
                  class="nc-timeline-bar border-1 flex items-center text-xs font-normal transition-shadow select-none group w-full relative overflow-hidden"
                  :class="{
                    'cursor-grabbing': dragInProgress && dragRecord === bar.record && canDrag,
                    'cursor-grab': !isInteracting && canDrag,
                    'cursor-pointer hover:shadow-md': !isInteracting && !canDrag,
                    'pointer-events-none opacity-30': isInteracting && interactionRecord !== bar.record,
                    'z-100 shadow-lg': isInteracting && interactionRecord === bar.record,
                    'bg-nc-bg-default border-nc-border-gray-dark text-nc-content-gray': !bar.hasBgColor,
                    'rounded-l-md': bar.startVisible,
                    'rounded-r-md': bar.endVisible,
                  }"
                  :style="{
                    height: `${ROW_HEIGHT - 8}px`,
                    ...bar.bgStyle,
                  }"
                  :data-lane="laneIdx"
                  :data-bar="barIdx"
                  data-testid="nc-timeline-bar"
                  :data-unique-id="bar.record.rowMeta?.id"
                  role="button"
                  tabindex="0"
                  @click="!isInteracting && !justFinishedResize && emit('expandRecord', bar.record)"
                  @keydown="onBarKeydown($event, bar.record, laneIdx, barIdx)"
                  @mousedown.stop="onDragStart($event, bar.record)"
                >
                  <!-- #17: Left border color accent — only when the record's start is in the visible range -->
                  <div
                    v-if="bar.startVisible"
                    class="absolute left-0 top-0 bottom-0 w-1 rounded-l-md pointer-events-none"
                    :style="bar.borderStyle"
                  />
                  <!-- Left resize handle (start date) — offset past the accent -->
                  <div
                    v-if="canResizeLeft"
                    class="nc-timeline-resize-handle nc-timeline-resize-handle--left absolute left-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                    @mousedown.stop="onResizeStart('left', $event, bar.record)"
                  >
                    <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <span class="absolute top-0 bottom-0 truncate inline-flex items-center" :style="getLabelStyle(bar)">
                    <template v-for="field in fields" :key="field.id">
                      <LazySmartsheetPlainCell
                        v-if="!isRowEmpty(bar.record, field!)"
                        v-model="bar.record.row[field!.title!]"
                        class="text-xs"
                        :bold="fieldStyles[field.id]?.bold"
                        :column="field"
                        :italic="fieldStyles[field.id]?.italic"
                        :underline="fieldStyles[field.id]?.underline"
                      />
                    </template>
                  </span>

                  <!-- Right resize handle (end date) — only when end date column exists -->
                  <div
                    v-if="canResizeRight && timelineRange[0]?.fk_to_col"
                    class="nc-timeline-resize-handle nc-timeline-resize-handle--right absolute right-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                    @mousedown.stop="onResizeStart('right', $event, bar.record)"
                  >
                    <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </NcTooltip>

              <!-- Per-bar nav chevrons — siblings of the bar's NcTooltip and
                   anchored to the painted viewport edges (not the bar's own
                   edges, which scroll out of view under the infinite-scroll
                   buffer). Pattern matches Gantt's clipped-bar nav arrows. -->
              <div
                v-if="!bar.startVisible"
                class="nc-timeline-nav-arrow absolute top-1 bottom-1 z-20 flex items-center"
                :style="{ left: `${storeScrollLeft}px` }"
                role="button"
                tabindex="0"
                :aria-label="$t('labels.previous')"
                @click.stop="emit('navigateTo', bar.startDate)"
                @keydown.enter.prevent="emit('navigateTo', bar.startDate)"
                @keydown.space.prevent="emit('navigateTo', bar.startDate)"
                @mousedown.stop
              >
                <div
                  class="flex items-center justify-center w-5 h-5 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors ml-0.5"
                >
                  <GeneralIcon icon="arrowLeft" class="text-nc-content-gray-muted w-3 h-3" />
                </div>
              </div>

              <div
                v-if="!bar.endVisible"
                class="nc-timeline-nav-arrow absolute top-1 bottom-1 z-20 flex items-center"
                :style="{ right: `${Math.max(0, totalGridWidth - storeScrollLeft - storeViewportWidth)}px` }"
                role="button"
                tabindex="0"
                :aria-label="$t('labels.next')"
                @click.stop="emit('navigateTo', bar.endDate)"
                @keydown.enter.prevent="emit('navigateTo', bar.endDate)"
                @keydown.space.prevent="emit('navigateTo', bar.endDate)"
                @mousedown.stop
              >
                <div
                  class="flex items-center justify-center w-5 h-5 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors mr-0.5"
                >
                  <GeneralIcon icon="arrowRight" class="text-nc-content-gray-muted w-3 h-3" />
                </div>
              </div>
            </template>
          </div>

          <!-- Empty row for inserting a new record (flat mode only) -->
          <!-- Clicks and drags are handled by the parent onGridBodyMouseDown (drag-to-create) -->
          <div
            v-if="!hideHeader && isUIAllowed('dataEdit')"
            class="nc-timeline-add-row relative border-b border-nc-border-gray-light flex items-center cursor-cell transition-colors group"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <div class="flex items-center gap-2 pl-3 text-nc-content-gray-subtle2 group-hover:text-nc-content-gray">
              <GeneralIcon icon="plus" class="w-4 h-4" />
            </div>
          </div>

          <!-- Drag-to-create dotted rectangle -->
          <div
            v-if="dragCreateActive && dragCreateMoved && dragCreateStyle"
            class="absolute nc-timeline-drag-create-rect pointer-events-none"
            :style="dragCreateStyle"
          />

          <!-- #9: Empty state grid filler — using i18n -->
        </div>
      </div>
    </div>

    <!-- Grid-level nav arrows — only for fully off-screen records (no bars visible) -->
    <div v-if="hasRecordsBefore" class="absolute left-1 inset-y-0 z-10 flex items-center pointer-events-none">
      <div
        class="nc-timeline-nav-btn flex items-center justify-center w-6 h-6 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors pointer-events-auto"
        data-testid="nc-timeline-nav-prev"
        @click.stop="navigateToPrev"
      >
        <GeneralIcon icon="arrowLeft" class="text-nc-content-gray-muted w-3.5 h-3.5" />
      </div>
    </div>

    <div v-if="hasRecordsAfter" class="absolute right-1 inset-y-0 z-10 flex items-center pointer-events-none">
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
  box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);
}

/* Content area column & row highlight on hover — lighter than header */
.nc-timeline-content-hover {
  @apply bg-nc-bg-gray-light/60;
  z-index: 0;
}

.nc-timeline-row-hover:hover {
  @apply bg-nc-bg-gray-light/60;
}

/* Header column highlight on hover */
.nc-timeline-header-hover {
  @apply bg-nc-bg-gray-light/50;
}

/* Add-row: translucent wash so it reads as a placeholder, not a data row */
.nc-timeline-add-row::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--nc-bg-default);
  opacity: 0.2;
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

/* Hide native scrollbar — used on per-group bodies in grouped mode where the
   shared scrollbar lives on the top date header. */
.nc-timeline-no-scrollbar {
  scrollbar-width: none;
}
.nc-timeline-no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
