<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
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

const today = dayjs()

// Column width based on zoom
const colWidth = computed(() => {
  return props.zoomLevel === 'week' ? 120 : 40
})

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 56
const SIDEBAR_WIDTH = 200

// Get primary display value for a row
const getRowTitle = (row: RowType) => {
  if (!meta.value?.columns) return 'Untitled'
  const primaryCol = meta.value.columns.find((col) => col.pv)
  if (!primaryCol) return 'Untitled'
  return row.row?.[primaryCol.title!] || 'Untitled'
}

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

// Total grid width
const gridWidth = computed(() => {
  return props.visibleDates.length * colWidth.value
})

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
  <div class="flex h-full overflow-hidden">
    <!-- Left sidebar: record names -->
    <div
      class="flex-shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto"
      :style="{ width: `${SIDEBAR_WIDTH}px` }"
    >
      <!-- Sidebar header -->
      <div
        class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-3 flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
        :style="{ height: `${HEADER_HEIGHT}px` }"
      >
        Records
      </div>
      <!-- Record labels -->
      <div
        v-for="(record, idx) in records"
        :key="idx"
        class="px-3 border-b border-gray-100 flex items-center text-sm text-gray-700 truncate cursor-pointer hover:bg-gray-100"
        :style="{ height: `${ROW_HEIGHT}px` }"
        @click="emit('expandRecord', record)"
      >
        <span class="truncate">{{ getRowTitle(record) }}</span>
      </div>
      <!-- Empty state -->
      <div v-if="!records.length" class="px-3 py-8 text-center text-xs text-gray-400">
        No records to display
      </div>
    </div>

    <!-- Right area: timeline grid -->
    <div class="flex-1 overflow-auto relative">
      <!-- Date header -->
      <div class="sticky top-0 z-10 flex bg-white border-b border-gray-200" :style="{ width: `${gridWidth}px` }">
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

      <!-- Grid body with bars -->
      <div class="relative" :style="{ width: `${gridWidth}px` }">
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
            height: `${Math.max(records.length * ROW_HEIGHT, 400)}px`,
          }"
        />

        <!-- Row bands + bars -->
        <div
          v-for="(record, rowIdx) in records"
          :key="rowIdx"
          class="relative border-b border-gray-50"
          :style="{ height: `${ROW_HEIGHT}px` }"
        >
          <!-- Hover background -->
          <div class="absolute inset-0 hover:bg-blue-50/30 transition-colors" />

          <!-- Bar -->
          <div
            v-if="getBarStyle(record)"
            class="absolute top-1 rounded-md cursor-pointer flex items-center px-2 text-xs font-medium shadow-sm transition-all hover:shadow-md hover:brightness-95 select-none"
            :style="{
              ...getBarStyle(record),
              height: `${ROW_HEIGHT - 8}px`,
              backgroundColor: getBarColor(rowIdx).bg,
              borderLeft: `3px solid ${getBarColor(rowIdx).border}`,
              color: getBarColor(rowIdx).text,
            }"
            @click="emit('expandRecord', record)"
          >
            <span class="truncate">{{ getRowTitle(record) }}</span>
          </div>
        </div>

        <!-- Empty state grid filler -->
        <div
          v-if="!records.length"
          class="flex items-center justify-center text-gray-400 text-sm"
          :style="{ height: '200px' }"
        >
          No records in this time period
        </div>
      </div>
    </div>
  </div>
</template>
