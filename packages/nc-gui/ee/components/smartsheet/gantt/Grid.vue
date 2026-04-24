<!--
  TEMPORARY CLONE — duplicated from Timeline on 2026-04-24.
  Rename pass: timeline → gantt. To be consolidated into components/smartsheet/shared/
  once Gantt is feature-frozen.
  Bug-fix discipline: until then, any fix applied here MUST be double-applied to the
  Timeline counterpart (and vice versa). See plan.md Phase 4 "Consolidation pass".
-->
<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  records: RowType[]
  visibleDates: dayjs.Dayjs[]
  ganttRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    fk_dependency_col?: ColumnType | null
    dependency_direction?: 'predecessor' | 'successor'
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

const { isUIAllowed } = useRoles()

const { isAllowed } = usePermissions()

const { $e } = useNuxtApp()

const { updateRowProperty, updateFormat, dependencyLinks, unlinkDependency, linkDependency } =
  useGanttViewStoreOrThrow()

const { t } = useI18n()

// Visible fields from the Fields menu (injected by parent Smartsheet/shared-view)
const fields = inject(FieldsInj, ref())

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
const SIDEBAR_WIDTH = 240

const meta = inject(MetaInj, ref())

const primaryField = computed(() => {
  const cols = meta.value?.columns ?? []
  return cols.find((c) => c.pv) ?? cols.find((c) => !!c.title)
})

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

  const range = props.ganttRange[0]
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
  useDebouncedRowUpdate(resizeRecord.value, updateProperty, false)
}

const onResizeEnd = () => {
  $e('c:gantt:resize-record')
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
  return isUIAllowed('dataEdit') && !props.ganttRange[0]?.is_readonly
})

// Field-level edit permission for start date column
const canEditFromCol = computed(() => {
  const col = props.ganttRange[0]?.fk_from_col
  if (!col?.id) return true
  return isAllowed(PermissionEntity.FIELD, col.id, PermissionKey.RECORD_FIELD_EDIT)
})

// Field-level edit permission for end date column
const canEditToCol = computed(() => {
  const col = props.ganttRange[0]?.fk_to_col
  if (!col?.id) return true
  return isAllowed(PermissionEntity.FIELD, col.id, PermissionKey.RECORD_FIELD_EDIT)
})

// Can drag (move) a bar — requires edit permission on ALL date columns used
const canDrag = computed(() => {
  if (!isRangeEditable.value) return false
  if (!canEditFromCol.value) return false
  if (props.ganttRange[0]?.fk_to_col && !canEditToCol.value) return false
  return true
})

// Can resize left handle (start date)
const canResizeLeft = computed(() => isRangeEditable.value && canEditFromCol.value)

