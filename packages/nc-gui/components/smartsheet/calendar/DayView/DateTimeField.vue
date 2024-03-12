<script lang="ts" setup>
import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { type Row, computed, isPrimary, ref, useViewColumnsOrThrow } from '#imports'
import { generateRandomNumber, isRowEmpty } from '~/utils'

const emit = defineEmits(['expandRecord', 'newRecord'])

const {
  // activeCalendarView,
  selectedDate,
  selectedTime,
  formattedData,
  calendarRange,
  formattedSideBarData,
  updateRowProperty,
  displayField,
  sideBarFilterOption,
  showSideMenu,
} = useCalendarViewStoreOrThrow()

const container = ref<null | HTMLElement>(null)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const fields = inject(FieldsInj, ref())

const { fields: _fields } = useViewColumnsOrThrow()

const getFieldStyle = (field: ColumnType) => {
  if (!_fields.value) return { underline: false, bold: false, italic: false }
  const fi = _fields.value.find((f) => f.title === field.title)

  return {
    underline: fi?.underline,
    bold: fi?.bold,
    italic: fi?.italic,
  }
}

const fieldsWithoutDisplay = computed(() => fields.value?.filter((f) => !isPrimary(f)))

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []
  const _selectedDate = dayjs(selectedDate.value)

  for (let i = 0; i < 24; i++) {
    hours.push(_selectedDate.clone().startOf('day').add(i, 'hour'))
  }
  return hours
})

