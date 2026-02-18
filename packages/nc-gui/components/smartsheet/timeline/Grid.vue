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
  zoomLevel: 'week' | 'month'
}>()

const emit = defineEmits<{
  (event: 'expandRecord', row: RowType): void
}>()

const meta = inject(MetaInj, ref())

const { isUIAllowed } = useRoles()

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

const today = dayjs()

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 56

// Measure the grid container to compute dynamic column widths
const gridContainerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(gridContainerRef)

// Column width: fill available space evenly across all visible dates
const colWidth = computed(() => {
  if (!containerWidth.value || !props.visibleDates.length) return 120
  return containerWidth.value / props.visibleDates.length
})

// --- Resize state ---
const resizeInProgress = ref(false)
const resizeDirection = ref<'left' | 'right'>()
const resizeRecord = ref<RowType | null>(null)
const gridBodyRef = ref<HTMLElement | null>(null)

// Flag to suppress the click that fires right after mouseup ends a resize
const justFinishedResize = ref(false)
let resizeCooldownTimer: ReturnType<typeof setTimeout> | null = null

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

  // Build updated row
  const newRow: RowType = {
    ...resizeRecord.value,
    row: { ...resizeRecord.value.row },
  }

  let updateProperty: string[] = []

  if (resizeDirection.value === 'right' && toCol?.title) {
    // Resizing end date
    let newEndDate = newDate.endOf('day')
    // Clamp: end date must not be before start date
    if (newEndDate.isBefore(ogStartDate, 'day')) {
      newEndDate = ogStartDate.clone().endOf('day')
    }
    newRow.row[toCol.title] = isDateOnly
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
    newRow.row[fromCol.title] = isDateOnly
      ? newStartDate.format('YYYY-MM-DD')
      : newStartDate.format(dateFormat)
    updateProperty = [fromCol.title]
  } else {
    return
  }

  // Update store data immediately for visual feedback
  const pk = extractPkFromRow(resizeRecord.value.row, meta.value?.columns as ColumnType[])
  storeFormattedData.value = storeFormattedData.value.map((r) => {
    const rPk = extractPkFromRow(r.row, meta.value?.columns as ColumnType[])
    return rPk === pk ? newRow : r
  })

  // Keep resize record reference updated
  resizeRecord.value = newRow

  // Debounced API update
  useDebouncedRowUpdate(newRow, updateProperty, false)
}

const onResizeEnd = () => {
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

// Clean up listeners and timers on unmount
onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
  if (resizeCooldownTimer) clearTimeout(resizeCooldownTimer)
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

// Build tooltip text for a record bar: "MMM D → MMM D  |  N days"
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

  return `${startDate.format('MMM D')} → ${effectiveEnd.format('MMM D')}  |  ${days} days`
}

// Determine if a date is today
const isToday = (date: dayjs.Dayjs) => {
  return date.isSame(today, 'day')
}

// Determine if a date is a weekend
const isWeekend = (date: dayjs.Dayjs) => {
  return date.day() === 0 || date.day() === 6
}

