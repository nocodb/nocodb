<script lang="ts" setup>
import dayjs from 'dayjs'
import { type ColumnType, UITypes } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

const emit = defineEmits(['expandRecord', 'newRecord'])

const {
  calDataType,
  selectedDate,
  selectedTime,
  formattedData,
  calendarRange,
  formattedSideBarData,
  updateRowProperty,
  displayField,
  sideBarFilterOption,
  showSideMenu,
  updateFormat,
} = useCalendarViewStoreOrThrow()

const { $e } = useNuxtApp()

const container = ref<null | HTMLElement>(null)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

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

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []
  const _selectedDate = dayjs(selectedDate.value)

  for (let i = 0; i < 24; i++) {
    hours.push(_selectedDate.clone().startOf('day').add(i, 'hour'))
  }
  return hours
})

const currTime = ref(dayjs())

const overlayTop = computed(() => {
  const perRecordHeight = 52

  const minutes = currTime.value.minute() + currTime.value.hour() * 60

  const top = (perRecordHeight / 60) * minutes - 9

  return top
})

const shouldEnableOverlay = computed(() => {
  return !isPublic.value && dayjs().isSame(selectedDate.value, 'day')
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

const calculateNewDates = useMemoize(
  ({
    endDate,
    startDate,
    scheduleStart,
    scheduleEnd,
  }: {
    endDate: dayjs.Dayjs
    startDate: dayjs.Dayjs
    scheduleStart: dayjs.Dayjs
    scheduleEnd: dayjs.Dayjs
  }) => {
    // If there is no end date, we add 15 minutes to the start date and use that as the end date
    if (!endDate.isValid()) {
      endDate = startDate.clone().add(15, 'minutes')
    }

    if (endDate.diff(startDate, 'minute') < 15) {
      endDate = startDate.clone().add(15, 'minutes')
    }

    if (endDate.diff(startDate, 'minute') === 60) {
      endDate = startDate.clone().add(59, 'minutes')
    }

    // If the start date is before the opened date, we use the schedule start as the start date
    // This is to ensure the generated style of the record is not outside the bounds of the calendar
    if (startDate.isSameOrBefore(scheduleStart)) {
      startDate = scheduleStart
    }

    // If the end date is after the schedule end, we use the schedule end as the end date
    // This is to ensure the generated style of the record is not outside the bounds of the calendar
    if (endDate.isAfter(scheduleEnd)) {
      endDate = scheduleEnd
    }

    return { endDate, startDate }
  },
)

const getGridTime = (date: dayjs.Dayjs, round = false) => {
  const gridCalc = date.hour() * 60 + date.minute()
  if (round) {
    return Math.ceil(gridCalc)
  } else {
    return Math.floor(gridCalc)
  }
}

const getGridTimeSlots = (from: dayjs.Dayjs, to: dayjs.Dayjs) => {
  return {
    from: getGridTime(from, false),
    to: getGridTime(to, true) - 1,
  }
}

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
      scheduleStart: dayjs(selectedDate.value).startOf('day'),
      scheduleEnd: dayjs(selectedDate.value).endOf('day'),
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
  columnArray: Array<Array<Row>>
  graph: Map<string, Set<string>>
}) => {
  const visited: Set<string> = new Set()

  const dfs = (id: string): number => {
    visited.add(id)
    let maxOverlaps = 1
    const neighbors = graph.get(id)
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (maxOverlaps >= columnArray.length) return maxOverlaps
        if (!visited.has(neighbor)) {
          maxOverlaps = Math.min(Math.max(maxOverlaps, dfs(neighbor) + 1), columnArray.length)
        }
      }
    }
    return maxOverlaps
  }

  const id = row.rowMeta.id as string
  if (graph.has(id)) {
    dfs(id)
  }

  const overlapIterations: Array<number> = []

  columnArray
    .flat()
    .filter((record) => visited.has(record.rowMeta.id!))
    .forEach((record) => {
      overlapIterations.push(record.rowMeta.overLapIteration!)
    })

  return Math.max(...overlapIterations)
}