const calculateNewDates = ({
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
}

/* const getGridTime = (date: dayjs.Dayjs, round = false) => {
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
} */

/* const hasSlotForRecord = (
  record: Row,
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
      endDate: columnToCol ? dayjs(column.row[columnToCol.title!]) : dayjs(column.row[columnFromCol.title!]).add(1, 'hour'),
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
} */

/* const getMaxOfGrid = (
  {
    fromDate,
    toDate,
  }: {
    fromDate: dayjs.Dayjs
    toDate: dayjs.Dayjs
  },
  gridTimeMap: Map<number, number>,
) => {
  let max = 0
  const gridTimes = getGridTimeSlots(fromDate, toDate)

  for (let gridCounter = gridTimes.from; gridCounter <= gridTimes.to; gridCounter++) {
    if (gridTimeMap.has(gridCounter) && gridTimeMap.get(gridCounter) > max) {
      max = gridTimeMap.get(gridCounter)
    }
  }
  return max
} */
/* const isOverlaps = (row1: Row, row2: Row) => {
  const fromCol1 = row1.rowMeta.range?.fk_from_col
  const toCol1 = row1.rowMeta.range?.fk_to_col
  const fromCol2 = row2.rowMeta.range?.fk_from_col
  const toCol2 = row2.rowMeta.range?.fk_to_col

  if (!fromCol1 || !fromCol2) return false

  const { startDate: startDate1, endDate: endDate1 } = calculateNewDates({
    endDate: toCol1 ? dayjs(row1.row[toCol1.title!]) : dayjs(row1.row[fromCol1.title!]).add(1, 'hour'),
    startDate: dayjs(row1.row[fromCol1.title!]),
    scheduleStart: dayjs(selectedDate.value).startOf('day'),
    scheduleEnd: dayjs(selectedDate.value).endOf('day'),
  })

  const { startDate: startDate2, endDate: endDate2 } = calculateNewDates({
    endDate: toCol2 ? dayjs(row2.row[toCol2.title!]) : dayjs(row2.row[fromCol2.title!]).add(1, 'hour'),
    startDate: dayjs(row2.row[fromCol2.title!]),
    scheduleStart: dayjs(selectedDate.value).startOf('day'),
    scheduleEnd: dayjs(selectedDate.value).endOf('day'),
  })

  return startDate1.isBetween(startDate2, endDate2, null, '[]') || endDate1.isBetween(startDate2, endDate2, null, '[]')
} */

/* const getMaxOverlaps = ({ row, rowArray }: { row: Row; rowArray: Row[] }) => {
  let maxOverlaps = row.rowMeta.numberOfOverlaps
  for (const record of rowArray) {
    if (isOverlaps(row, record)) {
      if (!record.rowMeta.numberOfOverlaps || !row.rowMeta.numberOfOverlaps) continue
      if (record.rowMeta.numberOfOverlaps > row.rowMeta.numberOfOverlaps) {
        maxOverlaps = record.rowMeta.numberOfOverlaps
      }
    }
  }
  return maxOverlaps
} */

const recordsAcrossAllRange = computed<{
  record: Row[]
  count: {
    [key: string]: {
      id: string[]
      overflow: boolean
      overflowCount: number
    }
  }
}>(() => {
  if (!calendarRange.value || !formattedData.value) return { record: [], count: {} }

  const scheduleStart = dayjs(selectedDate.value).startOf('day')
  const scheduleEnd = dayjs(selectedDate.value).endOf('day')

  // We use this object to keep track of the number of records that overlap at a given time, and if the number of records exceeds 4, we hide the record
  // and show a button to view more records
  // The key is the time in HH:mm format
  // id is the id of the record generated below

  const overlaps: {
    [key: string]: {
      id: string[]
      overflow: boolean
      overflowCount: number
    }
  } = {}

  const perRecordHeight = 80

  /*  const columnArray: Array<Array<Row>> = [[]]
  const gridTimeMap = new Map() */

  let recordsByRange: Array<Row> = []

  calendarRange.value.forEach((range) => {
    const fromCol = range.fk_from_col
    const endCol = range.fk_to_col

    // We fetch all the records that match the calendar ranges in a single time.
    // But not all fetched records are valid for the certain range, so we filter them out & sort them
    const sortedFormattedData = [...formattedData.value]
      .filter((record) => {
        const fromDate = record.row[fromCol!.title!] ? dayjs(record.row[fromCol!.title!]) : null

        if (fromCol && endCol) {
          const fromDate = record.row[fromCol.title!] ? dayjs(record.row[fromCol.title!]) : null
          const toDate = record.row[endCol.title!] ? dayjs(record.row[endCol.title!]) : null

          return fromDate && toDate?.isValid() ? fromDate.isSameOrBefore(toDate) : true
        } else if (fromCol && !endCol) {
          return !!fromDate
        }
        return false
      })
      .sort((a, b) => {
        const aDate = dayjs(a.row[fromCol!.title!])
        const bDate = dayjs(b.row[fromCol!.title!])
        return aDate.isBefore(bDate) ? 1 : -1
      })

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
        const topInPixels = (startDate.hour() + startDate.minute() / 60) * 80

        // A minimum height of 80px is set for each record
        // The height of the record is calculated based on the difference between the start and end date
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const startHour = startDate.hour()
        let _startDate = startDate.clone()

        const style: Partial<CSSStyleDeclaration> = {
          height: `${heightInPixels}px`,
          top: `${topInPixels + 5 + startHour * 2}px`,
        }

        // We loop through every 1 minutes between the start and end date and keep track of the number of records that overlap at a given time
        // If the number of records exceeds 4, we hide the record and show a button to view more records
        while (_startDate.isBefore(endDate)) {
          const timeKey = _startDate.format('HH:mm')
          if (!overlaps[timeKey]) {
            overlaps[timeKey] = {
              id: [],
              overflow: false,
              overflowCount: 0,
            }
          }
          overlaps[timeKey].id.push(id)

          // If the number of records exceeds 4, we hide the record mark the time as overflow
          if (overlaps[timeKey].id.length > 4) {
            overlaps[timeKey].overflow = true
            style.display = 'none'
            overlaps[timeKey].overflowCount += 1
          }
          _startDate = _startDate.add(1, 'minutes')
        }

        // This property is used to determine which side the record should be rounded. It can be top, bottom, both or none
        // We use the start and end date to determine the position of the record
        let position = 'none'
        const isSelectedDay = (date: dayjs.Dayjs) => date.isSame(selectedDate.value, 'day')
        const isBeforeSelectedDay = (date: dayjs.Dayjs) => date.isBefore(selectedDate.value, 'day')
        const isAfterSelectedDay = (date: dayjs.Dayjs) => date.isAfter(selectedDate.value, 'day')

        if (isSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'rounded'
        } else if (isBeforeSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'none'
        } else if (isSelectedDay(startDate) && isAfterSelectedDay(endDate)) {
          position = 'topRounded'
        } else if (isBeforeSelectedDay(startDate) && isSelectedDay(endDate)) {
          position = 'bottomRounded'
        } else {
          position = 'none'
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            position,
            style,
            id,
            range: range as any,
          },
        })
      } else if (fromCol) {
        const { startDate, endDate } = calculateNewDates({
          startDate: dayjs(record.row[fromCol.title!]),
          endDate: dayjs(record.row[fromCol.title!]).add(1, 'hour'),
          scheduleStart,
          scheduleEnd,
        })

        const startHour = startDate.hour()

        let style: Partial<CSSStyleDeclaration> = {}
        let _startDate = startDate.clone()

        // We loop through every minute between the start and end date and keep track of the number of records that overlap at a given time
        while (_startDate.isBefore(endDate, 'minute')) {
          const timeKey = _startDate.format('HH:mm')

          if (!overlaps[timeKey]) {
            overlaps[timeKey] = {
              id: [],
              overflow: false,
              overflowCount: 0,
            }
          }
          overlaps[timeKey].id.push(id)

          // If the number of records exceeds 8, we hide the record and mark it as overflow
          if (overlaps[timeKey].id.length > 8) {
            overlaps[timeKey].overflow = true
            overlaps[timeKey].overflowCount += 1
            style = {
              ...style,
              display: 'none',
            }
          }

          _startDate = _startDate.add(1, 'minute')
        }

        // The top of the record is calculated based on the start hour
        // Update such that it is also based on Minutes

        const minutes = startDate.minute() + startDate.hour() * 60

        const updatedTopInPixels = (minutes * 80) / 60

        // A minimum height of 80px is set for each record
        const heightInPixels = Math.max((endDate.diff(startDate, 'minute') / 60) * 80, perRecordHeight)

        const finalTopInPixels = updatedTopInPixels + startHour * 2

        style = {
          ...style,
          top: `${finalTopInPixels + 2}px`,
          height: `${heightInPixels - 2}px`,
        }

        recordsByRange.push({
          ...record,
          rowMeta: {
            ...record.rowMeta,
            range: range as any,
            style,
            id,
            position: 'rounded',
          },
        })
      }
    }
  })
  /*
  recordsByRange.sort((a, b) => {
    const fromColA = a.rowMeta.range?.fk_from_col
    const fromColB = b.rowMeta.range?.fk_from_col
    if (!fromColA || !fromColB) return 0
    return dayjs(a.row[fromColA.title!]).isBefore(dayjs(b.row[fromColB.title!])) ? -1 : 1
  }) */

  // We can't calculate the width & left of the records without knowing the number of records that overlap at a given time
  // So we loop through the records again and calculate the width & left of the records based on the number of records that overlap at a given time
  recordsByRange = recordsByRange.map((record) => {
    // MaxOverlaps is the number of records that overlap at a given time
    // overlapIndex is the index of the record in the list of records that overlap at a given time
    let maxOverlaps = 1
    let overlapIndex = 0
    for (const minutes in overlaps) {
      if (overlaps[minutes].id.includes(record.rowMeta.id!)) {
        maxOverlaps = Math.max(maxOverlaps, overlaps[minutes].id.length - overlaps[minutes].overflowCount)
        overlapIndex = Math.max(overlaps[minutes].id.indexOf(record.rowMeta.id!), overlapIndex)
      }
    }
    const spacing = 0.25
    const widthPerRecord = (100 - spacing * (maxOverlaps - 1)) / maxOverlaps
    const leftPerRecord = (widthPerRecord + spacing) * overlapIndex
    record.rowMeta.style = {
      ...record.rowMeta.style,
      left: `${leftPerRecord - 0.08}%`,
      width: `calc(${widthPerRecord}%)`,
    }
    return record
  })

  // TODO: Rewrite the calculations for the style of the records

  /* for (const record of recordsByRange) {
    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) continue

    const { startDate, endDate } = calculateNewDates({
      startDate: dayjs(record.row[fromCol.title!]),
      endDate: toCol ? dayjs(record.row[toCol.title!]) : dayjs(record.row[fromCol.title!]).add(1, 'hour'),
      scheduleStart,
      scheduleEnd,
    })

    const gridTimes = getGridTimeSlots(startDate, endDate)

    for (let gridCounter = gridTimes.from; gridCounter <= gridTimes.to; gridCounter++) {
      if (gridTimeMap.has(gridCounter)) {
        gridTimeMap.set(gridCounter, gridTimeMap.get(gridCounter) + 1)
      } else {
        gridTimeMap.set(gridCounter, 1)
      }
    }

    let foundAColumn = false

    for (const column in columnArray) {
      if (
        hasSlotForRecord(record, columnArray[column], {
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
      const recordRange = record.rowMeta.range
      const fromCol = recordRange?.fk_from_col
      const toCol = recordRange?.fk_to_col

      if (!fromCol) continue

      const { startDate, endDate } = calculateNewDates({
        startDate: dayjs(record.row[fromCol.title!]),
        endDate: toCol ? dayjs(record.row[toCol.title!]) : dayjs(record.row[fromCol.title!]).add(1, 'hour'),
        scheduleStart: dayjs(selectedDate.value).startOf('day'),
        scheduleEnd: dayjs(selectedDate.value).endOf('day'),
      })

      record.rowMeta.numberOfOverlaps =
        getMaxOfGrid(
          {
            fromDate: startDate,
            toDate: endDate,
          },
          gridTimeMap,
        ) - 1
      record.rowMeta.overLapIteration = parseInt(columnIndex) + 1
    }
  }
  for (const record of recordsByRange) {
    record.rowMeta.numberOfOverlaps = getMaxOverlaps({
      row: record,
      rowArray: recordsByRange,
    })

    const width = 100 / columnArray.length
    const left = width * (record.rowMeta.overLapIteration - 1)

    record.rowMeta.style = {
      ...record.rowMeta.style,
      width: `${width.toFixed(2)}%`,
      left: `${left}%`,
    }
  } */

  return {
    count: overlaps,
    record: recordsByRange,
  }
})

