<script lang="ts" setup>
import dayjs from 'dayjs'
import { UITypes } from 'nocodb-sdk'

const emit = defineEmits(['newRecord', 'expandRecord'])

const {
  selectedDate,
  selectedMonth,
  formattedData,
  formattedSideBarData,
  calDataType,
  sideBarFilterOption,
  displayField,
  calendarRange,
  viewMetaProperties,
  showSideMenu,
  updateRowProperty,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const isMondayFirst = ref(true)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const maxVisibleDays = computed(() => {
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

const days = computed(() => {
  let days = []

  if (isMondayFirst.value) {
    days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  } else {
    days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  }

  if (maxVisibleDays.value === 5) {
    days = days.filter((day) => day !== 'Sat' && day !== 'Sun')
  }

  return days
})

const calendarGridContainer = ref()

const { width: gridContainerWidth, height: gridContainerHeight } = useElementSize(calendarGridContainer)

const dragElement = ref<HTMLElement | null>(null)

const draggingId = ref<string | null>(null)

const resizeInProgress = ref(false)

const isDragging = ref(false)

const dragRecord = ref<Row | null>(null)

const hoverRecord = ref<string | null>()

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const focusedDate = ref<dayjs.Dayjs | null>(null)

const resizeDirection = ref<'right' | 'left'>()

const resizeRecord = ref<Row | null>(null)

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

const calendarData = computed(() => {
  const startOfMonth = selectedMonth.value.startOf('month')
  const firstDayOffset = isMondayFirst.value ? 0 : -1
  const firstDayToDisplay = startOfMonth.startOf('week').add(firstDayOffset, 'day')
  const today = dayjs()

  const daysInView = Math.min(
    35,
    Math.ceil((startOfMonth.daysInMonth() + startOfMonth.day() + (isMondayFirst.value ? 0 : 1)) / 7) * 7,
  )

  return {
    weeks: Array.from({ length: daysInView / 7 }, (_, weekIndex) => ({
      weekIndex,
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const day = firstDayToDisplay.add(weekIndex * 7 + dayIndex, 'day')

        return {
          date: day,
          key: `${weekIndex}-${dayIndex}`,
          isWeekend: day.get('day') === 0 || day.get('day') === 6,
          isToday: day.isSame(today, 'date'),
          isInPagedMonth: day.isSame(startOfMonth, 'month'),
          isVisible: maxVisibleDays.value === 5 ? day.get('day') !== 0 && day.get('day') !== 6 : true,
          dayNumber: day.format('DD'),
        }
      }),
    })),
    gridClass: {
      'grid-cols-7': maxVisibleDays.value === 7,
      'grid-cols-5': maxVisibleDays.value === 5,
      'grid': true,
      'grow': true,
    },
  }
})

const recordsToDisplay = computed<{
  records: Row[]
  count: { [p: string]: { overflow: boolean; count: number; overflowCount: number } }
}>(() => {
  if (!calendarData.value || !calendarRange.value) return { records: [], count: {} }

  const perWidth = gridContainerWidth.value / maxVisibleDays.value
  const perHeight = gridContainerHeight.value / calendarData.value.weeks.length
  const perRecordHeight = 28

  const spaceBetweenRecords = 27
  const maxLanes = Math.floor((perHeight - spaceBetweenRecords) / (perRecordHeight + 8))

  // Track records and lanes for each day
  const recordsInDay: {
    [key: string]: {
      overflow: boolean
      count: number
      overflowCount: number
      lanes: boolean[]
    }
  } = {}

  const findAvailableLane = (dateKey: string, duration = 1): number => {
    if (!recordsInDay[dateKey]) {
      recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0, lanes: [] }
    }

    const { lanes } = recordsInDay[dateKey]
    for (let i = 0; i < maxLanes; i++) {
      if (!lanes[i]) {
        // Check if the lane is available for the entire duration
        let isAvailable = true
        for (let j = 0; j < duration; j++) {
          const checkDate = dayjs(dateKey).add(j, 'day').format('YYYY-MM-DD')
          if (recordsInDay[checkDate]?.lanes[i]) {
            isAvailable = false
            break
          }
        }
        if (isAvailable) return i
      }
    }
    return -1 // No available lane
  }

  const occupyLane = (dateKey: string, lane: number, duration = 1) => {
    for (let i = 0; i < duration; i++) {
      const occupyDate = dayjs(dateKey).add(i, 'day').format('YYYY-MM-DD')
      if (!recordsInDay[occupyDate]) {
        recordsInDay[occupyDate] = { overflow: false, count: 0, overflowCount: 0, lanes: [] }
      }
      recordsInDay[occupyDate].lanes[lane] = true
      recordsInDay[occupyDate].count++
    }
  }

  const recordsToDisplay: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const startCol = range.fk_from_col
    const endCol = range.fk_to_col

    // Filter out records that don't satisfy the range and sort them by start date
    const sortedFormattedData = [...formattedData.value]
      .filter((record) => {
        if (startCol && endCol) {
          const fromDate = record.row[startCol.title!] ? dayjs(record.row[startCol.title!]) : null
          const toDate = record.row[endCol.title!] ? dayjs(record.row[endCol.title!]) : null
          return fromDate && toDate && !toDate.isBefore(fromDate)
        } else if (startCol && !endCol) {
          const fromDate = record.row[startCol!.title!] ? dayjs(record.row[startCol!.title!]) : null
          return !!fromDate
        }
        return false
      })
      .sort((a, b) => {
        const aStart = dayjs(a.row[startCol.title!])
        const aEnd = endCol ? dayjs(a.row[endCol.title!]) : aStart
        const bStart = dayjs(b.row[startCol.title!])
        const bEnd = endCol ? dayjs(b.row[endCol.title!]) : bStart

        return bEnd.diff(bStart) - aEnd.diff(aStart)
      })

    sortedFormattedData.forEach((record: Row) => {
      if (!endCol && startCol) {
        // If there is no end date, we just display the record on the start date
        const startDate = dayjs(record.row[startCol.title!])
        const dateKey = startDate.format('YYYY-MM-DD')

        const lane = findAvailableLane(dateKey)
        if (lane === -1) {
          recordsInDay[dateKey].overflow = true
          recordsInDay[dateKey].overflowCount++
          return // Skip this record as there's no available lane
        }

        occupyLane(dateKey, lane)

        const weekIndex = calendarData.value.weeks.findIndex((week) =>
          week.days.some((day) => dayjs(day.date).isSame(startDate, 'day')),
        )
        const dayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) => dayjs(day.date).isSame(startDate, 'day'))

        const id = record.rowMeta.id ?? generateRandomNumber()

        const isRecordDraggingOrResizeState = id === draggingId.value || id === resizeRecord.value?.rowMeta.id

        const style: Partial<CSSStyleDeclaration> = {
          left: `${dayIndex * perWidth}px`,
          width: `${perWidth}px`,
          top: isRecordDraggingOrResizeState
            ? `${weekIndex * perHeight}px`
            : `${weekIndex * perHeight + (spaceBetweenRecords + lane * (perRecordHeight + 4))}px`,
        }

        if (isRecordDraggingOrResizeState) {
          style.zIndex = '100'
          style.display = 'block'
        }

        if (maxVisibleDays.value === 5 && (dayIndex === 5 || dayIndex === 6) && !isRecordDraggingOrResizeState) {
          style.display = 'none'
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            style,
            maxSpanning: 1,
            position: 'rounded',
            range,
            id,
          },
        })
      } else if (startCol && endCol) {
        // Multi-day event logic
        let startDate = dayjs(record.row[startCol.title!])
        const endDate = dayjs(record.row[endCol.title!])

        let currentWeekStart = startDate.startOf('week')

        if (startDate.isBefore(currentWeekStart)) {
          startDate = calendarData.value.weeks[0].days[0].date
        }

        const id = record.rowMeta.id ?? generateRandomNumber()
        // Since the records can span multiple weeks, to display, we render multiple elements
        // for each week the record spans. The id is used to identify the elements that belong to the same record
        let recordIndex = 0
        while (
          currentWeekStart.isSameOrBefore(endDate, 'day') &&
          // If the current week start is before the last day of the last week
          currentWeekStart.isBefore(calendarData.value.weeks[calendarData.value.weeks.length - 1].days[6].date)
        ) {
          // We update the record start to currentWeekStart if it is before the start date
          // and record end to currentWeekEnd if it is after the end date
          let currentWeekEnd = currentWeekStart.endOf('week')

          // If the maxVisibleDays is 5, we skip the weekends
          if (maxVisibleDays.value === 5) {
            currentWeekEnd = currentWeekEnd.subtract(2, 'day')
          }

          const recordStart = currentWeekStart.isBefore(startDate) ? startDate : currentWeekStart
          const recordEnd = currentWeekEnd.isAfter(endDate) ? endDate : currentWeekEnd

          if (recordEnd.isBefore(calendarData.value.weeks[0].days[0].date)) {
            currentWeekStart = currentWeekStart.add(1, 'week')
            continue
          }

          const duration = recordEnd.diff(recordStart, 'day') + 1

          const dateKey = recordStart.format('YYYY-MM-DD')
          const lane = findAvailableLane(dateKey, duration)

          if (lane === -1) {
            for (let i = 0; i < duration; i++) {
              const overflowDate = recordStart.add(i, 'day').format('YYYY-MM-DD')
              if (recordsInDay[overflowDate]) {
                recordsInDay[overflowDate].overflow = true
                recordsInDay[overflowDate].overflowCount++
              }
            }
            currentWeekStart = currentWeekStart.add(1, 'week')
            continue
          }

          occupyLane(dateKey, lane, duration)

          const weekIndex = calendarData.value.weeks.findIndex((week) =>
            week.days.some((day) => dayjs(day.date).isSame(recordStart, 'day')),
          )

          const startDayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) =>
            dayjs(day.date).isSame(recordStart, 'day'),
          )

          const endDayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) =>
            dayjs(day.date).isSame(recordEnd, 'day'),
          )

          const isRecordDraggingOrResizeState = id === draggingId.value || id === resizeRecord.value?.rowMeta.id

          const style: Partial<CSSStyleDeclaration> = {
            left: `${startDayIndex * perWidth - 0.5}px`,
            width: `${(endDayIndex - startDayIndex + 1) * perWidth}px`,
            top: isRecordDraggingOrResizeState
              ? `${weekIndex * perHeight + perRecordHeight}px`
              : `${weekIndex * perHeight + (spaceBetweenRecords + lane * (perRecordHeight + 4))}px`,
          }

          if (isRecordDraggingOrResizeState) {
            style.zIndex = '100'
          }

          let position = 'rounded'
          // Here we are checking if the startDay is before all the dates shown in UI rather that the current month

          const isStartMonthBeforeCurrentWeek = calendarData.value.weeks[weekIndex - 1]
            ? dayjs(calendarData.value.weeks[weekIndex - 1].days[0].date).isBefore(recordStart, 'month')
            : false

          if (
            startDate.isSame(currentWeekStart, 'week') &&
            endDate.isSame(currentWeekEnd, 'week') &&
            endDate.isSameOrBefore(currentWeekEnd) // Weekend check
          ) {
            position = 'rounded'
          } else if (startDate.isSame(recordStart, 'week')) {
            if (isStartMonthBeforeCurrentWeek) {
              if (endDate.isSame(currentWeekEnd, 'week')) {
                position = 'rounded'
              } else position = 'leftRounded'
            } else position = 'leftRounded'
          } else if (endDate.isSame(currentWeekEnd, 'week')) {
            position = 'rightRounded'
          } else {
            position = 'none'
          }

          recordsToDisplay.push({
            ...record,
            rowMeta: {
              ...record.rowMeta,
              position,
              style,
              range,
              maxSpanning: endDayIndex - startDayIndex + 1,
              id,
              recordIndex,
            },
          })
          recordIndex++
          currentWeekStart = currentWeekStart.add(1, 'week')
        }
      }
    })
  })

  return {
    records: recordsToDisplay,
    count: recordsInDay,
  }
})