const dragRecord = ref<Row | null>(null)

const isDragging = ref(false)

const dragElement = ref<HTMLElement | null>(null)

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>(null)

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const hoverRecord = ref<string | null>(null)

const recordsAcrossAllRange = computed<{
  record: Row[]
  spanningRecords: Row[]
  gridTimeMap: Map<
    number,
    {
      count: number
      id: string[]
    }
  >
}>(() => {
  if (!calendarRange.value || !formattedData.value) return { record: [], count: {} }

  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  const perRecordHeight = 52

  const columnArray: Array<Array<Row>> = [[]]
  const gridTimeMap = new Map<
    number,
    {
      count: number
      id: string[]
    }
  >()

  const recordsByRange: Array<Row> = []
  const recordSpanningDays: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const { fk_from_col: fromCol, fk_to_col: endCol } = range

    // We fetch all the records that match the calendar ranges in a single time.
    // But not all fetched records are valid for the certain range, so we filter them out & sort them
    const sortedFormattedData = [...formattedData.value]
      .filter((record) => {
        const fromDate = fromCol?.title && record.row[fromCol.title] ? dayjs(record.row[fromCol.title]) : null

        if (fromCol && endCol) {
          const toDate = record.row[endCol.title!] ? dayjs(record.row[endCol.title!]) : null

          if (fromDate?.isValid() && toDate?.isValid()) {
            if (!fromDate.isSame(toDate, 'day')) {
              // TODO: If multiple range is introduced, we have to make sure no duplicate records are inserted
              recordSpanningDays.push(record)
              return false
            }
            return fromDate.isSameOrBefore(toDate)
          }
          return true
        }

        return fromCol ? !!fromDate : false
      })
      .sort((a, b) => (dayjs(a.row[fromCol!.title!]).isBefore(dayjs(b.row[fromCol!.title!])) ? 1 : -1))

    for (const record of sortedFormattedData) {
      const id = record.rowMeta.id ?? generateRandomNumber()

      if (fromCol && endCol) {
        const { endDate, startDate } = calculateNewDates({
          endDate: dayjs(record.row[endCol.title!]),
          startDate: dayjs(record.row[fromCol.title!]),
          scheduleStart,
          scheduleEnd,
        })
        // The top of the record is calculated based on the start hour and minute
        const topInPixels = (startDate.minute() / 60 + startDate.hour()) * perRecordHeight

        // A minimum height of 52px is set for each record
        // The height of the record is calculated based on the difference between the start and end date
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 52, perRecordHeight)

        const style: Partial<CSSStyleDeclaration> = {
          height: `${heightInPixels - 2}px`,
          top: `${topInPixels + 1}px`,
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            style,
            id,
            range: range as any,
          },
        })
      } else if (fromCol) {
        const { startDate, endDate } = calculateNewDates({
          startDate: dayjs(record.row[fromCol.title!]),
          endDate: dayjs(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
          scheduleStart,
          scheduleEnd,
        })

        let style: Partial<CSSStyleDeclaration> = {}

        // The top of the record is calculated based on the start hour
        // Update such that it is also based on Minutes
        const topInPixels = (startDate.minute() / 60 + startDate.hour()) * perRecordHeight

        // A minimum height of 80px is set for each record
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 52, perRecordHeight)
        style = {
          ...style,
          top: `${topInPixels + 1}px`,
          height: `${heightInPixels - 2}px`,
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style,
            id,
          },
        })
      }
    }
  })

  recordsByRange.sort((a, b) => {
    const fromColA = a.rowMeta.range?.fk_from_col
    const fromColB = b.rowMeta.range?.fk_from_col
    if (!fromColA || !fromColB) return 0
    return dayjs(a.row[fromColA.title!]).isBefore(dayjs(b.row[fromColB.title!])) ? -1 : 1
  })

  for (const record of recordsByRange) {
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

    for (let gridCounter = gridTimes.from; gridCounter <= gridTimes.to; gridCounter++) {
      if (!gridTimeMap.has(gridCounter)) {
        gridTimeMap.set(gridCounter, {
          count: 1,
          id: [record.rowMeta.id!],
        })
      } else {
        gridTimeMap.set(gridCounter, {
          count: gridTimeMap.get(gridCounter)!.count + 1,
          id: [...gridTimeMap.get(gridCounter)!.id, record.rowMeta.id!],
        })
      }
    }

    let foundAColumn = false

    for (const column in columnArray) {
      if (
        hasSlotForRecord(columnArray[column], {
          fromDate: startDate,
          toDate: endDate,
        })
      ) {
        columnArray[column].push(record)
        foundAColumn = true
        break
      }
    }

    if (!foundAColumn) {
      columnArray.push([record])
    }
  }
  for (const columnIndex in columnArray) {
    for (const record of columnArray[columnIndex]) {
      record.rowMeta.overLapIteration = parseInt(columnIndex) + 1
    }
  }

  const graph = new Map<string, Set<string>>()

  // Build the graph
  for (const [_gridTime, { id: ids }] of gridTimeMap) {
    for (const id1 of ids) {
      if (!graph.has(id1)) {
        graph.set(id1, new Set())
      }
      for (const id2 of ids) {
        if (id1 !== id2) {
          graph.get(id1)!.add(id2)
        }
      }
    }
  }

  for (const record of recordsByRange) {
    const numberOfOverlaps = getMaxOverlaps({
      row: record,
      columnArray,
      graph,
    })

    record.rowMeta.numberOfOverlaps = numberOfOverlaps

    let width
    let left = 100
    let display = 'block'

    const isRecordDraggingOrResizeState =
      record.rowMeta.id === dragRecord.value?.rowMeta.id || record.rowMeta.id === resizeRecord.value?.rowMeta.id

    if (isRecordDraggingOrResizeState) {
      record.rowMeta.style = {
        ...record.rowMeta.style,
        zIndex: 10,
      }
    }

    if (numberOfOverlaps && numberOfOverlaps > 0 && !isRecordDraggingOrResizeState) {
      width = 100 / Math.min(numberOfOverlaps, 8)

      if (record.rowMeta.overLapIteration! - 1 > 7) {
        display = 'none'
      } else {
        left = width * (record.rowMeta.overLapIteration! - 1)
      }
    } else {
      width = 100
      left = 0
    }

    record.rowMeta.style = {
      ...record.rowMeta.style,
      display,
      width: `calc(max(calc(${width.toFixed(2)}% - 4px), 180px))`,
      left: `min(calc(${left.toFixed(2)}% + 4px), calc(100% - max(${width.toFixed(2)}%, 180px) + 4px))`,
      minWidth: '180px',
    }
  }

  return {
    gridTimeMap,
    record: recordsByRange,
    spanningRecords: recordSpanningDays,
  }
})

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

