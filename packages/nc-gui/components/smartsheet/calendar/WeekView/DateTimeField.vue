<script lang="ts" setup>
import dayjs from 'dayjs'
import type { Row } from '~/lib/types'

const emits = defineEmits(['expandRecord', 'newRecord'])

const {
  selectedDateRange,
  formattedData,
  formattedSideBarData,
  calendarRange,
  selectedDate,
  displayField,
  viewMetaProperties,
  selectedTime,
  updateRowProperty,
  sideBarFilterOption,
  showSideMenu,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const container = ref<null | HTMLElement>(null)

const scrollContainer = ref<null | HTMLElement>(null)

const { width: containerWidth } = useElementSize(container)

const isPublic = inject(IsPublicInj, ref(false))

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

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

const getDayIndex = (date: dayjs.Dayjs) => {
  let dayIndex = date.day() - 1
  if (dayIndex === -1) {
    dayIndex = 6
  }
  return dayIndex
}

const maxVisibleDays = computed(() => {
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

const currTime = ref(dayjs())

const overlayStyle = computed(() => {
  if (!containerWidth.value)
    return {
      top: 0,
      left: 0,
    }

  const left = (containerWidth.value / maxVisibleDays.value) * getDayIndex(currTime.value)
  const minutes = currTime.value.hour() * 60 + currTime.value.minute()

  const top = (52 / 60) * minutes - 12

  return {
    width: `${containerWidth.value / maxVisibleDays.value}px`,
    top: `${top}px`,
    left: `${left}px`,
  }
})

onMounted(() => {
  const intervalId = setInterval(() => {
    currTime.value = dayjs()
  }, 10000) // 10000 ms = 10 seconds

  // Clean up the interval when the component is unmounted
  onUnmounted(() => {
    clearInterval(intervalId)
  })
})

// Since it is a datetime Week view, we need to create a 2D array of dayjs objects to represent the hours in a day for each day in the week
const datesHours = computed(() => {
  const start = dayjs(selectedDateRange.value.start).startOf('week')
  return Array.from({ length: maxVisibleDays.value }, (_, i) =>
    Array.from({ length: 24 }, (_, h) => start.add(i, 'day').hour(h).minute(0).second(0)),
  )
})

const calculateHourIndices = (dayIndex: number, startDate: dayjs.Dayjs, endDate: dayjs.Dayjs) => {
  // Get the hour component for start and end times
  const startHour = startDate.hour()
  const endHour = endDate.hour()

  // Find the indices directly based on hours since datesHours uses integer hours
  const startHourIndex = Math.max(
    (datesHours.value[dayIndex] ?? []).findIndex((h) => h.hour() === startHour),
    0,
  )

  // For end hour, we need to handle cases where the end time has minutes
  let endHourIndex = (datesHours.value[dayIndex] ?? []).findIndex((h) => h.hour() === endHour)

  // If we have minutes in the end time, we should include the next hour
  if (endDate.minute() > 0 && endHour < 23) {
    endHourIndex++
  }

  endHourIndex = Math.max(endHourIndex, 0)

  return {
    startHourIndex,
    endHourIndex,
    startMinutes: startDate.minute(),
    endMinutes: endDate.minute(),
  }
}

const calculateNewDates = useMemoize(
  ({
    startDate,
    endDate,
    scheduleStart,
    scheduleEnd,
  }: {
    startDate: dayjs.Dayjs
    endDate: dayjs.Dayjs
    scheduleStart: dayjs.Dayjs
    scheduleEnd: dayjs.Dayjs
  }) => {
    // If the end date is not valid, we set it to 15 minutes after the start date
    if (!endDate?.isValid()) {
      endDate = startDate.clone().add(15, 'minutes')
    }

    if (endDate.diff(startDate, 'minute') <= 60) {
      endDate = startDate.clone().add(59, 'minutes')
    }

    // If the start date is before the start of the schedule, we set it to the start of the schedule
    // If the end date is after the end of the schedule, we set it to the end of the schedule
    // This is to ensure that the records are within the bounds of the schedule and do not overflow
    if (startDate.isBefore(scheduleStart, 'minutes')) {
      startDate = scheduleStart.clone()
    }
    if (endDate.isAfter(scheduleEnd, 'minutes')) {
      endDate = scheduleEnd.clone()
    }

    return { startDate, endDate }
  },
)

const getGridTime = (date: dayjs.Dayjs, round = false) => {
  const minutes = date.hour() * 60 + date.minute()
  return round ? Math.ceil(minutes) : Math.floor(minutes)
}

const getGridTimeSlots = (from: dayjs.Dayjs, to: dayjs.Dayjs) => ({
  from: getGridTime(from),
  to: getGridTime(to, true) - 1,
  dayIndex: getDayIndex(from),
})

const hasSlotForRecord = (
  columnArray: Row[],
  dates: {
    fromDate: dayjs.Dayjs
    toDate: dayjs.Dayjs
  },
) => {
  const { fromDate, toDate } = dates

  if (!fromDate || !toDate) return false

  for (const column of columnArray) {
    const columnFromCol = column.rowMeta.range?.fk_from_col
    const columnToCol = column.rowMeta.range?.fk_to_col

    if (!columnFromCol) return false

    const { startDate: columnFromDate, endDate: columnToDate } = calculateNewDates({
      startDate: dayjs(column.row[columnFromCol.title!]),
      endDate: columnToCol
        ? dayjs(column.row[columnToCol.title!])
        : dayjs(column.row[columnFromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
      scheduleStart: dayjs(selectedDateRange.value.start).startOf('day'),
      scheduleEnd: dayjs(selectedDateRange.value.end).endOf('day'),
    })

    if (
      fromDate.isBetween(columnFromDate, columnToDate, null, '[]') ||
      toDate.isBetween(columnFromDate, columnToDate, null, '[]')
    ) {
      return false
    }
  }
  return true
}

const getMaxOverlaps = ({
  row,
  columnArray,
  graph,
}: {
  row: Row
  columnArray: Array<Array<Array<Row>>>
  graph: Map<string, Set<string>>
}) => {
  const id = row.rowMeta.id as string

  const visited: Set<string> = new Set()

  const dayIndex = row.rowMeta.dayIndex
  const overlapIndex = columnArray[dayIndex].findIndex((column) => column.findIndex((r) => r.rowMeta.id === id) !== -1) + 1
  const dfs = (id: string): number => {
    visited.add(id)
    let maxOverlaps = 1
    const neighbors = graph.get(id)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (maxOverlaps >= columnArray[dayIndex].length) return maxOverlaps
        if (!visited.has(neighbor)) {
          maxOverlaps = Math.min(Math.max(maxOverlaps, dfs(neighbor) + 1), columnArray[dayIndex].length)
        }
      }
    }

    return maxOverlaps
  }

  let maxOverlaps = 1
  if (graph.has(id)) {
    dfs(id)
  }
  const overlapIterations: Array<number> = []

  columnArray[dayIndex]
    .flat()
    .filter((record) => visited.has(record.rowMeta.id!))
    .forEach((record) => {
      overlapIterations.push(record.rowMeta.overLapIteration!)
    })

  maxOverlaps = overlapIterations?.length > 0 ? Math.max(...overlapIterations) : 1

  return { maxOverlaps, dayIndex, overlapIndex }
}

const resizeInProgress = ref(false)

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const hoverRecord = ref<string | null>()

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>(null)

const isDragging = ref(false)

const dragRecord = ref<Row | null>(null)

const recordsAcrossAllRange = computed<{
  records: Array<Row>
  gridTimeMap: Map<
    number,
    Map<
      number,
      {
        count: number
        id: string[]
      }
    >
  >
  spanningRecords: Row[]
}>(() => {
  if (!formattedData.value || !calendarRange.value || !container.value || !scrollContainer.value)
    return {
      records: [],
      gridTimeMap: new Map(),
      spanningRecords: [],
    }
  const perWidth = containerWidth.value / maxVisibleDays.value
  const perHeight = 52

  const scheduleStart = dayjs(selectedDateRange.value.start).startOf('day')
  let scheduleEnd = dayjs(selectedDateRange.value.end).endOf('day')

  if (maxVisibleDays.value === 5) {
    scheduleEnd = scheduleEnd.subtract(2, 'day')
  }

  const columnArray: Array<Array<Array<Row>>> = [[[]]]
  const gridTimeMap = new Map<
    number,
    Map<
      number,
      {
        count: number
        id: string[]
      }
    >
  >()
  const recordsToDisplay: Array<Row> = []
  const recordSpanningDays: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col

    // We fetch all the records that match the calendar ranges in a single time.
    // But not all fetched records are valid for the certain range, so we filter them out & sort them
    const sortedFormattedData = [...formattedData.value]
      .filter((record) => {
        if (fromCol && toCol) {
          const fromDate = dayjs(record.row[fromCol.title!])
          const toDate = dayjs(record.row[toCol.title!])

          if (fromDate.isValid() && toDate.isValid()) {
            const isMultiDay = !fromDate.isSame(toDate, 'day')
            if (isMultiDay) {
              recordSpanningDays.push(record)
              return false
            }
            return true
          }
        }
        return fromCol && !!record.row[fromCol.title!]
      })
      .sort((a, b) => (dayjs(a.row[fromCol!.title!]).isBefore(dayjs(b.row[fromCol!.title!])) ? 1 : -1))

    for (const record of sortedFormattedData) {
      const id = record.rowMeta.id ?? generateRandomNumber()

      if (fromCol && toCol) {
        const { startDate, endDate } = calculateNewDates({
          startDate: dayjs(record.row[fromCol.title!]),
          endDate: dayjs(record.row[toCol.title!]),
          scheduleStart,
          scheduleEnd,
        })
        const dayIndex = getDayIndex(startDate)

        const { startHourIndex, startMinutes } = calculateHourIndices(dayIndex, startDate, endDate)

        let style: Partial<CSSStyleDeclaration> = {}

        const top = (startHourIndex + startMinutes / 60) * perHeight

        const totalHours = endDate.diff(startDate, 'minute') / 60
        const height = totalHours * perHeight

        style = {
          ...style,
          top: `${top}px`,
          height: `${height}px`,
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            id,
            style,
            range,
            position: 'rounded',
            dayIndex,
          },
        })
      } else if (fromCol) {
        // If there is no toColumn chosen in the range
        const { startDate } = calculateNewDates({
          startDate: dayjs(record.row[fromCol.title!]),
          endDate: dayjs(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
          scheduleStart,
          scheduleEnd,
        })

        let style: Partial<CSSStyleDeclaration> = {}

        const dayIndex = getDayIndex(startDate)

        const minutes = (startDate.minute() / 60 + startDate.hour()) * perHeight

        style = {
          ...style,
          top: `${minutes + 1}px`,
          height: `${perHeight - 2}px`,
        }

        recordsToDisplay.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            id,
            position: 'rounded',
            style,
            range,
            dayIndex,
          },
        })
      }
    }

    recordsToDisplay.sort((a, b) => {
      const fromColA = a.rowMeta.range?.fk_from_col
      const fromColB = b.rowMeta.range?.fk_from_col
      if (!fromColA || !fromColB) return 0
      return dayjs(a.row[fromColA.title!]).isBefore(dayjs(b.row[fromColB.title!])) ? -1 : 1
    })

    for (const record of recordsToDisplay) {
      const fromCol = record.rowMeta.range?.fk_from_col
      const toCol = record.rowMeta.range?.fk_to_col

      if (!fromCol) continue
      const { startDate, endDate } = calculateNewDates({
        startDate: dayjs(record.row[fromCol.title!]),
        endDate: toCol ? dayjs(record.row[toCol.title!]) : dayjs(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
        scheduleStart,
        scheduleEnd,
      })

      const gridTimes = getGridTimeSlots(startDate, endDate)

      const dayIndex = record.rowMeta.dayIndex ?? gridTimes.dayIndex

      for (let gridCounter = gridTimes.from; gridCounter <= gridTimes.to; gridCounter++) {
        if (!gridTimeMap.has(dayIndex)) {
          gridTimeMap.set(
            dayIndex,
            new Map<
              number,
              {
                count: number
                id: string[]
              }
            >(),
          )
        }

        if (!gridTimeMap.get(dayIndex)?.has(gridCounter)) {
          gridTimeMap.set(dayIndex, (gridTimeMap.get(dayIndex) ?? new Map()).set(gridCounter, { count: 0, id: [] }))
        }

        const idArray = gridTimeMap.get(dayIndex)!.get(gridCounter)!.id
        idArray.push(record.rowMeta.id!)
        const count = gridTimeMap.get(dayIndex)!.get(gridCounter)!.count + 1

        gridTimeMap.set(dayIndex, (gridTimeMap.get(dayIndex) ?? new Map()).set(gridCounter, { count, id: idArray }))
      }

      let foundAColumn = false

      if (!columnArray[dayIndex]) {
        columnArray[dayIndex] = []
      }

      for (const column in columnArray[dayIndex]) {
        if (hasSlotForRecord(columnArray[dayIndex][column], { fromDate: startDate, toDate: endDate })) {
          columnArray[dayIndex][column].push(record)
          foundAColumn = true
          break
        }
      }

      if (!foundAColumn) {
        columnArray[dayIndex].push([record])
      }
    }

    const graph: Map<number, Map<string, Set<string>>> = new Map()

    for (const dayIndex of gridTimeMap.keys()) {
      if (!graph.has(dayIndex)) {
        graph.set(dayIndex, new Map())
      }
      for (const [_gridTime, { id: ids }] of gridTimeMap.get(dayIndex)) {
        for (const id1 of ids) {
          if (!graph.get(dayIndex).has(id1)) {
            graph.get(dayIndex).set(id1, new Set())
          }
          for (const id2 of ids) {
            if (id1 !== id2) {
              if (!graph.get(dayIndex).get(id1).has(id2)) {
                graph.get(dayIndex).get(id1).add(id2)
              }
            }
          }
        }
      }
    }

    for (const dayIndex in columnArray) {
      for (const columnIndex in columnArray[dayIndex]) {
        for (const record of columnArray[dayIndex][columnIndex]) {
          record.rowMeta.overLapIteration = parseInt(columnIndex) + 1
        }
      }
    }
    for (const record of recordsToDisplay) {
      const {
        maxOverlaps,
        overlapIndex,
        dayIndex: tDayIndex,
      } = getMaxOverlaps({
        row: record,
        columnArray,
        graph: graph.get(record.rowMeta.dayIndex!) ?? new Map(),
      })

      const dayIndex = record.rowMeta.dayIndex ?? tDayIndex

      let display = 'block'

      if (maxVisibleDays.value === 5) {
        if (dayIndex === 5 || dayIndex === 6) {
          display = 'none'
        }
      }

      record.rowMeta.numberOfOverlaps = maxOverlaps

      let width = 0
      let left = 100

      const majorLeft = dayIndex * perWidth

      const isRecordDraggingOrResizeState =
        record.rowMeta.id === dragRecord.value?.rowMeta.id || record.rowMeta.id === resizeRecord.value?.rowMeta.id

      if (!isRecordDraggingOrResizeState) {
        if (record.rowMeta.overLapIteration! - 1 > 2) {
          display = 'none'
        } else {
          width = 100 / Math.min(maxOverlaps, 3) / maxVisibleDays.value

          left = width * (overlapIndex - 1)

          width = Math.max((width / 100) * containerWidth.value + 1, 72) - 3

          left = majorLeft + (left / 100) * containerWidth.value + 1.5

          if (majorLeft + perWidth < left + width) {
            left = majorLeft + (perWidth - width) - 4.5 * overlapIndex
          }
        }
      } else {
        left = majorLeft + 1.5
        width = perWidth - 3
      }

      record.rowMeta.style = {
        ...record.rowMeta.style,
        left: `${left}px`,
        width: `${width}px`,
        minWidth: '72px',
        display,
      }
    }
  })

  return {
    records: recordsToDisplay,
    gridTimeMap,
    spanningRecords: recordSpanningDays,
  }
})

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !resizeRecord.value || !scrollContainer.value) return
  if (resizeRecord.value.rowMeta.range?.is_readonly) return

  const { width, left, top, bottom } = container.value.getBoundingClientRect()
  const { scrollHeight, scrollTop } = container.value

  // If the mouse is near the bottom of the container, we scroll down
  // If the mouse is near the top of the container, we scroll up  if (event.clientY > bottom - 20) {
  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  const percentX = (event.clientX - left - window.scrollX) / width
  const percentY = (event.clientY - top + scrollTop) / scrollHeight

  const { range } = resizeRecord.value.rowMeta
  const fromCol = range?.fk_from_col
  const toCol = range?.fk_to_col
  if (!fromCol?.title || !toCol?.title) return

  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title])
  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title])

  const day = Math.floor(percentX * maxVisibleDays.value)
  const minutes = Math.round((percentY * 24 * 60) / 15) * 15 // Round to nearest 15 minutes

  const baseDate = dayjs(selectedDateRange.value.start).add(day, 'day').add(minutes, 'minute')

  let newDate: dayjs.Dayjs
  let updateProperty: string
  let isValid = true

  if (resizeDirection.value === 'right') {
    const minEndDate = ogStartDate.add(1, 'hour')
    newDate = baseDate.isBefore(ogStartDate)
      ? ogStartDate.add(Math.ceil(ogStartDate.diff(baseDate, 'minute') / 15) * 15, 'minute')
      : baseDate

    if (newDate.isBefore(minEndDate)) {
      newDate = minEndDate
    }
    updateProperty = toCol.title
  } else if (resizeDirection.value === 'left') {
    const minStartDate = ogEndDate.subtract(1, 'hour')
    newDate = baseDate.isAfter(ogEndDate)
      ? ogEndDate.subtract(Math.ceil(baseDate.diff(ogEndDate, 'minute') / 15) * 15, 'minute')
      : baseDate

    if (newDate.isAfter(minStartDate)) {
      newDate = minStartDate
    }
    updateProperty = fromCol.title
  } else {
    isValid = false
  }

  if (!isValid || !newDate.isValid()) return

  const newRow = {
    ...resizeRecord.value,
    row: {
      ...resizeRecord.value.row,
      [updateProperty]: newDate.format(updateFormat.value),
    },
  }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

  formattedData.value = formattedData.value.map((r) => (extractPkFromRow(r.row, meta.value!.columns!) === newPk ? newRow : r))

  useDebouncedRowUpdate(newRow, [updateProperty], false)
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

  if (record.rowMeta.range?.is_readonly) return

  resizeInProgress.value = true
  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