const dragOffset = ref<{
  x: number | null
  y: number | null
}>({ x: null, y: null })

const calculateNewRow = (event: MouseEvent, updateSideBar?: boolean, skipChangeCheck?: boolean) => {
  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  let relativeX = event.clientX - left

  if (dragOffset.value.x) {
    relativeX -= dragOffset.value.x
  }

  const relativeY = event.clientY - top

  const percentX = Math.max(0, Math.min(1, relativeX / width))
  const percentY = Math.max(0, Math.min(1, relativeY / height))

  const fromCol = dragRecord.value?.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value?.rowMeta.range?.fk_to_col

  if (!fromCol) return { newRow: null, updateProperty: [] }

  const week = Math.floor(percentY * calendarData.value.weeks.length)
  const day = Math.floor(percentX * maxVisibleDays.value)

  let newStartDate = calendarData.value.weeks[week] ? dayjs(calendarData.value.weeks[week].days[day].date) : null

  if (!newStartDate) return { newRow: null, updateProperty: [] }

  let fromDate = dayjs(dragRecord.value.row[fromCol.title!])
  if (!fromDate.isValid()) {
    fromDate = dayjs()
  }

  newStartDate = newStartDate.add(fromDate.hour(), 'hour').add(fromDate.minute(), 'minute').add(fromDate.second(), 'second')

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value?.row,
      [fromCol!.title!]: dayjs(newStartDate).format(updateFormat.value),
    },
  }

  const updateProperty = [fromCol!.title!]

  if (toCol) {
    const fromDate = dragRecord.value?.row[fromCol!.title!] ? dayjs(dragRecord.value.row[fromCol!.title!]) : null
    const toDate = dragRecord.value?.row[toCol!.title!] ? dayjs(dragRecord.value?.row[toCol!.title!]) : null

    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol!.title!] = dayjs(endDate).format(updateFormat.value)
    updateProperty.push(toCol!.title!)
  }

  // If from and to columns of the dragRecord and the newRow are the same, we don't manipulate the formattedRecords and formattedSideBarData. This removes unwanted computation
  if (dragRecord.value.row[fromCol.title!] === newRow.row[fromCol.title!] && !skipChangeCheck) {
    return { newRow: null, updatedProperty: [] }
  }

  if (!newRow) return { newRow: null, updateProperty: [] }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

  newRow.rowMeta.id = draggingId?.value

  if (updateSideBar) {
    formattedData.value = [...(formattedData.value as Row[]), newRow as Row]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })
  } else {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk === newPk ? newRow : r
    }) as Row[]
  }

  return {
    newRow,
    updateProperty,
  }
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !dragRecord.value) return

  calculateNewRow(event, false)
}

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !resizeRecord.value) return

  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const percentY = (event.clientY - top - window.scrollY) / height
  const percentX = (event.clientX - left - window.scrollX) / width

  const ogEndDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_to_col!.title!]
  const ogStartDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_from_col!.title!]

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col

  const week = Math.floor(percentY * calendarData.value.weeks.length)
  const day = Math.floor(percentX * maxVisibleDays.value)

  let updateProperty: string[] = []
  let newRow: Row

  if (resizeDirection.value === 'right') {
    let newEndDate = calendarData.value.weeks[week] ? dayjs(calendarData.value.weeks[week].days[day].date).endOf('day') : null
    updateProperty = [toCol!.title!]

    if (dayjs(newEndDate).isBefore(ogStartDate)) {
      newEndDate = dayjs(ogStartDate).clone().endOf('day')
    }

    if (!newEndDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol!.title!]: dayjs(newEndDate).format(updateFormat.value),
      },
    }
  } else {
    let newStartDate = calendarData.value.weeks[week] ? dayjs(calendarData.value.weeks[week].days[day].date) : null
    updateProperty = [fromCol!.title!]

    if (dayjs(newStartDate).isAfter(ogEndDate)) {
      newStartDate = dayjs(ogEndDate).clone()
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol!.title!]: dayjs(newStartDate).format(updateFormat.value),
      },
    }
  }

  newRow.rowMeta.id = resizeRecord.value.rowMeta.id

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)

    return pk === newPk ? newRow : r
  })

  if (newRow) {
    useDebouncedRowUpdate(newRow, updateProperty, false)
  }
}

