<script setup lang="ts">
import dayjs from 'dayjs'
import type { Row } from '#imports'

const props = defineProps<{
  records: Row[]
}>()

const emit = defineEmits(['expandRecord', 'newRecord'])

const container = ref<null | HTMLElement>(null)

const { $e } = useNuxtApp()

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
        top: `${row * 28 + row * 8}px`,
        left: `${startDayIndex * perDayWidth}px`,
        width: `${spanDays * perDayWidth + 8}px`,
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

const onResizeStart = (record: Row, direction: 'right' | 'left') => {
  resizeDirection.value = direction
  resizeRecord.value = record
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

    // document.addEventListener('mousemove', onDrag)
    // document.addEventListener('mouseup', stopDrag)
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
</script>

<template>
  <div style="z-index: 100" class="sticky flex top-0 bg-white border-b-1 border-gray-100 prevent-select">
    <div
      style="width: 64px"
      :style="{
        width: `${activeCalendarView === 'week' ? '64px' : '66px'}`,
      }"
      class="text-xs top-0 text-right z-50 !sticky h-full left-0 text-[#6A7184] p-2"
    >
      All day
    </div>
    <div
      ref="container"
      :style="{
        height: `min(64px)`,
        width: 'calc(100% - 67px)',
      }"
      :class="{
        'border-gray-100': activeCalendarView === 'day',
        'border-gray-200': activeCalendarView === 'week',
      }"
      class="relative border-l-1 z-30 py-1"
    >
      <div class="pointer-events-none inset-y-0 relative">
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