// When the user is dragging a record, we calculate the new start and end date based on the mouse position
const calculateNewRow = (event: MouseEvent, skipChangeCheck?: boolean) => {
  if (!container.value || !dragRecord.value) return { newRow: null, updateProperty: [] }

  const { top } = container.value.getBoundingClientRect()

  const { scrollHeight } = container.value

  // We calculate the percentage of the mouse position in the scroll container
  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = dragRecord.value.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value.rowMeta.range?.fk_to_col

  // We calculate the hour based on the percentage of the mouse position in the scroll container
  // It can be between 0 and 23 (inclusive)
  const hour = Math.max(Math.floor(percentY * 23), 0)
  const minutes = Math.min(Math.max(Math.round(Math.floor((percentY * 23 - hour) * 60) / 15) * 15, 0), 60)
  // We calculate the new startDate by adding the hour to the start of the selected date
  const newStartDate = dayjs(selectedDate.value).startOf('day').add(hour, 'hour').add(minutes, 'minute')
  if (!newStartDate || !fromCol) return { newRow: null, updateProperty: [] }

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

    // If there is an end date, we calculate the new end date based on the new start date and add the difference between the start and end date to the new start date
    if (fromDate && toDate) {
      endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'hour'), 'hour')
    } else if (fromDate && !toDate) {
      // If there is no end date, we set the end date to the end of the day
      endDate = dayjs(newStartDate).endOf('hour')
    } else if (!fromDate && toDate) {
      // If there is no start date, we set the end date to the end of the day
      endDate = dayjs(newStartDate).endOf('hour')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = dayjs(endDate).format(updateFormat.value)

    updateProperty.push(toCol.title!)
  }

  // If from and to columns of the dragRecord and the newRow are the same, we don't manipulate the formattedRecords and formattedSideBarData. This removes unwanted computation
  if (dragRecord.value.row[fromCol.title!] === newRow.row[fromCol.title!] && !skipChangeCheck) {
    return { newRow: null, updateProperty: [] }
  }

  if (!newRow) {
    return { newRow: null, updateProperty: [] }
  }

  // We use the primary key of the new row to find the old row in the formattedData array
  // If the old row is found, we replace it with the new row in the formattedData array
  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  if (dragElement.value) {
    formattedData.value = formattedData.value.map((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk === newPk ? newRow : r
    })
  } else {
    // If the old row is not found, we add the new row to the formattedData array and remove the old row from the formattedSideBarData array
    formattedData.value = [...formattedData.value, newRow]
    formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
      const pk = extractPkFromRow(r.row, meta.value!.columns!)
      return pk !== newPk
    })

    dragRecord.value = {
      ...dragRecord.value,
      row: newRow.row,
    }
  }
  return { newRow, updateProperty }
}

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !resizeRecord.value) return
  if (resizeRecord.value.rowMeta.range?.is_readonly) return

  const { top, bottom } = container.value.getBoundingClientRect()
  const { scrollHeight } = container.value

  // If the mouse position is near the top or bottom of the scroll container, we scroll the container
  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }

  const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col

  if (!fromCol || !toCol) return

  const ogEndDate = dayjs(resizeRecord.value.row[toCol.title!])
  const ogStartDate = dayjs(resizeRecord.value.row[fromCol.title!])

  const minutes = Math.round((percentY * 24 * 60) / 15) * 15 // Round to nearest 15 minutes

  let newRow: Row | null = null
  let updateProperty: string[] = []

  if (resizeDirection.value === 'right') {
    // If the user is resizing the record to the right, we calculate the new end date based on the mouse position
    let newEndDate = dayjs(selectedDate.value).startOf('day').add(minutes, 'minute')

    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we set the new end date to the start date
    // This is to ensure the end date is always same or after the start date
    if (dayjs(newEndDate).isBefore(ogStartDate.add(1, 'hour'))) {
      newEndDate = ogStartDate.clone().add(1, 'hour')
    }

    if (!newEndDate.isValid()) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }
  } else if (resizeDirection.value === 'left') {
    let newStartDate = dayjs(selectedDate.value).startOf('day').add(minutes, 'minute')

    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we set the new start date to the end date
    // This is to ensure the start date is always before or same the end date
    if (dayjs(newStartDate).isAfter(ogEndDate.subtract(1, 'hour'))) {
      newStartDate = dayjs(dayjs(ogEndDate)).clone().add(-1, 'hour')
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }
  }
  if (!newRow) return

  const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)
  formattedData.value = formattedData.value.map((r) => {
    const pk = extractPkFromRow(r.row, meta.value!.columns!)
    return pk === newPk ? newRow : r
  }) as Row[]
  useDebouncedRowUpdate(newRow, updateProperty, false)
}