const onResizeEnd = () => {
  resizeInProgress.value = false
  resizeDirection.value = undefined
  resizeRecord.value = null

  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit') || draggingId.value) return

  if (record.rowMeta.range?.is_readonly) return

  // selectedDate.value = null
  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const stopDrag = (event: MouseEvent) => {
  clearTimeout(dragTimeout.value)
  if (!isUIAllowed('dataEdit') || !dragRecord.value || !isDragging.value) return
  if (dragRecord.value.rowMeta.range?.is_readonly) return

  event.preventDefault()
  dragElement.value!.style.boxShadow = 'none'

  const { newRow, updateProperty } = calculateNewRow(event, false, true)

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    isDragging.value = false
    draggingId.value = null
    dragElement.value = null
  }

  dragRecord.value = null
  updateRowProperty(newRow, updateProperty, false)
  focusedDate.value = null

  dragOffset.value = {
    x: null,
    y: null,
  }

  $e('c:calendar:month:drag-record')

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (resizeInProgress.value || !record.rowMeta.id) return
  let target = event.target as HTMLElement
  isDragging.value = false

  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    if (record.rowMeta.range?.is_readonly) return
    isDragging.value = true

    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    // TODO: @DarkPhoenix2704
    // const initialDragElement = document.querySelector(`[data-unique-id="${record.rowMeta.id}-0"]`)

    // selectedDate.value = null

    isDragging.value = true
    dragElement.value = target
    draggingId.value = record.rowMeta!.id!
    dragRecord.value = record

    dragOffset.value = {
      x: dragRecord.value?.rowMeta.maxSpanning > 1 ? event.clientX - target.getBoundingClientRect().left : 0,
      y: event.clientY,
    }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 500)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value)
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emit('expandRecord', record)
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
      isWithoutDates,
    }: {
      record: Row
      isWithoutDates: boolean
    } = JSON.parse(data)

    if (record.rowMeta.range?.is_readonly) return

    dragRecord.value = record

    const { newRow, updateProperty } = calculateNewRow(event, isWithoutDates)

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
    $e('c:calendar:day:drag-record')
  }
}