// Color palette for bars
const barColors = [
  { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF' },
  { bg: '#DCFCE7', border: '#22C55E', text: '#166534' },
  { bg: '#FEF3C7', border: '#F59E0B', text: '#92400E' },
  { bg: '#FCE7F3', border: '#EC4899', text: '#9D174D' },
  { bg: '#E0E7FF', border: '#6366F1', text: '#3730A3' },
  { bg: '#FED7AA', border: '#F97316', text: '#9A3412' },
  { bg: '#CCFBF1', border: '#14B8A6', text: '#115E59' },
  { bg: '#F3E8FF', border: '#A855F7', text: '#6B21A8' },
]

const getBarColor = (index: number) => {
  return barColors[index % barColors.length]
}

// Today indicator position
const todayPosition = computed(() => {
  const firstDate = props.visibleDates[0]
  if (!firstDate) return null
  const offset = today.diff(firstDate, 'day')
  if (offset < 0 || offset >= props.visibleDates.length) return null
  return offset * colWidth.value + colWidth.value / 2
})
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Date column headers -->
    <div ref="gridContainerRef" class="flex-shrink-0 overflow-hidden">
      <div class="flex bg-white border-b border-gray-200 w-full">
        <div
          v-for="(date, idx) in visibleDates"
          :key="idx"
          class="flex-shrink-0 border-r border-gray-100 flex flex-col items-center justify-center"
          :class="{
            'bg-blue-50': isToday(date),
            'bg-gray-50': isWeekend(date) && !isToday(date),
          }"
          :style="{ width: `${colWidth}px`, height: `${HEADER_HEIGHT}px` }"
        >
          <span class="text-[10px] font-medium text-gray-400 uppercase">
            {{ date.format('ddd') }}
          </span>
          <span
            class="text-sm font-semibold"
            :class="{
              'text-blue-600': isToday(date),
              'text-gray-600': !isToday(date),
            }"
          >
            {{ date.format('D') }}
          </span>
          <span v-if="zoomLevel === 'week'" class="text-[10px] text-gray-400">
            {{ date.format('MMM') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Scrollable grid body -->
    <div class="flex-1 min-h-0 overflow-y-auto">
      <div class="overflow-hidden relative">
        <div ref="gridBodyRef" class="relative w-full">
          <!-- Grid lines (vertical) -->
          <div class="absolute inset-0 pointer-events-none">
            <div
              v-for="(date, idx) in visibleDates"
              :key="'line-' + idx"
              class="absolute top-0 bottom-0 border-r"
              :class="{
                'border-gray-100': !isToday(date),
                'border-blue-200': isToday(date),
              }"
              :style="{ left: `${(idx + 1) * colWidth}px` }"
            />
          </div>

          <!-- Today indicator line -->
          <div
            v-if="todayPosition !== null"
            class="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-5"
            :style="{ left: `${todayPosition}px` }"
          />

          <!-- Weekend background -->
          <div
            v-for="(date, idx) in visibleDates"
            :key="'bg-' + idx"
            class="absolute top-0 bottom-0"
            :class="{ 'bg-gray-50/50': isWeekend(date) }"
            :style="{
              left: `${idx * colWidth}px`,
              width: `${colWidth}px`,
              height: `${Math.max(visibleRecords.length * ROW_HEIGHT, 400)}px`,
            }"
          />

          <!-- Row bands + bars -->
          <div
            v-for="(record, rowIdx) in visibleRecords"
            :key="rowIdx"
            class="relative border-b border-gray-50"
            :style="{ height: `${ROW_HEIGHT}px` }"
          >
            <!-- Hover background -->
            <div class="absolute inset-0 hover:bg-blue-50/30 transition-colors" />

            <!-- Bar with resize handles -->
            <NcTooltip
              v-if="getBarStyle(record)"
              :disabled="resizeInProgress"
              placement="top"
              class="absolute top-1"
              :style="getBarStyle(record)"
            >
              <template #title>
                <span class="text-xs font-semibold">{{ getBarTooltip(record) }}</span>
              </template>
              <div
                class="rounded-md flex items-center text-xs font-medium shadow-sm transition-shadow select-none group w-full"
                :class="{
                  'cursor-pointer hover:shadow-md hover:brightness-95': !resizeInProgress,
                  'pointer-events-none opacity-30': resizeInProgress && resizeRecord !== record,
                  'z-20 shadow-md': resizeInProgress && resizeRecord === record,
                }"
                :style="{
                  height: `${ROW_HEIGHT - 8}px`,
                  backgroundColor: getBarColor(rowIdx).bg,
                  borderLeft: `3px solid ${getBarColor(rowIdx).border}`,
                  color: getBarColor(rowIdx).text,
                }"
                @click="!resizeInProgress && !justFinishedResize && emit('expandRecord', record)"
              >
                <!-- Left resize handle (start date) -->
                <div
                  v-if="canResize"
                  class="nc-timeline-resize-handle nc-timeline-resize-handle--left absolute left-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('left', $event, record)"
                >
                  <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                <span class="truncate px-2 inline-flex items-center">
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

                <!-- Right resize handle (end date) — only when end date column exists -->
                <div
                  v-if="canResize && timelineRange[0]?.fk_to_col"
                  class="nc-timeline-resize-handle nc-timeline-resize-handle--right absolute right-0 top-0 w-3 h-full z-10 flex items-center justify-center"
                  @mousedown.stop="onResizeStart('right', $event, record)"
                >
                  <div class="nc-timeline-resize-grip rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </NcTooltip>
          </div>

          <!-- Empty state grid filler -->
          <div
            v-if="!visibleRecords.length"
            class="flex items-center justify-center text-gray-400 text-sm"
            :style="{ height: '200px' }"
          >
            No records in this time period
          </div>
        </div>
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
  background-color: rgba(0, 0, 0, 0.35);
  transition: opacity 0.15s ease, background-color 0.15s ease;
}

/* Darken the grip on direct handle hover for extra feedback */
.nc-timeline-resize-handle:hover .nc-timeline-resize-grip {
  opacity: 1 !important;
  background-color: rgba(0, 0, 0, 0.55);
}

/* Slightly round inward edge for left handle */
.nc-timeline-resize-handle--left {
  border-radius: 4px 0 0 4px;
}

/* Slightly round inward edge for right handle */
.nc-timeline-resize-handle--right {
  border-radius: 0 4px 4px 0;
}
</style>
