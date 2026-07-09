<script lang="ts" setup>
import dayjs from 'dayjs'
import { type ColumnType, PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'
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
  updateFormat,
  timezoneDayjs,
  timezone,
  isSyncedFromColumn,
} = useCalendarViewStoreOrThrow()

// Range (date) columns are already conveyed by the block's time + position, so
// they're excluded from the card body — keeps it a clean title line by default.
const rangeFieldIds = computed(() => {
  const ids = new Set<string>()
  for (const r of calendarRange.value || []) {
    if (r.fk_from_col?.id) ids.add(r.fk_from_col.id)
    if (r.fk_to_col?.id) ids.add(r.fk_to_col.id)
  }
  return ids
})

const { isSyncedTable } = useSmartsheetStoreOrThrow()

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

// Number of title lines that fit in a time-grid card of this height. >= 2
// switches the card body to multi-line wrap (the title wraps and is clamped with
// a trailing ellipsis); 1 keeps the single-line + tooltip layout for short
// cards. Card height (px) is precomputed into rowMeta.style.height during the
// layout pass below — ~28px is reserved for the time row + padding, lines 18px.
const CARD_WRAP_LINE_HEIGHT = 18
const CARD_WRAP_RESERVED = 28

function cardClampLines(record: Row): number {
  const height = Number.parseFloat(`${record.rowMeta?.style?.height ?? ''}`)
  if (Number.isNaN(height)) return 1
  return Math.max(1, Math.floor((height - CARD_WRAP_RESERVED) / CARD_WRAP_LINE_HEIGHT))
}

const hours = computed(() => {
  const hours: Array<dayjs.Dayjs> = []

  // Force the date part only (no time), to reset time to 00:00 in target TZ
  const baseDateStr = dayjs(selectedDate.value).format('YYYY-MM-DD')

  // Parse in timezone with NO time part — this ensures it's midnight in TZ
  const startOfDay = timezoneDayjs.dayjsTz(baseDateStr, 'YYYY-MM-DD').hour(0).minute(0).second(0)

  for (let i = 0; i < 24; i++) {
    hours.push(startOfDay.clone().add(i, 'hour'))
  }
  return hours
})

const currTime = ref(timezoneDayjs.dayjsTz())

// The hour axis and current-time indicator follow the primary range field's
// Time format setting (12h vs 24h) rather than being hard-wired to 12h.
const is12hrAxis = computed(() => is12hrTimeColumn(calendarRange.value?.[0]?.fk_from_col))

const overlayTop = computed(() => {
  const perRecordHeight = 52

  const minutes = currTime.value.minute() + currTime.value.hour() * 60

  const top = (perRecordHeight / 60) * minutes - 9

  return top
})

const shouldEnableOverlay = computed(() => {
  return !isPublic.value && timezoneDayjs.dayjsTz().isSame(selectedDate.value, 'day')
})