const onResizeEnd = () => {
  resizeDirection.value = null
  resizeRecord.value = null
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const onResizeStart = (direction: 'right' | 'left', _event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  if (record.rowMeta.range?.is_readonly) return

  resizeDirection.value = direction
  resizeRecord.value = record
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const onDrag = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !dragRecord.value) return
  const { top, bottom } = container.value.getBoundingClientRect()

  if (event.clientY > bottom - 20) {
    container.value.scrollTop += 10
  } else if (event.clientY < top + 20) {
    container.value.scrollTop -= 10
  }
  calculateNewRow(event)
}

const stopDrag = (event: MouseEvent) => {
  event.preventDefault()
  clearTimeout(dragTimeout.value!)
  if (!isUIAllowed('dataEdit') || !isDragging.value || !container.value || !dragRecord.value) return

  const { newRow, updateProperty } = calculateNewRow(event, true)
  if (!newRow && !updateProperty) return

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value = null
  }

  if (dragRecord.value) {
    dragRecord.value = null
  }

  if (!newRow) return
  updateRowProperty(newRow, updateProperty, false)

  $e('c:calendar:day:drag-record')

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  let target = event.target as HTMLElement

  isDragging.value = false

  // We use a timeout to determine if the user is dragging or clicking on the record
  dragTimeout.value = setTimeout(() => {
    if (!isUIAllowed('dataEdit')) return
    if (record.rowMeta.range?.is_readonly) return

    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    dragRecord.value = record
    dragElement.value = target

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

// We support drag and drop from the sidebar to the day view of the date field
const dropEvent = (event: DragEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value) return
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
      isWithoutDates,
    }: {
      record: Row
      initialClickOffsetY: number
      initialClickOffsetX: number
      isWithoutDates: boolean
    } = JSON.parse(data)

    if (record.rowMeta.range?.is_readonly) return

    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) return

    const { top } = container.value.getBoundingClientRect()

    const { scrollHeight } = container.value

    // We calculate the percentage of the mouse position in the scroll container
    const percentY = (event.clientY - top + container.value.scrollTop) / scrollHeight

    const hour = Math.max(Math.floor(percentY * 23), 0)
    const minutes = Math.min(Math.max(Math.round(Math.floor((percentY * 23 - hour) * 60) / 15) * 15, 0), 60)

    const newStartDate = dayjs(selectedDate.value).startOf('day').add(hour, 'hour').add(minutes, 'minute')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
      },
    }

    const updateProperty = [fromCol.title!]

    if (toCol) {
      const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
      const toDate = record.row[toCol.title!] ? dayjs(record.row[toCol.title!]) : null

      if (fromDate && toDate) {
        endDate = dayjs(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = dayjs(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }
      newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')
      updateProperty.push(toCol.title!)
    }

    if (!newRow) return

    const newPk = extractPkFromRow(newRow.row, meta.value!.columns!)

    if (dragElement.value && !isWithoutDates) {
      formattedData.value = formattedData.value.map((r) => {
        const pk = extractPkFromRow(r.row, meta.value!.columns!)
        return pk === newPk ? newRow : r
      })
    } else {
      formattedData.value = [...formattedData.value, newRow]
      if (sideBarFilterOption.value !== 'allRecords') {
        formattedSideBarData.value = formattedSideBarData.value.filter((r) => {
          return extractPkFromRow(r.row, meta.value!.columns!) !== newPk
        })
      }
    }

    if (dragElement.value) {
      dragElement.value.style.boxShadow = 'none'
      dragElement.value = null
    }
    updateRowProperty(newRow, updateProperty, false)
    $e('c:calendar:day:drag-record')
  }
}