// We calculate the new row based on the mouse position and update the record
// We also update the sidebar data if the dropped from the sidebar
const calculateNewRow = (
  event: MouseEvent,
  updateSideBar?: boolean,
): {
  newRow: Row | null
  updatedProperty: string[]
  skipChangeCheck?: boolean
} => {
  if (!container.value) return { newRow: null, updatedProperty: [] }
  const { width, left, top } = container.value.getBoundingClientRect()

  const { scrollHeight, scrollTop } = container.value

  const percentX = (event.clientX - left - window.scrollX) / width
  const percentY = (event.clientY - top + scrollTop - 36.8) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol) return { newRow: null, updatedProperty: [] }

  const day = Math.max(0, Math.min(6, Math.floor(percentX * maxVisibleDays.value)))
  const hour = Math.max(0, Math.min(23, Math.floor(percentY * 24)))

  const minutes = Math.round(((percentY * 24 * 60) % 60) / 15) * 15

  const newStartDate = dayjs(selectedDateRange.value.start).add(day, 'day').add(hour, 'hour').add(minutes, 'minute')
  if (!newStartDate) return { newRow: null, updatedProperty: [] }

  let endDate
  const updatedProperty = [fromCol.title!]

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: dayjs(newStartDate).format(updateFormat.value),
    },
  }

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? dayjs(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!] ? dayjs(dragRecord.value.row[toCol.title!]) : fromDate?.clone()

    if (fromDate && toDate) {
      const newMinutes = Math.round(toDate.diff(fromDate, 'minute') / 15) * 15
      endDate = newStartDate.add(newMinutes, 'minute')
    } else if (fromDate && !toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = dayjs(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    if (endDate.isBefore(newStartDate)) {
      endDate = newStartDate.clone().add(15, 'minutes')
    }

    newRow.row[toCol.title!] = dayjs(endDate).format(updateFormat.value)
    updatedProperty.push(toCol.title!)
  }

  if (!newRow) return { newRow: null, updatedProperty: [] }

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

  if (updateSideBar) {
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })
  } else {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk === newPk ? newRow : r
    })
    dragRecord.value = {
      ...dragRecord.value,
      row: newRow.row,
    }
  }

  return { newRow, updatedProperty }
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !scrollContainer.value || !dragRecord.value) return

  const containerRect = scrollContainer.value.getBoundingClientRect()
  const scrollBottomThreshold = 20

  if (event.clientY > containerRect.bottom - scrollBottomThreshold) {
    scrollContainer.value.scrollTop += 20
  } else if (event.clientY < containerRect.top + scrollBottomThreshold) {
    scrollContainer.value.scrollTop -= 20
  }

  calculateNewRow(event)
}

const stopDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !isDragging.value || !container.value || !dragRecord.value) return

  event.preventDefault()
  clearTimeout(dragTimeout.value!)

  const { newRow, updatedProperty } = calculateNewRow(event, false, true)

  if (newRow) {
    updateRowProperty(newRow, updatedProperty, false)
  }

  dragRecord.value = null

  $e('c:calendar:week:drag-record')

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (resizeInProgress.value) return
  let target = event.target as HTMLElement

  isDragging.value = false

  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    if (record.rowMeta.range?.is_readonly) return

    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    isDragging.value = true
    dragRecord.value = record

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }, 200)

  const onMouseUp = () => {
    clearTimeout(dragTimeout.value!)
    document.removeEventListener('mouseup', onMouseUp)
    if (!isDragging.value) {
      emits('expandRecord', record)
    }
  }

  document.addEventListener('mouseup', onMouseUp)
}

const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value) return
  event.preventDefault()

  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
    }: {
      record: Row
    } = JSON.parse(data)

    if (record.rowMeta.range?.is_readonly) return

    dragRecord.value = record

    const { newRow, updatedProperty } = calculateNewRow(event, true)

    if (newRow) {
      updateRowProperty(newRow, updatedProperty, false)
      $e('c:calendar:day:drag-record')
    }
  }
}