onMounted(() => {
  const intervalId = setInterval(() => {
    currTime.value = timezoneDayjs.dayjsTz()
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
      startDate: timezoneDayjs.timezonize(column.row[columnFromCol.title!]),
      endDate:
        columnToCol && dayjs(column.row[columnToCol.title!])?.isValid()
          ? timezoneDayjs.timezonize(column.row[columnToCol.title!])
          : timezoneDayjs.timezonize(column.row[columnFromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
      scheduleStart: timezoneDayjs.dayjsTz(selectedDate.value).startOf('day'),
      scheduleEnd: timezoneDayjs.dayjsTz(selectedDate.value).endOf('day'),
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
      overflowRecords: Row[]
    }
  >
}>(() => {
  if (!calendarRange.value || !formattedData.value) return { record: [], spanningRecords: [], gridTimeMap: new Map() }

  const scheduleStart = timezoneDayjs.dayjsTz(selectedDate.value).startOf('day')
  const scheduleEnd = timezoneDayjs.dayjsTz(selectedDate.value).endOf('day')

  const perRecordHeight = 52

  const columnArray: Array<Array<Row>> = [[]]
  const gridTimeMap = new Map<
    number,
    {
      count: number
      id: string[]
      overflowRecords: Row[]
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
        const fromDate = fromCol?.title && record.row[fromCol.title] ? timezoneDayjs.timezonize(record.row[fromCol.title]) : null

        if (fromCol && endCol) {
          const toDate = record.row[endCol.title!] ? timezoneDayjs.timezonize(record.row[endCol.title!]) : null

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
      .sort((a, b) => {
        const aDate = a.row[fromCol!.title!] || (endCol && a.row[endCol.title!])
        const bDate = b.row[fromCol!.title!] || (endCol && b.row[endCol.title!])
        return timezoneDayjs.timezonize(aDate).isBefore(timezoneDayjs.timezonize(bDate)) ? 1 : -1
      })

    for (const record of sortedFormattedData) {
      const id = record.rowMeta.id ?? generateRandomNumber()

      if (fromCol && endCol) {
        // Use whichever date is available; fall back to the other if one is missing
        const rawStart = record.row[fromCol.title!]
          ? timezoneDayjs.timezonize(record.row[fromCol.title!])
          : record.row[endCol.title!]
          ? timezoneDayjs.timezonize(record.row[endCol.title!])
          : null
        if (!rawStart) continue

        const { endDate, startDate } = calculateNewDates({
          endDate: dayjs(record.row[endCol.title!])?.isValid()
            ? timezoneDayjs.timezonize(record.row[endCol.title!])
            : dayjs(record.row[endCol.title!]),
          startDate: rawStart,
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
          startDate: timezoneDayjs.timezonize(record.row[fromCol.title!]),
          endDate: timezoneDayjs.timezonize(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
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
    return timezoneDayjs.timezonize(a.row[fromColA.title!]).isBefore(timezoneDayjs.timezonize(b.row[fromColB.title!])) ? -1 : 1
  })

  for (const record of recordsByRange) {
    const fromCol = record.rowMeta.range?.fk_from_col
    const toCol = record.rowMeta.range?.fk_to_col

    if (!fromCol) continue

    const { startDate, endDate } = calculateNewDates({
      startDate: timezoneDayjs.timezonize(record.row[fromCol.title!]),
      endDate:
        toCol && dayjs(record.row[toCol.title])?.isValid()
          ? timezoneDayjs.timezonize(record.row[toCol.title!])
          : timezoneDayjs.timezonize(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
      scheduleStart,
      scheduleEnd,
    })

    const gridTimes = getGridTimeSlots(startDate, endDate)

    for (let gridCounter = gridTimes.from; gridCounter <= gridTimes.to; gridCounter++) {
      if (!gridTimeMap.has(gridCounter)) {
        gridTimeMap.set(gridCounter, {
          count: 1,
          id: [record.rowMeta.id!],
          overflowRecords: [],
        })
      } else {
        gridTimeMap.set(gridCounter, {
          count: gridTimeMap.get(gridCounter)!.count + 1,
          id: [...gridTimeMap.get(gridCounter)!.id, record.rowMeta.id!],
          overflowRecords: [],
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

  // Overlap denominator: every card in a connected overlap cluster must divide by the SAME
  // column count, or `width` (100% / N) and the column offset (`overLapIteration`) tile on
  // different grids — a long record spanning from a sparse region into a denser one gets a
  // smaller width unit than its short neighbours and renders on top of them. The greedy
  // column packing above already colours each cluster with exactly its max-concurrency
  // number of columns, so we union every record that co-occurs in a grid slot and give all
  // members of a cluster its highest column index as `numberOfOverlaps`. Cards therefore
  // fill the width when a cluster is sparse and shrink to the 48px min (outer wrapper
  // scrolls) when it is busy — without ever overlapping.
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    let root = x
    while (parent.get(root) !== root) root = parent.get(root)!
    let cur = x
    while (cur !== root) {
      const next = parent.get(cur)!
      parent.set(cur, root)
      cur = next
    }
    return root
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const record of recordsByRange) {
    const id = `${record.rowMeta.id}`
    if (!parent.has(id)) parent.set(id, id)
  }
  // Records sharing any grid slot are mutually overlapping; union them so a long record
  // bridging two busy regions pulls both into one cluster (transitive via union-find).
  for (const { id: slotIds } of gridTimeMap.values()) {
    for (let i = 1; i < slotIds.length; i++) union(`${slotIds[0]}`, `${slotIds[i]}`)
  }

  const clusterMaxColumns = new Map<string, number>()
  for (const record of recordsByRange) {
    const root = find(`${record.rowMeta.id}`)
    clusterMaxColumns.set(root, Math.max(clusterMaxColumns.get(root) ?? 1, record.rowMeta.overLapIteration ?? 1))
  }

  for (const record of recordsByRange) {
    record.rowMeta.numberOfOverlaps = clusterMaxColumns.get(find(`${record.rowMeta.id}`)) ?? 1

    record.rowMeta.style = {
      ...record.rowMeta.style,
      display: 'block',
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
  const newStartDate = timezoneDayjs.timezonize(selectedDate.value.startOf('day')).add(hour, 'hour').add(minutes, 'minute')
  if (!newStartDate || !fromCol) return { newRow: null, updateProperty: [] }

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
    },
  }

  const updateProperty = [fromCol.title!]

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? timezoneDayjs.timezonize(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!] ? timezoneDayjs.timezonize(dragRecord.value.row[toCol.title!]) : null

    // If there is an end date, we calculate the new end date based on the new start date and add the difference between the start and end date to the new start date
    if (fromDate && toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).add(toDate.diff(fromDate, 'hour'), 'hour')
    } else if (fromDate && !toDate) {
      // If there is no end date, we set the end date to the end of the day
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('hour')
    } else if (!fromDate && toDate) {
      // If there is no start date, we set the end date to the end of the day
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('hour')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol.title!] = timezoneDayjs.dayjsTz(endDate).format(updateFormat.value)

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

  const ogEndDate = timezoneDayjs.timezonize(resizeRecord.value.row[toCol.title!])
  const ogStartDate = timezoneDayjs.timezonize(resizeRecord.value.row[fromCol.title!])

  const minutes = Math.round((percentY * 24 * 60) / 15) * 15 // Round to nearest 15 minutes

  let newRow: Row | null = null
  let updateProperty: string[] = []

  if (resizeDirection.value === 'right') {
    // If the user is resizing the record to the right, we calculate the new end date based on the mouse position
    let newEndDate = timezoneDayjs.timezonize(selectedDate.value.startOf('day')).add(minutes, 'minute')

    updateProperty = [toCol.title!]

    // If the new end date is before the start date, we set the new end date to the start date
    // This is to ensure the end date is always same or after the start date
    if (timezoneDayjs.dayjsTz(newEndDate).isBefore(ogStartDate.add(1, 'hour'))) {
      newEndDate = ogStartDate.clone().add(1, 'hour')
    }

    if (!newEndDate.isValid()) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol.title!]: newEndDate.format(updateFormat.value),
      },
    }
  } else if (resizeDirection.value === 'left') {
    let newStartDate = timezoneDayjs.dayjsTz(selectedDate.value).startOf('day').add(minutes, 'minute')

    updateProperty = [fromCol.title!]

    // If the new start date is after the end date, we set the new start date to the end date
    // This is to ensure the start date is always before or same the end date
    if (timezoneDayjs.dayjsTz(newStartDate).isAfter(ogEndDate.subtract(1, 'hour'))) {
      newStartDate = timezoneDayjs.dayjsTz(ogEndDate).clone().add(-1, 'hour')
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
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

  // Drag-to-reschedule is gated to editable, non-synced ranges; click-to-expand
  // (onMouseUp below) must work regardless so synced records can be opened.
  const canDrag = isUIAllowed('dataEdit') && !isSyncedFromColumn.value && !record.rowMeta.range?.is_readonly

  if (canDrag) {
    // We use a timeout to determine if the user is dragging or clicking on the record
    dragTimeout.value = setTimeout(() => {
      isDragging.value = true
      while (!target.classList.contains('draggable-record')) {
        target = target.parentElement as HTMLElement
      }

      dragRecord.value = record
      dragElement.value = target

      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
    }, 200)
  }

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
    } = parseProp(data)

    // Not a valid record
    if (!record?.rowMeta) return

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

    const newStartDate = timezoneDayjs.dayjsTz(selectedDate.value).startOf('day').add(hour, 'hour').add(minutes, 'minute')

    let endDate

    const newRow = {
      ...record,
      row: {
        ...record.row,
        [fromCol.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
      },
    }

    const updateProperty = [fromCol.title!]

    if (toCol) {
      const fromDate = record.row[fromCol.title!] ? timezoneDayjs.timezonize(record.row[fromCol.title!]) : null
      const toDate = record.row[toCol.title!] ? timezoneDayjs.timezonize(record.row[toCol.title!]) : null

      if (fromDate && toDate) {
        endDate = timezoneDayjs.dayjsTz(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
      } else if (fromDate && !toDate) {
        endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
      } else if (!fromDate && toDate) {
        endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
      } else {
        endDate = newStartDate.clone()
      }
      newRow.row[toCol.title!] = timezoneDayjs.dayjsTz(endDate).format(updateFormat.value)
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

const selectHour = (hour: dayjs.Dayjs) => {
  selectedTime.value = hour
  dragRecord.value = null
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const newRecord = (hour: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value?.length || isSyncedTable.value) return
  const record = {
    row: {
      [calendarRange.value[0].fk_from_col!.title!]: hour.format(updateFormat.value),
    },
  }
  emit('newRecord', record)
}

const newRecordWithRange = (range: any, hour: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || isSyncedTable.value) return
  let record = {
    row: {
      [range.fk_from_col!.title!]: hour.format(updateFormat.value),
    },
  }
  if (range.fk_to_col) {
    record = {
      row: {
        ...record.row,
        [range.fk_to_col!.title!]: hour.add(1, 'hour').format(updateFormat.value),
      },
    }
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

watch([() => timezone], () => {
  currTime.value = timezoneDayjs.dayjsTz()
})

const expandRecord = (record: Row) => {
  emit('expandRecord', record)
}
</script>

<template>
  <div class="h-[calc(100vh-5.3rem)] nc-scrollbar-md nc-scrollbar-x-md">
    <SmartsheetCalendarDateTimeSpanningContainer
      v-if="
        calendarRange.some((range) => range.fk_to_col !== null && range.fk_to_col !== undefined) &&
        recordsAcrossAllRange.spanningRecords?.length
      "
      :records="recordsAcrossAllRange.spanningRecords"
      @expand-record="expandRecord"
    />
    <!-- Inner wrapper: free size — grows to fit the flex-1 columns. The OUTER wrapper (above)
         has the scrollbar; this never does. Records are laid out by CSS flex (no JS width
         measurement → no ResizeObserver loop) and nothing is hidden behind "+N more". -->
    <div ref="container" class="flex relative no-selection w-full" data-testid="nc-calendar-day-view" @drop="dropEvent">
      <!-- Time-axis gutter: sticky so it stays put while the grid scrolls horizontally -->
      <div class="sticky left-0 z-20 bg-nc-bg-default flex-none">
        <div
          v-for="(hour, index) in hours"
          :key="index"
          class="flex h-13 relative border-1 border-nc-base-white border-b-nc-border-gray-light"
        >
          <div class="w-16 pr-2 pl-2 text-right text-xs text-nc-content-gray-disabled font-semibold h-13">
            {{ timezoneDayjs.dayjsTz(hour).format(is12hrAxis ? 'hh a' : 'HH:00') }}
          </div>
        </div>
      </div>

      <!-- Time area: hour-grid background + current-time line + record columns. Grows to fit
           the columns; the outer wrapper scrolls horizontally when they exceed the viewport. -->
      <div class="relative flex-1">
        <!-- Hour grid background (clickable rows + add-record button) -->
        <div class="absolute inset-0 z-1">
          <div
            v-for="(hour, index) in hours"
            :key="index"
            :class="{ 'selected-hour': hour.isSame(selectedTime) }"
            class="flex w-full h-13 transition nc-calendar-day-hour relative border-1 group hover:bg-nc-bg-gray-extralight border-nc-base-white border-b-nc-border-gray-light"
            data-testid="nc-calendar-day-hour"
            @click="selectHour(hour)"
            @dblclick="newRecord(hour)"
          >
            <NcDropdown
              v-if="calendarRange.length > 1 && !isPublic"
              :class="{ '!block': hour.isSame(selectedTime), '!hidden': !hour.isSame(selectedTime) }"
              auto-close
            >
              <NcButton
                class="!group-hover:block mr-10 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block absolute"
                size="xsmall"
                type="secondary"
              >
                <component :is="iconMap.plus" class="h-4 w-4" />
              </NcButton>
              <template #overlay>
                <NcMenu class="w-64">
                  <NcMenuItem> {{ $t('labels.selectDateFieldToAdd') }} </NcMenuItem>
                  <template v-for="(range, calIndex) in calendarRange" :key="calIndex">
                    <NcMenuItem
                      v-if="!range.is_readonly"
                      class="text-nc-content-gray font-semibold text-sm"
                      @click="newRecordWithRange(range, hour)"
                    >
                      <div class="flex items-center gap-1">
                        <LazySmartsheetHeaderIcon :column="range.fk_from_col" />

                        <span class="ml-1">{{ range.fk_from_col!.title! }}</span>
                      </div>
                    </NcMenuItem>
                  </template>
                </NcMenu>
              </template>
            </NcDropdown>

            <div
              v-else-if="
                !isPublic && isUIAllowed('dataEdit') && [UITypes.DateTime, UITypes.Date].includes(calDataType) && !isSyncedTable
              "
              :class="{ '!block': hour.isSame(selectedTime), '!hidden': !hour.isSame(selectedTime) }"
              class="!group-hover:block mr-10 my-auto ml-auto z-10 top-0 bottom-0 !group-hover:block relative"
            >
              <PermissionsTooltip
                :entity="PermissionEntity.TABLE"
                :entity-id="meta?.id"
                :permission="PermissionKey.TABLE_RECORD_ADD"
                placement="left"
              >
                <template #default="{ isAllowed }">
                  <NcButton
                    size="xsmall"
                    type="secondary"
                    :disabled="!isAllowed"
                    @click="newRecordWithRange(calendarRange[0], hour)"
                  >
                    <component :is="iconMap.plus" class="h-4 w-4" />
                  </NcButton>
                </template>
              </PermissionsTooltip>
            </div>
          </div>
        </div>

        <!-- Current-time indicator -->
        <div v-if="shouldEnableOverlay" class="absolute z-4 inset-x-0 pointer-events-none" :style="{ top: `${overlayTop}px` }">
          <div class="flex w-full items-center">
            <span
              class="text-nc-content-inverted-primary bg-nc-content-brand text-xs font-bold rounded-md pointer-events-auto leading-3.5 p-0.5 cursor-pointer"
              @click="newRecord(currTime)"
            >
              {{ currTime.format(is12hrAxis ? 'hh:mm A' : 'HH:mm') }}
            </span>
            <div class="flex-1 relative ml-1 nc-calendar-border-line border-b-2 border-nc-border-brand"></div>
          </div>
        </div>

        <!-- Records: each card fills its OWN time-row equally — width = max(100% / N, 48px),
             where N is this record's overlap count — so a busier row gets thinner cards (and
             overflows → the outer wrapper scrolls) while a quieter row gets wider cards.
             The layer is pointer-events-none and inset 8px from the left so clicks between
             cards (and on the left rail) fall through to the hour grid below — keeping every
             hour selectable even when a full-width record covers it. -->
        <div class="absolute z-2 inset-y-0 left-2 right-0 pointer-events-none" data-testid="nc-calendar-day-record-container">
          <template v-for="record in recordsAcrossAllRange.record" :key="record.rowMeta.id">
            <div
              v-if="record.rowMeta.style?.display !== 'none'"
              :data-testid="`nc-calendar-day-record-${record.row[displayField!.title!]}`"
              :data-unique-id="record.rowMeta.id"
              :style="{
                ...record.rowMeta.style,
                width: `max(calc(100% / ${record.rowMeta.numberOfOverlaps || 1}), 48px)`,
                left: `calc(max(calc(100% / ${record.rowMeta.numberOfOverlaps || 1}), 48px) * ${
                  (record.rowMeta.overLapIteration || 1) - 1
                })`,
                opacity:
                  (dragRecord === null || record.rowMeta.id === dragRecord?.rowMeta.id) &&
                  (resizeRecord === null || record.rowMeta.id === resizeRecord?.rowMeta.id)
                    ? 1
                    : 0.3,
              }"
              class="absolute draggable-record transition group cursor-pointer pointer-events-auto px-0.5"
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
                  :clamp-lines="cardClampLines(record)"
                  @resize-start="onResizeStart"
                >
                  <template v-for="(field, id) in fields" :key="id">
                    <LazySmartsheetPlainCell
                      v-if="!isRowEmpty(record, field!) && !rangeFieldIds.has(field!.id)"
                      v-model="record.row[field!.title!]"
                      class="text-xs font-medium"
                      :bold="getFieldStyle(field).bold"
                      :column="field"
                      :italic="getFieldStyle(field).italic"
                      :underline="getFieldStyle(field).underline"
                    />
                  </template>
                  <template #tooltip>
                    <SmartsheetRecordFieldsTooltip :record="record" :fields="fields" />
                  </template>
                  <template #time>
                    <div class="text-xs font-medium text-nc-content-gray-disabled">
                      {{
                        timezoneDayjs
                          .timezonize(record.row[record.rowMeta.range?.fk_from_col!.title!])
                          .format(is12hrTimeColumn(record.rowMeta.range?.fk_from_col) ? 'h:mm a' : 'HH:mm')
                      }}
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
  @apply relative !bg-nc-bg-brand !border-nc-bg-brand;
}

.nc-calendar-border-line::after {
  @apply absolute bg-nc-content-brand w-0.5 h-3;
  content: '';
  top: -5px;
  bottom: -6px;
  left: 0px;
}
</style>