const isOverflowAcrossHourRange = (hour: dayjs.Dayjs) => {
  if (!recordsAcrossAllRange.value || !recordsAcrossAllRange.value.gridTimeMap) return { isOverflow: false, overflowCount: 0 }
  const { gridTimeMap } = recordsAcrossAllRange.value
  const startMinute = hour.hour() * 60 + hour.minute()
  const endMinute = hour.hour() * 60 + hour.minute() + 59
  let overflowCount = 0

  for (let minute = startMinute; minute <= endMinute; minute++) {
    const recordCount = gridTimeMap.get(minute)?.count ?? 0
    overflowCount = Math.max(overflowCount, recordCount)
  }

  return { isOverflow: overflowCount - 8 > 0, overflowCount: overflowCount - 8 }
}

const viewMore = (hour: dayjs.Dayjs) => {
  sideBarFilterOption.value = 'selectedHours'
  selectedTime.value = hour
  showSideMenu.value = true
}

const selectHour = (hour: dayjs.Dayjs) => {
  selectedTime.value = hour
  dragRecord.value = null
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const newRecord = (hour: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value?.length) return
  const record = {
    row: {
      [calendarRange.value[0].fk_from_col!.title!]: hour.format('YYYY-MM-DD HH:mm:ssZ'),
    },
  }
  emit('newRecord', record)
}