const dragRecord = ref<Row | null>(null)

const isDragging = ref(false)

const dragElement = ref<HTMLElement | null>(null)

const resizeDirection = ref<'right' | 'left' | null>()

const resizeRecord = ref<Row | null>()

const dragTimeout = ref<ReturnType<typeof setTimeout>>()

const hoverRecord = ref<string | null>(null)

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

// When the user is dragging a record, we calculate the new start and end date based on the mouse position
const calculateNewRow = (event: MouseEvent) => {
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
      [fromCol.title!]: dayjs(newStartDate).format('YYYY-MM-DD HH:mm:ssZ'),
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

    newRow.row[toCol.title!] = dayjs(endDate).format('YYYY-MM-DD HH:mm:ssZ')

    updateProperty.push(toCol.title!)
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
  }
  return { newRow, updateProperty }
}

const onResize = (event: MouseEvent) => {
  if (!isUIAllowed('dataEdit') || !container.value || !resizeRecord.value) return

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

  const hour = Math.floor(percentY * 24) // Round down to the nearest hour
  const minutes = Math.round((percentY * 24 * 60) % 60)

  let newRow: Row | null = null
  let updateProperty: string[] = []

  if (resizeDirection.value === 'right') {
    // If the user is resizing the record to the right, we calculate the new end date based on the mouse position
    let newEndDate = dayjs(selectedDate.value).add(hour, 'hour').add(minutes, 'minute')

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
    let newStartDate = dayjs(selectedDate.value).add(hour, 'hour').add(minutes, 'minute')

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

  const { newRow, updateProperty } = calculateNewRow(event)
  if (!newRow && !updateProperty) return

  const allRecords = document.querySelectorAll('.draggable-record')
  allRecords.forEach((el) => {
    el.style.visibility = ''
    el.style.opacity = '100%'
  })

  if (dragElement.value) {
    dragElement.value.style.boxShadow = 'none'
    dragElement.value = null
  }

  if (dragRecord.value) {
    dragRecord.value = undefined
  }

  if (!newRow) return
  updateRowProperty(newRow, updateProperty, false)

  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

const dragStart = (event: MouseEvent, record: Row) => {
  if (!isUIAllowed('dataEdit')) return
  let target = event.target as HTMLElement

  isDragging.value = false

  // We use a timeout to determine if the user is dragging or clicking on the record
  dragTimeout.value = setTimeout(() => {
    isDragging.value = true
    while (!target.classList.contains('draggable-record')) {
      target = target.parentElement as HTMLElement
    }

    // When the user starts dragging a record, we reduce opacity of all other records
    const allRecords = document.querySelectorAll('.draggable-record')
    allRecords.forEach((el) => {
      if (!el.getAttribute('data-unique-id').includes(record.rowMeta.id!)) {
        // el.style.visibility = 'hidden'
        el.style.opacity = '30%'
      }
    })

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

const isOverflowAcrossHourRange = (hour: dayjs.Dayjs) => {
  let startOfHour = hour.startOf('hour')
  const endOfHour = hour.endOf('hour')

  const ids: Array<string> = []

  let isOverflow = false
  let overflowCount = 0

  while (startOfHour.isBefore(endOfHour, 'minute')) {
    const hourKey = startOfHour.format('HH:mm')
    if (recordsAcrossAllRange.value?.count?.[hourKey]?.overflow) {
      isOverflow = true

      recordsAcrossAllRange.value?.count?.[hourKey]?.id.forEach((id) => {
        if (!ids.includes(id)) {
          ids.push(id)
          overflowCount += 1
        }
      })
    }
    startOfHour = startOfHour.add(1, 'minute')
  }

  overflowCount = overflowCount > 8 ? overflowCount - 8 : 0

  return { isOverflow, overflowCount }
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
</script>

<template>
  <div
    ref="container"
    class="w-full relative no-selection h-[calc(100vh-10rem)] overflow-y-auto nc-scrollbar-md"
    data-testid="nc-calendar-day-view"
  >
    <div
      v-for="(hour, index) in hours"
      :key="index"
      :class="{
        '!border-brand-500': hour.isSame(selectedTime),
      }"
      class="flex w-full min-h-20 relative border-1 group hover:bg-gray-50 border-white border-b-gray-100"
      data-testid="nc-calendar-day-hour"
      @click="selectHour(hour)"
      @dblclick="newRecord(hour)"
    >
      <div class="pt-2 px-4 text-xs text-gray-500 font-semibold h-20">
        {{ dayjs(hour).format('H A') }}
      </div>
      <div></div>
      <NcDropdown
        v-if="calendarRange.length > 1"
        :class="{
          '!block': hour.isSame(selectedTime),
          '!hidden': !hour.isSame(selectedTime),
        }"
        auto-close
      >
        <NcButton
          class="!group-hover:block mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
          size="xsmall"
          type="secondary"
        >
          <component :is="iconMap.plus" class="h-4 w-4" />
        </NcButton>
        <template #overlay>
          <NcMenu class="w-64">
            <NcMenuItem> Select date field to add </NcMenuItem>
            <NcMenuItem
              v-for="(range, calIndex) in calendarRange"
              :key="calIndex"
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
          </NcMenu>
        </template>
      </NcDropdown>
      <NcButton
        v-else
        :class="{
          '!block': hour.isSame(selectedTime),
          '!hidden': !hour.isSame(selectedTime),
        }"
        class="!group-hover:block mr-4 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
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
    <div class="absolute inset-0 pointer-events-none">
      <div class="relative !ml-[60px]" data-testid="nc-calendar-day-record-container">
        <div
          v-for="(record, rowIndex) in recordsAcrossAllRange.record"
          :key="rowIndex"
          :data-testid="`nc-calendar-day-record-${record.row[displayField!.title!]}`"
          :data-unique-id="record.rowMeta.id"
          :style="record.rowMeta.style"
          class="absolute draggable-record group cursor-pointer pointer-events-auto"
          @mousedown="dragStart($event, record)"
          @mouseleave="hoverRecord = null"
          @mouseover="hoverRecord = record.rowMeta.id as string"
          @dragover.prevent
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarVRecordCard
              :hover="hoverRecord === record.rowMeta.id || record.rowMeta.id === dragRecord?.rowMeta?.id"
              :selected="record.rowMeta.id === dragRecord?.rowMeta?.id"
              :position="record.rowMeta!.position"
              :record="record"
              :resize="!!record.rowMeta.range?.fk_to_col && isUIAllowed('dataEdit')"
              color="blue"
              @resize-start="onResizeStart"
            >
              <template v-if="!isRowEmpty(record, displayField)">
                <LazySmartsheetCalendarCell
                  v-if="!isRowEmpty(record, displayField!)"
                  v-model="record.row[displayField!.title!]"
                  :bold="getFieldStyle(displayField!).bold"
                  :column="displayField!"
                  :italic="getFieldStyle(displayField!).italic"
                  :underline="getFieldStyle(displayField!).underline"
                />
              </template>
              <template v-for="(field, id) in fieldsWithoutDisplay" :key="id">
                <LazySmartsheetCalendarCell
                  v-if="!isRowEmpty(record, field!)"
                  v-model="record.row[field!.title!]"
                  :bold="getFieldStyle(field).bold"
                  :column="field"
                  :italic="getFieldStyle(field).italic"
                  :underline="getFieldStyle(field).underline"
                />
              </template>
            </LazySmartsheetCalendarVRecordCard>
          </LazySmartsheetRow>
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
</style>