const viewMore = (hour: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedHours'
  selectedTime.value = hour
  showSideMenu.value = true
}

const isOverflowAcrossHourRange = (hour: dayjs.Dayjs) => {
  if (!recordsAcrossAllRange.value || !recordsAcrossAllRange.value.gridTimeMap) return { isOverflow: false, overflowCount: 0 }
  const { gridTimeMap } = recordsAcrossAllRange.value
  const dayIndex = getDayIndex(hour)
  const startMinute = hour.hour() * 60 + hour.minute()
  const endMinute = hour.hour() * 60 + hour.minute() + 59
  let overflowCount = 0

  for (let minute = startMinute; minute <= endMinute; minute++) {
    const recordCount = gridTimeMap.get(dayIndex)?.get(minute)?.count ?? 0
    overflowCount = Math.max(overflowCount, recordCount)
  }

  return { isOverflow: overflowCount - 3 > 0, overflowCount: overflowCount - 3 }
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

watch(
  () => recordsAcrossAllRange.value,
  () => {
    if (dragRecord.value) return
    const records = document.querySelectorAll('.draggable-record')
    if (records.length) records.item(0)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else document.querySelectorAll('.nc-calendar-day-hour').item(9)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  },
  { immediate: true },
)

const expandRecord = (record: Row) => {
  emits('expandRecord', record)
}

const spanningRecordsContainer = ref<HTMLElement | null>(null)

const isExpanded = ref(false)

const isRangeEnabled = computed(() =>
  calendarRange.value.some((range) => range.fk_to_col !== null && range.fk_to_col !== undefined),
)

watch(
  () => spanningRecordsContainer.value?.isSpanningRecordExpanded(),
  () => {
    isExpanded.value = spanningRecordsContainer.value?.isSpanningRecordExpanded()
  },
)
</script>

<template>
  <div
    ref="scrollContainer"
    class="prevent-select h-[calc(100vh-5.4rem)] overflow-y-auto nc-scrollbar-md relative flex flex-col w-full"
    data-testid="nc-calendar-week-view"
    @drop="dropEvent"
  >
    <div
      v-if="!isPublic && dayjs().isBetween(selectedDateRange.start, selectedDateRange.end)"
      class="absolute top-16 ml-16 pointer-events-none z-2"
      :class="{
        '!mt-38.5': isExpanded && isRangeEnabled,
        'mt-27': !isExpanded && isRangeEnabled,
        '!mt-6': !recordsAcrossAllRange.spanningRecords?.length,
      }"
      :style="overlayStyle"
    >
      <div class="flex w-full items-center">
        <span
          class="text-brand-500 rounded-md text-xs border-1 pointer-events-auto px-0.5 border-brand-200 cursor-pointer bg-brand-50"
          @click="addRecord(dayjs())"
        >
          {{ currTime.format('hh:mm A') }}
        </span>
        <div class="flex-1 border-b-1 border-brand-500"></div>
      </div>
    </div>
    <div class="flex sticky h-6 z-4 top-0 pl-16 bg-gray-50 w-full">
      <div
        v-for="date in datesHours"
        :key="date[0].toISOString()"
        :class="{
          'text-brand-500': date[0].isSame(dayjs(), 'date'),
          'w-1/5': maxVisibleDays === 5,
          'w-1/7': maxVisibleDays === 7,
        }"
        class="text-center text-[10px] font-semibold leading-4 flex items-center justify-center uppercase text-gray-500 w-full py-1 border-gray-200 last:border-r-0 border-b-1 border-l-1 border-r-0 bg-gray-50"
      >
        {{ dayjs(date[0]).format('DD ddd') }}
      </div>
    </div>
    <div
      :class="{
        'top-20.5': !isExpanded && isRangeEnabled,
        'top-32': isExpanded && isRangeEnabled,
        '!top-0': !recordsAcrossAllRange.spanningRecords?.length,
      }"
      class="absolute bg-white w-16 z-1"
    >
      <div
        v-for="(hour, index) in datesHours[0]"
        :key="index"
        class="h-13 first:mt-0 pt-7.1 nc-calendar-day-hour text-right pr-2 font-semibold text-xs text-gray-500 py-1"
      >
        {{ hour.format('hh a') }}
      </div>
    </div>
    <div
      v-if="isRangeEnabled && recordsAcrossAllRange.spanningRecords?.length"
      class="sticky top-6 bg-white z-4 inset-x-0 w-full"
    >
      <SmartsheetCalendarDateTimeSpanningContainer
        ref="spanningRecordsContainer"
        :records="recordsAcrossAllRange.spanningRecords"
        @expand-record="expandRecord"
      />
    </div>
    <div
      ref="container"
      :class="{
        'mt-20.5 ': !isExpanded && isRangeEnabled,
        'mt-32': isExpanded && isRangeEnabled,
        '!mt-0': !recordsAcrossAllRange.spanningRecords?.length,
      }"
      class="absolute ml-16 flex w-[calc(100%-64px)]"
    >
      <div
        v-for="(date, index) in datesHours"
        :key="index"
        :class="{
          'w-1/5': maxVisibleDays === 5,
          'w-1/7': maxVisibleDays === 7,
        }"
        class="h-full mt-5.95"
        data-testid="nc-calendar-week-day"
      >
        <div
          v-for="(hour, hourIndex) in date"
          :key="hourIndex"
          :class="{
            'border-1 !border-brand-500 !bg-gray-100':
              hour.isSame(selectedTime, 'hour') && (hour.get('day') === 6 || hour.get('day') === 0),
            'selected-hour': hour.isSame(selectedTime, 'hour'),
            'bg-gray-50 hover:bg-gray-100': hour.get('day') === 0 || hour.get('day') === 6,
            'hover:bg-gray-50': hour.get('day') !== 0 && hour.get('day') !== 6,
          }"
          class="text-center relative transition h-13 text-sm text-gray-500 w-full py-1 border-transparent border-1 border-x-gray-100 border-t-gray-100 border-l-gray-200"
          data-testid="nc-calendar-week-hour"
          @dblclick="addRecord(hour)"
          @click="
            () => {
              selectedDate = hour
              selectedTime = hour
              dragRecord = null
            }
          "
        >
          <NcButton
            v-if="isOverflowAcrossHourRange(hour).isOverflow"
            v-e="`['c:calendar:week-view-more']`"
            class="!absolute bottom-1 text-center w-15 ml-auto inset-x-0 z-3 text-gray-500"
            size="xxsmall"
            type="secondary"
            @click="viewMore(hour)"
          >
            <span class="text-xs">
              +
              {{ isOverflowAcrossHourRange(hour).overflowCount }}
              more
            </span>
          </NcButton>
        </div>
      </div>

      <div
        class="absolute pointer-events-none z-2 inset-0 overflow-hidden !mt-5.95"
        data-testid="nc-calendar-week-record-container"
      >
        <template v-for="record in recordsAcrossAllRange.records" :key="record.rowMeta.id">
          <div
            v-if="record.rowMeta.style?.display !== 'none'"
            :data-testid="`nc-calendar-week-record-${record.row[displayField!.title!]}`"
            :data-unique-id="record.rowMeta!.id"
            :style="{
              ...record.rowMeta.style,
              lineHeight: '18px',
              opacity:
                (dragRecord === null || record.rowMeta.id === dragRecord?.rowMeta.id) &&
                (resizeRecord === null || record.rowMeta.id === resizeRecord?.rowMeta.id)
                  ? 1
                  : 0.3,
            }"
            :class="{
              'w-1/5': maxVisibleDays === 5,
              'w-1/7': maxVisibleDays === 7,
            }"
            class="absolute transition draggable-record group cursor-pointer pointer-events-auto"
            @mousedown.stop="dragStart($event, record)"
            @mouseleave="hoverRecord = null"
            @mouseover="hoverRecord = record.rowMeta.id"
            @dragover.prevent
          >
            <LazySmartsheetRow :row="record">
              <LazySmartsheetCalendarVRecordCard
                :hover="hoverRecord === record.rowMeta.id"
                :position="record.rowMeta!.position"
                :dragging="record.rowMeta.id === dragRecord?.rowMeta?.id || resizeRecord?.rowMeta.id === record.rowMeta.id"
                :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
                :record="record"
                :selected="record.rowMeta!.id === dragRecord?.rowMeta?.id"
                @resize-start="onResizeStart"
              >
                <template v-for="(field, id) in fields" :key="id">
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
                <template #time>
                  <div class="text-xs font-medium text-gray-400">
                    {{ dayjs(record.row[record.rowMeta.range?.fk_from_col!.title!]).format('h:mm a') }}
                  </div>
                </template>
              </LazySmartsheetCalendarVRecordCard>
            </LazySmartsheetRow>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.prevent-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.selected-hour {
  @apply relative;
  &:after {
    @apply rounded-sm pointer-events-none absolute inset-0 w-full h-full;
    content: '';
    z-index: 1;
    box-shadow: 0 0 0 2px #3366ff !important;
  }
}
</style>