watch(
  () => recordsAcrossAllRange.value,
  () => {
    setTimeout(() => {
      if (isDragging.value) return
      const records = document.querySelectorAll('.draggable-record')
      if (records.length) records.item(0)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      else document.querySelectorAll('.nc-calendar-day-hour').item(9)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
  },
  { immediate: true },
)

const expandRecord = (record: Row) => {
  emit('expandRecord', record)
}
</script>

<template>
  <div class="h-[calc(100vh-5.3rem)] overflow-y-auto nc-scrollbar-md">
    <SmartsheetCalendarDateTimeSpanningContainer
      v-if="
        calendarRange.some((range) => range.fk_to_col !== null && range.fk_to_col !== undefined) &&
        recordsAcrossAllRange.spanningRecords?.length
      "
      :records="recordsAcrossAllRange.spanningRecords"
      @expand-record="expandRecord"
    />
    <div ref="container" class="w-full flex relative no-selection" data-testid="nc-calendar-day-view" @drop="dropEvent">
      <div
        v-if="shouldEnableOverlay"
        class="absolute ml-2 pointer-events-none w-full z-4"
        :style="{
          top: `${overlayTop}px`,
        }"
      >
        <div class="flex w-full items-center">
          <span
            class="text-brand-500 text-xs rounded-md border-1 pointer-events-auto px-0.5 border-brand-200 cursor-pointer bg-brand-50"
            @click="newRecord(currTime)"
          >
            {{ currTime.format('hh:mm A') }}
          </span>
          <div class="flex-1 border-b-1 border-brand-500"></div>
        </div>
      </div>

      <div>
        <div
          v-for="(hour, index) in hours"
          :key="index"
          class="flex h-13 relative border-1 group hover:bg-gray-50 border-white"
          data-testid="nc-calendar-day-hour"
          @click="selectHour(hour)"
          @dblclick="newRecord(hour)"
        >
          <div class="w-16 border-b-0 pr-2 pl-2 text-right text-xs text-gray-400 font-semibold h-13">
            {{ dayjs(hour).format('hh a') }}
          </div>
        </div>
      </div>
      <div class="w-full">
        <div
          v-for="(hour, index) in hours"
          :key="index"
          :class="{
            'selected-hour': hour.isSame(selectedTime),
          }"
          class="flex w-full border-l-gray-100 h-13 transition nc-calendar-day-hour relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
          data-testid="nc-calendar-day-hour"
          @click="selectHour(hour)"
          @dblclick="newRecord(hour)"
        >
          <NcDropdown
            v-if="calendarRange.length > 1 && !isPublic"
            :class="{
              '!block': hour.isSame(selectedTime),
              '!hidden': !hour.isSame(selectedTime),
            }"
            auto-close
          >
            <NcButton
              class="!group-hover:block mr-12 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
              size="xsmall"
              type="secondary"
            >
              <component :is="iconMap.plus" class="h-4 w-4" />
            </NcButton>
            <template #overlay>
              <NcMenu class="w-64">
                <NcMenuItem> Select date field to add </NcMenuItem>
                <template v-for="(range, calIndex) in calendarRange" :key="calIndex">
                  <NcMenuItem
                    v-if="!range.is_readonly"
                    class="text-gray-800 font-semibold text-sm"
                    @click="
                () => {
                  let record = {
                    row: {
                      [range.fk_from_col!.title!]: hour.format('YYYY-MM-DD HH:mm:ssZ'),
                    },
                  }
                  if (range.fk_to_col) {
                    record = {
                      row: {
                        ...record.row,
                        [range.fk_to_col!.title!]: hour.add(1, 'hour').format('YYYY-MM-DD HH:mm:ssZ'),
                      },
                    }
                  }
                  emit('newRecord', record)
                }
              "
                  >
                    <div class="flex items-center gap-1">
                      <LazySmartsheetHeaderCellIcon :column-meta="range.fk_from_col" />
                      <span class="ml-1">{{ range.fk_from_col!.title! }}</span>
                    </div>
                  </NcMenuItem>
                </template>
              </NcMenu>
            </template>
          </NcDropdown>
          <NcButton
            v-else-if="!isPublic && isUIAllowed('dataEdit') && [UITypes.DateTime, UITypes.Date].includes(calDataType)"
            :class="{
              '!block': hour.isSame(selectedTime),
              '!hidden': !hour.isSame(selectedTime),
            }"
            class="!group-hover:block mr-12 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
            size="xsmall"
            type="secondary"
            @click="
          () => {
            let record = {
              row: {
                [calendarRange[0].fk_from_col!.title!]: hour.format('YYYY-MM-DD HH:mm:ssZ'),
              },
            }

            if (calendarRange[0].fk_to_col) {
              record = {
                row: {
                  ...record.row,
                  [calendarRange[0].fk_to_col!.title!]: hour.add(1, 'hour').format('YYYY-MM-DD HH:mm:ssZ'),
                },
              }
            }
            emit('newRecord', record)
          }
        "
          >
            <component :is="iconMap.plus" class="h-4 w-4" />
          </NcButton>

          <NcButton
            v-if="isOverflowAcrossHourRange(hour).isOverflow"
            v-e="`['c:calendar:week-view-more']`"
            class="!absolute bottom-2 text-center w-15 mx-auto inset-x-0 z-3 text-gray-500"
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
      <div class="absolute inset-0 pointer-events-none">
        <div
          class="relative !ml-[68px] !mr-1 z-2 nc-calendar-day-record-container"
          data-testid="nc-calendar-day-record-container"
        >
          <template v-for="record in recordsAcrossAllRange.record" :key="record.rowMeta.id">
            <div
              v-if="record.rowMeta.style?.display !== 'none'"
              :data-testid="`nc-calendar-day-record-${record.row[displayField!.title!]}`"
              :data-unique-id="record.rowMeta.id"
              :style="{
                ...record.rowMeta.style,
                opacity:
                  (dragRecord === null || record.rowMeta.id === dragRecord?.rowMeta.id) &&
                  (resizeRecord === null || record.rowMeta.id === resizeRecord?.rowMeta.id)
                    ? 1
                    : 0.3,
              }"
              class="absolute draggable-record transition group cursor-pointer pointer-events-auto"
              @mousedown="dragStart($event, record)"
              @mouseleave="hoverRecord = null"
              @mouseover="hoverRecord = record.rowMeta.id as string"
              @dragover.prevent
            >
              <LazySmartsheetRow :row="record">
                <LazySmartsheetCalendarVRecordCard
                  :hover="hoverRecord === record.rowMeta.id"
                  :selected="record.rowMeta.id === dragRecord?.rowMeta?.id"
                  :record="record"
                  :dragging="record.rowMeta.id === dragRecord?.rowMeta?.id || record.rowMeta.id === resizeRecord?.rowMeta?.id"
                  :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
                  @resize-start="onResizeStart"
                >
                  <template v-for="(field, id) in fields" :key="id">
                    <LazySmartsheetPlainCell
                      v-if="!isRowEmpty(record, field!)"
                      v-model="record.row[field!.title!]"
                      class="text-xs font-medium"
                      :bold="getFieldStyle(field).bold"
                      :column="field"
                      :italic="getFieldStyle(field).italic"
                      :underline="getFieldStyle(field).underline"
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
  </div>
</template>

<style lang="scss" scoped>
.no-selection {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  -moz-user-select: none;
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