// Can resize right handle (end date)
const canResizeRight = computed(() => {
  if (!isRangeEditable.value) return false
  return props.ganttRange[0]?.fk_to_col ? canEditToCol.value : canEditFromCol.value
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

  const range = props.ganttRange[0]
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

  useDebouncedRowUpdate(dragRecord.value, updateProperty, false)
}

const onDragEnd = () => {
  $e('c:gantt:drag-record')
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
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
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

// Gantt layout: one row per record, including records whose bars are
// off-screen or records without dates at all. Sorted by start date, with
// date-less records appended at the end — matches Airtable's Gantt record
// list which shows every row regardless of the current date window.
//
// Row order is held stable during an active drag/resize/drag-create. If we
// re-sorted on every frame, the bar the user is physically holding would
// shuffle up/down each time its start-date crossed a neighbour's — the Airtable
// Gantt keeps the dragged bar in its original row and only reseats it on drop.
const stableRowOrder = ref<Array<{ record: RowType; colorIndex: number }>>([])

watchEffect(() => {
  if (isInteracting.value) return

  const range = props.ganttRange[0]
  if (!range) {
    stableRowOrder.value = []
    return
  }

  const sorted = [...props.records].sort((a, b) => {
    const aStart = parseDate(a, range.fk_from_col)
    const bStart = parseDate(b, range.fk_from_col)
    if (!aStart && !bStart) return 0
    if (!aStart) return 1
    if (!bStart) return -1
    return aStart.valueOf() - bStart.valueOf()
  })

  stableRowOrder.value = sorted.map((record, idx) => ({ record, colorIndex: idx }))
})

const swimlanes = computed<Array<Array<{ record: RowType; colorIndex: number }>>>(() =>
  stableRowOrder.value.map((entry) => [entry]),
)

// Get bar position and width for a record
const getBarStyle = (row: RowType) => {
  const range = props.ganttRange[0]
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

// Dependency arrows — SVG step paths from predecessor's bottom-right corner to
// successor's left-center (Airtable Gantt style). Data lives on
// `dependencyLinks` (Map<rowId, linkedRowIds[]>) from the store.
// Direction flips meaning: 'predecessor' = linkedIds are the row's predecessors
// (arrow goes linkedId → row). 'successor' = linkedIds are its successors
// (arrow goes row → linkedId).
const ARROW_HEAD_OFFSET = 2
const BAR_PADDING = 4 // matches the 4px top/bottom inset on bars
const CORNER_RADIUS = 3 // Airtable-style rounded corner
const EXIT_INSET = 10 // how far inside pred's right edge the bottom-drop starts
const MIN_HORIZONTAL = 4 // minimum horizontal segment before arrow tip

function buildArrowPath(
  predRightX: number,
  predIdx: number,
  succLeftX: number,
  succIdx: number,
): string {
  const predBottomY = (predIdx + 1) * ROW_HEIGHT - BAR_PADDING
  const succCenterY = succIdx * ROW_HEIGHT + ROW_HEIGHT / 2
  const tipX = succLeftX - ARROW_HEAD_OFFSET

  // Forward path: drop from inside the predecessor's bottom edge (10px left of
  // its right edge), rounded corner, horizontal to successor's left-middle.
  const preferredExit = predRightX - EXIT_INSET
  const maxExit = tipX - CORNER_RADIUS - MIN_HORIZONTAL
  if (maxExit >= preferredExit - 12) {
    const exitX = Math.min(preferredExit, maxExit)
    return (
      `M ${exitX} ${predBottomY}` +
      ` L ${exitX} ${succCenterY - CORNER_RADIUS}` +
      ` A ${CORNER_RADIUS} ${CORNER_RADIUS} 0 0 0 ${exitX + CORNER_RADIUS} ${succCenterY}` +
      ` L ${tipX} ${succCenterY}`
    )
  }

  const exitX = predRightX - EXIT_INSET

  // Backward / overlapping dep: route out-and-around past the successor's row.
  const midY =
    predIdx < succIdx ? succCenterY + ROW_HEIGHT : succCenterY - ROW_HEIGHT
  const farLeftX = Math.min(succLeftX - 12, exitX - 12)
  return (
    `M ${exitX} ${predBottomY}` +
    ` L ${exitX} ${midY}` +
    ` L ${farLeftX} ${midY}` +
    ` L ${farLeftX} ${succCenterY}` +
    ` L ${tipX} ${succCenterY}`
  )
}

type ArrowPath = { id: string; d: string; rowId: string; linkedId: string }

const arrowPaths = computed<ArrowPath[]>(() => {
  const range = props.ganttRange[0]
  if (!range?.fk_dependency_col) return []
  const links = dependencyLinks?.value
  if (!links || !links.size) return []

  const pkCols = (meta.value?.columns ?? []) as ColumnType[]
  const indexByRowId = new Map<string, number>()
  stableRowOrder.value.forEach((entry, idx) => {
    const id = extractPkFromRow(entry.record.row, pkCols)
    if (id != null) indexByRowId.set(String(id), idx)
  })
  if (!indexByRowId.size) return []

  const direction = range.dependency_direction ?? 'successor'
  const result: ArrowPath[] = []

  links.forEach((linkedIds, rowId) => {
    const rowIdx = indexByRowId.get(rowId)
    if (rowIdx === undefined) return

    for (const linkedId of linkedIds) {
      const linkedIdx = indexByRowId.get(linkedId)
      if (linkedIdx === undefined) continue

      const [predIdx, succIdx] =
        direction === 'predecessor' ? [linkedIdx, rowIdx] : [rowIdx, linkedIdx]

      const predBar = getBarStyle(stableRowOrder.value[predIdx]!.record)
      const succBar = getBarStyle(stableRowOrder.value[succIdx]!.record)
      if (!predBar || !succBar) continue

      const predLeft = parseFloat(predBar.left)
      const predWidth = parseFloat(predBar.width)
      const succLeft = parseFloat(succBar.left)

      const predRightX = predLeft + predWidth
      const succLeftX = succLeft

      result.push({
        id: `${rowId}-${linkedId}`,
        rowId,
        linkedId,
        d: buildArrowPath(predRightX, predIdx, succLeftX, succIdx),
      })
    }
  })

  return result
})

// Selection + delete interaction for dependency arrows
const selectedArrowId = ref<string | null>(null)
const canEditDeps = computed(() => !props.ganttRange[0]?.is_readonly && isUIAllowed('dataEdit'))

const selectArrow = (id: string, event?: MouseEvent) => {
  if (!canEditDeps.value) return
  event?.stopPropagation()
  selectedArrowId.value = id
}

const deselectArrow = () => {
  selectedArrowId.value = null
}

const handleArrowDelete = async () => {
  const id = selectedArrowId.value
  if (!id) return
  const arrow = arrowPaths.value.find((a) => a.id === id)
  if (!arrow) return

  selectedArrowId.value = null
  try {
    await unlinkDependency(arrow.rowId, arrow.linkedId)
    $e('a:gantt:dep-unlink')
    const msg = message.info({
      content: () =>
        h('span', { class: 'flex items-center gap-3' }, [
          t('msg.dependencyRemoved'),
          h(
            'button',
            {
              class: 'underline text-nc-content-brand',
              onClick: async () => {
                msg()
                try {
                  await linkDependency(arrow.rowId, arrow.linkedId)
                  $e('a:gantt:dep-unlink-undo')
                } catch (e: any) {
                  message.error(await extractSdkResponseErrorMsg(e))
                }
              },
            },
            t('general.undo'),
          ),
        ]),
      duration: 5,
    })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onKeyStroke(['Delete', 'Backspace'], (event) => {
  if (!selectedArrowId.value) return
  const target = event.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
  if (target?.isContentEditable) return
  event.preventDefault()
  handleArrowDelete()
})

onKeyStroke('Escape', () => {
  if (linkCreationDrag.value) cancelLinkCreation()
  if (selectedArrowId.value) deselectArrow()
})

// Drag-to-create link from a bar's dependency handle to another bar.
// Coordinates are in bodyScrollRef content space (not viewport), so they match
// the SVG arrow overlay's coordinate system.
interface LinkDragState {
  fromRecord: RowType
  fromId: string
  startX: number
  startY: number
  currentX: number
  currentY: number
  hoveredRecord: RowType | null
  hoveredId: string | null
}
const linkCreationDrag = ref<LinkDragState | null>(null)

const _eventToContentCoords = (event: MouseEvent) => {
  const container = bodyScrollRef.value
  if (!container) return null
  const rect = container.getBoundingClientRect()
  return {
    x: event.clientX - rect.left + container.scrollLeft,
    y: event.clientY - rect.top + container.scrollTop,
  }
}

const onHandleMouseDown = (event: MouseEvent, record: RowType) => {
  if (event.button !== 0) return
  if (!canEditDeps.value) return
  event.stopPropagation()
  event.preventDefault()

  const pkCols = (meta.value?.columns ?? []) as ColumnType[]
  const fromId = extractPkFromRow(record.row, pkCols)
  if (fromId == null) return

  const coords = _eventToContentCoords(event)
  if (!coords) return

  linkCreationDrag.value = {
    fromRecord: record,
    fromId: String(fromId),
    startX: coords.x,
    startY: coords.y,
    currentX: coords.x,
    currentY: coords.y,
    hoveredRecord: null,
    hoveredId: null,
  }

  document.addEventListener('mousemove', onHandleDragMove)
  document.addEventListener('mouseup', onHandleDragEnd, { once: true })
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'grabbing'
}

const onHandleDragMove = (event: MouseEvent) => {
  const state = linkCreationDrag.value
  if (!state) return
  const coords = _eventToContentCoords(event)
  if (!coords) return

  state.currentX = coords.x
  state.currentY = coords.y

  // Resolve hovered bar from DOM under cursor. Walk through elementsFromPoint
  // because the SVG overlay sits on top and would otherwise mask the bar.
  const elements = document.elementsFromPoint(event.clientX, event.clientY)
  const barEl = elements.find((el) =>
    (el as HTMLElement).dataset?.testid === 'nc-gantt-bar',
  ) as HTMLElement | undefined

  if (!barEl) {
    state.hoveredRecord = null
    state.hoveredId = null
    return
  }

  const laneIdx = parseInt(barEl.getAttribute('data-lane') ?? '-1', 10)
  const barIdx = parseInt(barEl.getAttribute('data-bar') ?? '-1', 10)
  const lane = swimlanes.value[laneIdx]
  const hit = lane?.[barIdx]?.record
  if (!hit || hit === state.fromRecord) {
    state.hoveredRecord = null
    state.hoveredId = null
    return
  }

  const pkCols = (meta.value?.columns ?? []) as ColumnType[]
  const hoveredId = extractPkFromRow(hit.row, pkCols)
  state.hoveredRecord = hit
  state.hoveredId = hoveredId != null ? String(hoveredId) : null
}

const cancelLinkCreation = () => {
  linkCreationDrag.value = null
  document.removeEventListener('mousemove', onHandleDragMove)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const onHandleDragEnd = async (_event: MouseEvent) => {
  const state = linkCreationDrag.value
  cancelLinkCreation()
  if (!state) return

  const toId = state.hoveredId
  if (!toId || toId === state.fromId) return

  // Skip if link already exists (either direction).
  const existing = dependencyLinks.value.get(state.fromId) ?? []
  if (existing.includes(toId)) return

  try {
    await linkDependency(state.fromId, toId)
    $e('a:gantt:dep-link-create')
    message.success(t('msg.dependencyCreated'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

onBeforeUnmount(() => {
  if (linkCreationDrag.value) cancelLinkCreation()
  document.removeEventListener('mouseup', onHandleDragEnd)
})

const arrowSvgHeight = computed(() => Math.max(stableRowOrder.value.length * ROW_HEIGHT, ROW_HEIGHT))

// L-shaped preview path for drag-to-link: drop straight down from the handle
// start, rounded corner, horizontal to the cursor. Mirrors the connector style.
// Falls back to a sharp-corner L if the cursor doesn't leave enough room for
// the arc (e.g. dragging upward or leftward).
const linkDragPreviewPath = computed(() => {
  const state = linkCreationDrag.value
  if (!state) return ''
  const R = CORNER_RADIUS
  const { startX, startY, currentX, currentY } = state
  const dx = currentX - startX
  const dy = currentY - startY
  if (dx > R + 1 && dy > R + 1) {
    return (
      `M ${startX} ${startY}` +
      ` L ${startX} ${currentY - R}` +
      ` A ${R} ${R} 0 0 0 ${startX + R} ${currentY}` +
      ` L ${currentX} ${currentY}`
    )
  }
  // Fallback: sharp corner (handles backward / upward drags)
  return `M ${startX} ${startY} L ${startX} ${currentY} L ${currentX} ${currentY}`
})

// #11: Build tooltip text for a record bar — improved format with em-dash and year
const getBarTooltip = (row: RowType) => {
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
  if (!range) return false
  const startDate = parseDate(row, range.fk_from_col)
  if (!startDate) return false
  const firstVisibleDate = props.visibleDates[0]
  if (!firstVisibleDate) return false
  return !startDate.isBefore(firstVisibleDate, 'day')
}

// Check if record's end date is visible (not clamped to after the viewport)
const isEndVisible = (row: RowType) => {
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
  if (!range) return null
  return parseDate(row, range.fk_from_col)
}

const getRecordEndDate = (row: RowType) => {
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
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
  const range = props.ganttRange[0]
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
  // Any mousedown on the grid body that isn't on the arrow hit path clears the
  // arrow selection. Using mousedown (not click) so the deselect happens
  // before any subsequent drag handlers capture the pointer.
  const clickedArrow = (event.target as HTMLElement | null)?.closest?.('.nc-gantt-arrow-hit')
  if (selectedArrowId.value && !clickedArrow) deselectArrow()

  if (!isUIAllowed('dataEdit')) return
  if (!gridBodyRef.value) return
  // Only left mouse button
  if (event.button !== 0) return
  // Don't start drag-to-create if clicking on a bar
  const target = event.target as HTMLElement
  if (
    target.closest('.nc-gantt-bar') ||
    target.closest('.nc-gantt-resize-handle') ||
    target.closest('.nc-gantt-nav-arrow') ||
    target.closest('.nc-gantt-nav-btn')
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

// Sync horizontal scroll between header and body, and vertical scroll with sidebar
const headerScrollRef = ref<HTMLElement | null>(null)
const bodyScrollRef = ref<HTMLElement | null>(null)
const sidebarScrollRef = ref<HTMLElement | null>(null)

const onBodyScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft
  }
  if (sidebarScrollRef.value && sidebarScrollRef.value.scrollTop !== target.scrollTop) {
    sidebarScrollRef.value.scrollTop = target.scrollTop
  }
}

const onSidebarScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (bodyScrollRef.value && bodyScrollRef.value.scrollTop !== target.scrollTop) {
    bodyScrollRef.value.scrollTop = target.scrollTop
  }
}

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
    class="relative flex overflow-hidden"
    :class="{ 'h-full flex-row': !hideHeader, 'flex-col': hideHeader }"
    :style="{
      minHeight: (hasRecordsBefore || hasRecordsAfter) && !swimlanes.length ? `${ROW_HEIGHT}px` : undefined,
      height: groupedGridHeight,
    }"
  >
    <!-- Left record-list sidebar — only in flat (non-grouped) mode -->
    <div
      v-if="!hideHeader"
      class="nc-gantt-sidebar flex flex-col flex-shrink-0 border-r border-nc-border-gray-medium bg-nc-bg-default"
      :style="{ width: `${SIDEBAR_WIDTH}px` }"
      data-testid="nc-gantt-sidebar"
    >
      <div
        class="flex items-center px-3 text-xs font-medium text-nc-content-gray-muted border-b border-nc-border-gray-medium flex-shrink-0"
        :style="{ height: `${HEADER_HEIGHT + 1}px` }"
      >
        {{ primaryField?.title || $t('labels.name') }}
      </div>
      <div
        ref="sidebarScrollRef"
        class="flex-1 overflow-y-auto overflow-x-hidden"
        @scroll="onSidebarScroll"
      >
        <div
          v-for="(lane, laneIdx) in swimlanes"
          :key="laneIdx"
          class="flex items-center px-3 border-b border-nc-border-gray-light text-xs text-nc-content-gray truncate cursor-pointer hover:bg-nc-bg-gray-extralight"
          :style="{ height: `${ROW_HEIGHT}px` }"
          :title="primaryField ? lane[0].record.row[primaryField.title!] ?? '' : ''"
          @click="emit('expandRecord', lane[0].record)"
        >
          <span class="truncate">
            {{ primaryField ? lane[0].record.row[primaryField.title!] ?? '' : '' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Main pane: date header + scrollable grid body -->
    <div class="flex flex-col flex-1 min-w-0 overflow-hidden">
    <!-- Date column headers (hidden when parent provides a shared header) -->
    <div v-if="!hideHeader" ref="gridContainerRef" class="flex-shrink-0 overflow-hidden">
      <div ref="headerScrollRef" class="overflow-x-hidden" @mousemove="onHeaderMouseMove" @mouseleave="onGridMouseLeave">
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
              'nc-gantt-header-hover': hoverColIndex === dateIdx && !isToday(date),
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
              {{
                zoomLevel === 'month'
                  ? date.format('dd').charAt(0)
                  : zoomLevel === 'week'
                  ? date.format('ddd')
                  : date.format('dddd')
              }}
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
      :class="hideHeader ? 'overflow-hidden' : 'flex-1 min-h-0 overflow-auto'"
      @scroll="onBodyScroll"
      @mousemove="onGridMouseMove"
      @mouseleave="onGridMouseLeave"
    >
      <div class="relative" :style="{ width: needsHorizontalScroll ? `${totalGridWidth}px` : '100%', minHeight: '100%' }">
        <!-- Background layer: grid lines, weekend shading, today line — fills full height -->
        <div class="absolute inset-0 pointer-events-none" style="z-index: 0">
          <!-- Weekend backgrounds -->
          <div
            v-for="(date, dateIdx) in visibleDates"
            :key="`bg-${date.format('YYYY-MM-DD')}`"
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
            :key="`line-${date.format('YYYY-MM-DD')}`"
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
          <!-- Hover date column highlight -->
          <div
            v-if="hoverColIndex !== null && !dragCreateActive"
            class="absolute top-0 bottom-0 nc-gantt-content-hover pointer-events-none"
            :style="{ left: `${hoverColIndex * colWidth}px`, width: `${colWidth}px` }"
          />
        </div>

        <!-- Dependency arrows layer — raised above the bar content layer so hit
             paths can receive clicks (the grid body otherwise absorbs them).
             SVG itself is pointer-events: none; only the hit paths re-enable
             pointer-events below. Arrows drawn 2px short of bar edges so they
             still read as terminating at the bar. -->
        <svg
          v-if="arrowPaths.length || linkCreationDrag"
          class="absolute inset-0 pointer-events-none"
          style="z-index: 3"
          :width="totalGridWidth"
          :height="arrowSvgHeight"
          :viewBox="`0 0 ${totalGridWidth} ${arrowSvgHeight}`"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker
              id="nc-gantt-arrow-head"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--nc-content-gray-muted, #6a7184)" />
            </marker>
            <marker
              id="nc-gantt-arrow-head-selected"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 Z" fill="var(--nc-content-red-dark, #b91c1c)" />
            </marker>
          </defs>
          <g v-for="arrow in arrowPaths" :key="arrow.id">
            <!-- Transparent wide hit target for click selection. Uses
                 pointer-events="stroke" so the invisible stroke still catches
                 clicks, re-enabling hit-testing over the SVG's inherited
                 pointer-events: none. -->
            <path
              v-if="canEditDeps"
              :d="arrow.d"
              fill="none"
              stroke="transparent"
              stroke-width="12"
              pointer-events="stroke"
              class="nc-gantt-arrow-hit cursor-pointer"
              @click="selectArrow(arrow.id, $event)"
            />
            <!-- Visible arrow -->
            <path
              :d="arrow.d"
              fill="none"
              :stroke="
                selectedArrowId === arrow.id
                  ? 'var(--nc-content-red-dark, #b91c1c)'
                  : 'var(--nc-content-gray-muted, #6a7184)'
              "
              :stroke-width="selectedArrowId === arrow.id ? 2 : 1.25"
              stroke-linejoin="round"
              class="pointer-events-none"
              :marker-end="
                selectedArrowId === arrow.id
                  ? 'url(#nc-gantt-arrow-head-selected)'
                  : 'url(#nc-gantt-arrow-head)'
              "
            />
          </g>
          <!-- Drag preview path while the user drags from a handle. L-shaped
               like the existing connectors (drop-then-arc-then-horizontal).
               Brand-coloured when hovering a valid target, neutral otherwise. -->
          <path
            v-if="linkCreationDrag"
            :d="linkDragPreviewPath"
            fill="none"
            :stroke="
              linkCreationDrag.hoveredId
                ? 'var(--nc-content-brand, #3366ff)'
                : 'var(--nc-content-gray-muted, #6a7184)'
            "
            stroke-width="1.5"
            stroke-dasharray="5 3"
            stroke-linejoin="round"
            class="pointer-events-none"
          />
        </svg>

        <!-- Content layer: bars and empty state. Intentionally no z-index —
             creating a stacking context here would trap the dep handles
             underneath the SVG (z-index 3). Handles set their own z-index:4
             to sit above the arrow SVG while bars stack naturally below it. -->
        <div ref="gridBodyRef" class="relative w-full" @mousedown="onGridBodyMouseDown">
          <!-- Swimlane rows -->
          <div
            v-for="(lane, laneIdx) in swimlanes"
            :key="laneIdx"
            class="relative border-b border-nc-border-gray-light"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <!-- Hover background -->
            <div class="absolute inset-0 nc-gantt-row-hover transition-colors" />

            <!-- Bars in this lane (skip records without valid dates — sidebar still shows them) -->
            <template v-for="({ record, colorIndex }, barIdx) in lane" :key="colorIndex">
            <NcTooltip
              v-if="getBarStyle(record)"
              :disabled="isInteracting"
              placement="top"
              class="absolute top-1"
              :style="getBarStyle(record)"
            >
              <template #title>
                <span class="text-xs font-semibold">{{ getBarTooltip(record) }}</span>
              </template>
              <div
                class="nc-gantt-bar border-1 flex items-center text-xs font-normal transition-shadow select-none group peer w-full relative overflow-hidden"
                :class="{
                  'cursor-grabbing': dragInProgress && dragRecord === record && canDrag,
                  'cursor-grab': !isInteracting && canDrag,
                  'cursor-pointer hover:shadow-md': !isInteracting && !canDrag,
                  'pointer-events-none opacity-30': isInteracting && interactionRecord !== record,
                  'z-100 shadow-lg': isInteracting && interactionRecord === record,
                  'bg-nc-bg-default border-nc-border-gray-dark text-nc-content-gray':
                    !getRowColorStyle(record).rowBgColor?.backgroundColor,
                  'rounded-l-md': isStartVisible(record),
                  'rounded-r-md': isEndVisible(record),
                }"
                :style="{
                  height: `${ROW_HEIGHT - 8}px`,
                  ...getRowColorStyle(record).rowBgColor,
                }"
                :data-lane="laneIdx"
                :data-bar="barIdx"
                data-testid="nc-gantt-bar"
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
                  :style="
                    getRowColorStyle(record).rowLeftBorderColor?.backgroundColor
                      ? getRowColorStyle(record).rowLeftBorderColor
                      : { backgroundColor: 'var(--color-gray-900, #101015)' }
                  "
                />
                <!-- Left resize handle (start date) — offset past the accent -->
                <div
                  v-if="canResizeLeft"
                  class="nc-gantt-resize-handle nc-gantt-resize-handle--left absolute left-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('left', $event, record)"
                >
                  <div class="nc-gantt-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
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
                  class="nc-gantt-nav-arrow absolute left-0 top-0 h-full z-20 flex items-center"
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
                  v-if="canResizeRight && ganttRange[0]?.fk_to_col"
                  class="nc-gantt-resize-handle nc-gantt-resize-handle--right absolute right-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('right', $event, record)"
                >
                  <div class="nc-gantt-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <!-- Per-bar right nav arrow — when end is clipped -->
                <div
                  v-if="!isEndVisible(record)"
                  class="nc-gantt-nav-arrow absolute right-0 top-0 h-full z-20 flex items-center"
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
              <!-- Dependency handle — sibling to the bar (peer) so it can
                   straddle the bar's bottom-right edge without being clipped
                   by the bar's overflow-hidden. Centered on the connector
                   exit point at (bar_right - EXIT_INSET, bar_bottom). Shows
                   when bar is hovered; grows slightly when handle itself
                   is hovered. Translate + scale live in scoped CSS so we
                   can compose them cleanly. -->
              <div
                v-if="ganttRange[0]?.fk_dependency_col && !isInteracting && canEditDeps"
                class="nc-gantt-dep-handle absolute w-2.5 h-2.5 rounded-full bg-nc-bg-default opacity-0 peer-hover:opacity-100 hover:!opacity-100"
                :class="{
                  '!opacity-100': linkCreationDrag?.fromRecord === record,
                }"
                style="
                  left: calc(100% - 10px);
                  bottom: 0;
                  z-index: 4;
                  border: 1.25px solid var(--nc-content-gray-muted, #6a7184);
                "
                @mousedown="onHandleMouseDown($event, record)"
                @click.stop
              />
            </NcTooltip>
            </template>
          </div>

          <!-- Empty row for inserting a new record (flat mode only) -->
          <!-- Clicks and drags are handled by the parent onGridBodyMouseDown (drag-to-create) -->
          <div
            v-if="!hideHeader && isUIAllowed('dataEdit')"
            class="nc-gantt-add-row relative border-b border-nc-border-gray-light flex items-center cursor-cell transition-colors group"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <div class="flex items-center gap-2 pl-3 text-nc-content-gray-subtle2 group-hover:text-nc-content-gray">
              <GeneralIcon icon="plus" class="w-4 h-4" />
            </div>
          </div>

          <!-- Drag-to-create dotted rectangle -->
          <div
            v-if="dragCreateActive && dragCreateStyle"
            class="absolute nc-gantt-drag-create-rect pointer-events-none"
            :style="dragCreateStyle"
          />

          <!-- #9: Empty state grid filler — using i18n -->
        </div>
      </div>
    </div>
    </div>

    <!-- Grid-level nav arrows — only for fully off-screen records (no bars visible) -->
    <div v-if="hasRecordsBefore" class="absolute left-1 inset-y-0 z-10 flex items-center pointer-events-none">
      <div
        class="nc-gantt-nav-btn flex items-center justify-center w-6 h-6 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors pointer-events-auto"
        data-testid="nc-gantt-nav-prev"
        @click.stop="navigateToPrev"
      >
        <GeneralIcon icon="arrowLeft" class="text-nc-content-gray-muted w-3.5 h-3.5" />
      </div>
    </div>

    <div v-if="hasRecordsAfter" class="absolute right-1 inset-y-0 z-10 flex items-center pointer-events-none">
      <div
        class="nc-gantt-nav-btn flex items-center justify-center w-6 h-6 rounded-full bg-nc-bg-default border border-nc-border-gray-medium shadow-sm cursor-pointer hover:bg-nc-bg-gray-extralight transition-colors pointer-events-auto"
        data-testid="nc-gantt-nav-next"
        @click.stop="navigateToNext"
      >
        <GeneralIcon icon="arrowRight" class="text-nc-content-gray-muted w-3.5 h-3.5" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* Resize handle — cursor + hit area */
.nc-gantt-resize-handle {
  cursor: ew-resize !important;
}

/* Resize handle grip indicator — visible pill that appears on bar hover */
.nc-gantt-resize-grip {
  width: 4px;
  height: 14px;
  background-color: var(--nc-content-gray-muted);
  transition: background-color 0.15s ease;
}

/* Darken the grip on direct handle hover for extra feedback */
.nc-gantt-resize-handle:hover .nc-gantt-resize-grip {
  background-color: var(--nc-content-gray);
}

/* Slightly round inward edge for left handle */
.nc-gantt-resize-handle--left {
  border-radius: 4px 0 0 4px;
}

/* Slightly round inward edge for right handle */
.nc-gantt-resize-handle--right {
  border-radius: 0 4px 4px 0;
}

/* Dependency handle — translate centers it on the connector exit point;
   scale grows it slightly on direct hover (affordance for drag-to-link).
   grab cursor signals draggability; the document cursor flips to grabbing
   while the drag is active. */
.nc-gantt-dep-handle {
  transform: translate(-50%, 50%) scale(1);
  transform-origin: center;
  transition: transform 120ms ease, opacity 120ms ease;
  cursor: grab;
}

.nc-gantt-dep-handle:hover {
  transform: translate(-50%, 50%) scale(1.4);
}

.nc-gantt-dep-handle:active {
  cursor: grabbing;
}

/* Neutral bar shadow matching calendar RecordCard */
.nc-gantt-bar {
  box-shadow: 0px 2px 4px -2px rgba(0, 0, 0, 0.06), 0px 4px 4px -2px rgba(0, 0, 0, 0.02);
}

.nc-gantt-bar:hover {
  box-shadow: 0px 12px 16px -4px rgba(0, 0, 0, 0.1), 0px 4px 6px -2px rgba(0, 0, 0, 0.06);
}

/* Content area column & row highlight on hover — lighter than header */
.nc-gantt-content-hover {
  @apply bg-nc-bg-gray-light/60;
  z-index: 0;
}

.nc-gantt-row-hover:hover {
  @apply bg-nc-bg-gray-light/60;
}

/* Header column highlight on hover */
.nc-gantt-header-hover {
  @apply bg-nc-bg-gray-light/50;
}

/* Add-row: translucent wash so it reads as a placeholder, not a data row */
.nc-gantt-add-row::before {
  content: '';
  position: absolute;
  inset: 0;
  background-color: var(--nc-bg-default);
  opacity: 0.2;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.nc-gantt-add-row:hover::before {
  opacity: 0;
}

.nc-gantt-add-row:hover {
  background-color: var(--nc-bg-gray-extralight);
}

/* Drag-to-create dotted rectangle */
.nc-gantt-drag-create-rect {
  border: 1.5px dashed var(--nc-border-brand);
  border-radius: 6px;
  background-color: var(--nc-bg-brand);
  opacity: 0.15;
  z-index: 10;
}
</style>