const selectDate = (date: dayjs.Dayjs) => {
  dragRecord.value = null
  draggingId.value = null
  resizeRecord.value = null
  resizeInProgress.value = false
  resizeDirection.value = undefined
  focusedDate.value = null
  selectedDate.value = date
}

const viewMore = (date: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedDate' as const
  selectedDate.value = date
  showSideMenu.value = true
}

const isDateSelected = (date: dayjs.Dayjs) => {
  if (!selectedDate.value) return false
  return dayjs(date).isSame(selectedDate.value, 'day')
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
  emit('newRecord', newRecord)
}
</script>

<template>
  <div v-if="calendarRange" class="h-full prevent-select relative" data-testid="nc-calendar-month-view">
    <div
      class="grid"
      :class="{
        'grid-cols-7': maxVisibleDays === 7,
        'grid-cols-5': maxVisibleDays === 5,
      }"
    >
      <div
        v-for="(day, index) in days"
        :key="index"
        class="text-center bg-gray-50 py-1 border-r-1 last:border-r-0 border-gray-100 font-semibold leading-4 uppercase text-[10px] text-gray-500"
      >
        {{ day }}
      </div>
    </div>
    <div
      ref="calendarGridContainer"
      :class="{
        'grid-rows-5': calendarData.weeks.length === 5,
        'grid-rows-6': calendarData.weeks.length === 6,
        'grid-rows-7': calendarData.weeks.length === 7,
      }"
      class="grid"
      style="height: calc(100% - 1.59rem)"
      @drop="dropEvent"
    >
      <div
        v-for="week in calendarData.weeks"
        :key="week.weekIndex"
        :class="calendarData.gridClass"
        data-testid="nc-calendar-month-week"
      >
        <template v-for="(day, i) in week.days">
          <div
            v-if="day.isVisible"
            :key="day.key"
            :class="{
              'selected-date': isDateSelected(day.date) || (focusedDate && dayjs(day.date).isSame(focusedDate, 'day')),
              '!text-gray-400': !day.isInPagedMonth,
              '!bg-gray-50 !hover:bg-gray-100 !border-gray-200': day.isWeekend,
              '!border-r-gray-200': week.days[i + 1]?.isWeekend,
              'border-t-1': week.weekIndex === 0,
            }"
            class="text-right relative group last:border-r-0 transition text-sm h-full border-r-1 border-b-1 border-gray-100 font-medium hover:bg-gray-50 text-gray-800 bg-white"
            data-testid="nc-calendar-month-day"
            @click="selectDate(day.date)"
            @dblclick="addRecord(day.date)"
          >
            <div v-if="isUIAllowed('dataEdit')" class="flex justify-between p-1">
              <span
                :class="{
                  'block group-hover:hidden': !isDateSelected(day.date) && [UITypes.DateTime, UITypes.Date].includes(calDataType),
                  'hidden': isDateSelected(day.date) && [UITypes.DateTime, UITypes.Date].includes(calDataType),
                }"
              ></span>

              <NcDropdown v-if="calendarRange.length > 1" auto-close>
                <NcButton
                  :class="{
                    '!block': isDateSelected(day.date),
                    '!hidden': !isDateSelected(day.date),
                  }"
                  class="!group-hover:block rounded"
                  size="small"
                  type="secondary"
                >
                  <component :is="iconMap.plus" class="h-4 w-4" />
                </NcButton>
                <template #overlay>
                  <NcMenu class="w-64">
                    <NcMenuItem> Select date field to add </NcMenuItem>
                    <NcMenuItem
                      v-for="(range, index) in calendarRange"
                      :key="index"
                      class="text-gray-800 font-semibold text-sm"
                      @click="
                      () => {
                        const record = {
                          row: {
                            [range.fk_from_col!.title!]: (day.date).format('YYYY-MM-DD HH:mm:ssZ'),
                            ...(range.fk_to_col
                        ? {
                            [range.fk_to_col!.title!]: (day.date).endOf('day').format('YYYY-MM-DD HH:mm:ssZ'),
                          }
                        : {}),
                          },
                        }
                        emit('newRecord', record)
                      }
                    "
                    >
                      <div class="flex items-center gap-1">
                        <LazySmartsheetHeaderCellIcon :column-meta="range.fk_from_col" />
                        <span class="ml-1">{{ range.fk_from_col!.title }}</span>
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
              <NcButton
                v-else-if="[UITypes.DateTime, UITypes.Date].includes(calDataType)"
                :class="{
                  '!block': isDateSelected(day.date),
                  '!hidden': !isDateSelected(day.date),
                }"
                class="!group-hover:block !w-6 !h-6 !rounded"
                size="xsmall"
                type="secondary"
                @click="
                () => {
                  const record = {
                    row: {
                      [calendarRange[0].fk_from_col!.title!]: (day.date).format('YYYY-MM-DD HH:mm:ssZ'),
                      ...(calendarRange[0].fk_to_col
                        ? {
                            [calendarRange[0].fk_to_col!.title!]: (day.date).endOf('day').format('YYYY-MM-DD HH:mm:ssZ'),
                          }
                        : {}),
                    },
                  }
                  emit('newRecord', record)
                }
              "
              >
                <component :is="iconMap.plus" />
              </NcButton>
              <span
                :class="{
                  'bg-brand-50 text-brand-500 !font-bold': day.isToday,
                }"
                class="px-1.3 py-1 text-[13px] text-sm leading-3 font-medium rounded-lg"
              >
                {{ day.dayNumber }}
              </span>
            </div>
            <div v-if="!isUIAllowed('dataEdit')" class="leading-3 text-[13px] p-3">{{ day.dayNumber }}</div>

            <NcButton
              v-if="
                recordsToDisplay.count[dayjs(day.date).format('YYYY-MM-DD')] &&
                recordsToDisplay.count[dayjs(day.date).format('YYYY-MM-DD')]?.overflow &&
                !draggingId
              "
              v-e="`['c:calendar:month-view-more']`"
              class="!absolute bottom-1 right-1 text-center min-w-4.5 mx-auto z-3 text-gray-500"
              size="xxsmall"
              type="secondary"
              @click="viewMore(day.date)"
            >
              <span class="text-xs px-1">
                + {{ recordsToDisplay.count[dayjs(day.date).format('YYYY-MM-DD')]?.overflowCount }}
              </span>
            </NcButton>
          </div>
        </template>
      </div>
    </div>
    <div class="absolute inset-0 z-2 pointer-events-none mt-8 pb-7.5" data-testid="nc-calendar-month-record-container">
      <template v-for="record in recordsToDisplay.records">
        <div
          v-if="record.rowMeta.style?.display !== 'none'"
          :key="record.rowMeta.id"
          :data-testid="`nc-calendar-month-record-${record.row[displayField!.title!]}`"
          :data-unique-id="`${record.rowMeta.id}`"
          :style="{
            ...record.rowMeta.style,
            zIndex: record.rowMeta.id === draggingId ? 100 : 0,
            lineHeight: '18px',

            opacity:
              (draggingId === null || record.rowMeta.id === draggingId) &&
              (resizeRecord === null || record.rowMeta.id === resizeRecord?.rowMeta.id)
                ? 1
                : 0.3,
          }"
          :class="{
            'cursor-pointer': !resizeInProgress,
          }"
          class="absolute group draggable-record transition pointer-events-auto"
          @mouseleave="hoverRecord = null"
          @mouseover="hoverRecord = record.rowMeta.id"
          @mousedown.stop="dragStart($event, record)"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :hover="hoverRecord === record.rowMeta.id"
              :position="record.rowMeta.position"
              :record="record"
              :dragging="draggingId === record.rowMeta.id || resizeRecord?.rowMeta?.id === record.rowMeta.id"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              @resize-start="onResizeStart"
            >
              <template v-if="[UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime].includes(calDataType)" #time>
                <span class="text-xs font-medium text-gray-400">
                  {{ dayjs(record.row[record.rowMeta.range?.fk_from_col!.title!]).format('h:mma').slice(0, -1) }}
                </span>
              </template>
              <template v-for="field in fields" :key="field.id">
                <LazySmartsheetPlainCell
                  v-if="!isRowEmpty(record, field!)"
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="fieldStyles[field.id].bold"
                  :column="field"
                  :italic="fieldStyles[field.id].italic"
                  :underline="fieldStyles[field.id].underline"
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
  -webkit-user-select: none; /* Safari */
  -ms-user-select: none; /* IE 10 and IE 11 */
  user-select: none; /* Standard syntax */
}

.grid-cols-5 {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.selected-date {
  @apply relative;
  &:after {
    @apply rounded-sm pointer-events-none absolute inset-0 w-full h-full;
    content: '';
    z-index: 2;
    box-shadow: 0 0 0 2px #3366ff !important;
  }

  &:first-of-type::after {
    @apply left-0.5 w-[calc(100%_-_2px)];
  }
}
</style>
