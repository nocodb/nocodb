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
  updateFormat,
  timezoneDayjs,
  isSyncedFromColumn,
  activeCalendarView,
  isDayAnchoredMode,
  dayAnchoredSpan,
} = useCalendarViewStoreOrThrow()

const { isSyncedTable } = useSmartsheetStoreOrThrow()

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

// Number of title lines that fit in a time-grid card of this height. >= 2
// switches the card body to multi-line wrap (the title wraps and is clamped with
// a trailing ellipsis); 1 keeps the single-line + tooltip layout for short
// cards. Card height (px) is precomputed into rowMeta.style.height during the
// layout pass below — ~28px is reserved for the time row + padding, lines 18px.
const CARD_WRAP_LINE_HEIGHT = 18
const CARD_WRAP_RESERVED = 28

// Airtable-style minimum sliver width: in a dense day column we render at most
// floor(columnWidth / this) overlapping cards so they stay visible bars instead of
// degrading to hairlines; the rest are covered by the "View all N events" overlay.
// ~13px ≈ Airtable (≈8 bars in a 7-column week, ≈15 in the wider 3-day columns).
const WEEK_MIN_SLIVER_WIDTH = 13

function cardClampLines(record: Row): number {
  const height = Number.parseFloat(`${record.rowMeta?.style?.height ?? ''}`)
  if (Number.isNaN(height)) return 1
  return Math.max(1, Math.floor((height - CARD_WRAP_RESERVED) / CARD_WRAP_LINE_HEIGHT))
}

const getDayIndex = (date: dayjs.Dayjs) => {
  // Column index relative to the first visible day. Equivalent to `date.day() - 1`
  // for the Monday-aligned week modes, but also correct for the day-anchored 3-day
  // window (which can start on any weekday).
  const start = timezoneDayjs.timezonize(selectedDateRange.value.start).startOf('day')
  return timezoneDayjs.timezonize(date).startOf('day').diff(start, 'day')
}

const maxVisibleDays = computed(() => {
  // Day-anchored modes ('3day', custom + day-unit) render exactly N day columns
  // (weekends always included). Week mode honours hide_weekend → 5 columns.
  if (isDayAnchoredMode.value) return dayAnchoredSpan.value
  return viewMetaProperties.value?.hide_weekend ? 5 : 7
})

// True only when weekends are actually hidden (week mode + hide_weekend). A day-anchored
// 5-day custom window also yields maxVisibleDays === 5 but is NOT weekend-hidden.
const isWeekendHidden = computed(() => !isDayAnchoredMode.value && maxVisibleDays.value === 5)

// --- Collapsed-weekend column model -----------------------------------------
// When collapse_weekend is on (week mode → 7 columns), Sat & Sun render in
// narrower columns. Day columns are positioned px-based, so expose per-column
// width/offset helpers; when not collapsed they return the uniform values.
const WEEKEND_COLLAPSE_RATIO = 0.5

const isWeekendCollapsed = computed(() => !!viewMetaProperties.value?.collapse_weekend && maxVisibleDays.value === 7)

const columnWeights = computed<number[]>(() => {
  const start = timezoneDayjs.timezonize(selectedDateRange.value.start).startOf('day')
  return Array.from({ length: maxVisibleDays.value }, (_, i) => {
    const dow = start.add(i, 'day').day()
    return isWeekendCollapsed.value && (dow === 0 || dow === 6) ? WEEKEND_COLLAPSE_RATIO : 1
  })
})

const totalColumnWeight = computed(() => columnWeights.value.reduce((sum, w) => sum + w, 0))

const columnWidthPx = (index: number) => {
  if (!isWeekendCollapsed.value) return containerWidth.value / maxVisibleDays.value
  return (containerWidth.value * columnWeights.value[index]) / totalColumnWeight.value
}

const columnOffsetPx = (index: number) => {
  if (!isWeekendCollapsed.value) return index * (containerWidth.value / maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < index; i++) offset += columnWidthPx(i)
  return offset
}

const columnFromX = (x: number) => {
  if (!isWeekendCollapsed.value) return Math.floor((x / containerWidth.value) * maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < maxVisibleDays.value; i++) {
    offset += columnWidthPx(i)
    if (x < offset) return i
  }
  return maxVisibleDays.value - 1
}

const columnWidthPct = (index: number) => `${(columnWeights.value[index] / totalColumnWeight.value) * 100}%`

const currTime = ref(timezoneDayjs.dayjsTz())

// The hour axis and current-time indicator follow the primary range field's
// Time format setting (12h vs 24h) rather than being hard-wired to 12h.
const is12hrAxis = computed(() => is12hrTimeColumn(calendarRange.value?.[0]?.fk_from_col))

const overlayStyle = computed(() => {
  if (!containerWidth.value)
    return {
      top: 0,
      left: 0,
    }

  const dayIndex = getDayIndex(currTime.value)
  const left = columnOffsetPx(dayIndex)
  const minutes = currTime.value.hour() * 60 + currTime.value.minute()

  const top = (52 / 60) * minutes - 12

  return {
    width: `${columnWidthPx(dayIndex)}px`,
    top: `${top}px`,
    left: `${left}px`,
  }
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

// Since it is a datetime Week view, we need to create a 2D array of dayjs objects to represent the hours in a day for each day in the week
const datesHours = computed(() => {
  // startOf and endOf dayjs is bugged with timezone
  const start = timezoneDayjs.timezonize(selectedDateRange.value.start)
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
      startDate: timezoneDayjs.timezonize(column.row[columnFromCol.title!]),
      endDate:
        columnToCol && dayjs(column.row[columnToCol.title!])?.isValid()
          ? timezoneDayjs.timezonize(column.row[columnToCol.title!])
          : timezoneDayjs.timezonize(column.row[columnFromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
      scheduleStart: timezoneDayjs.dayjsTz(selectedDateRange.value.start).startOf('day'),
      scheduleEnd: timezoneDayjs.dayjsTz(selectedDateRange.value.end).endOf('day'),
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
  // Walk the whole connected overlap component to fully populate `visited`; maxOverlaps below
  // is then the component's column count (max overLapIteration). Every record in the cluster
  // must resolve to the SAME denominator, so we must NOT early-exit the traversal — doing so
  // (the old `>= columnArray.length` short-circuit) left `visited` partial, giving co-overlapping
  // cards different width/left grids and overlapping them. (Mirrors DayView's union-find cluster.)
  const dfs = (id: string): number => {
    visited.add(id)
    let maxOverlaps = 1
    const neighbors = graph.get(id)
    if (neighbors) {
      for (const neighbor of neighbors) {
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
  denseBands: Array<{ dayIndex: number; top: number; height: number; count: number; maxOverlaps: number; maxHeight: number }>
}>(() => {
  if (!formattedData.value || !calendarRange.value || !container.value || !scrollContainer.value)
    return {
      records: [],
      gridTimeMap: new Map(),
      spanningRecords: [],
      denseBands: [],
    }
  const perHeight = 52

  const scheduleStart = timezoneDayjs.dayjsTz(selectedDateRange.value.start).startOf('day')
  let scheduleEnd = timezoneDayjs.dayjsTz(selectedDateRange.value.end).endOf('day')

  if (isWeekendHidden.value) {
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
          const hasFrom = !!record.row[fromCol.title!]
          const hasTo = !!record.row[toCol.title!]
          // If both dates missing, skip
          if (!hasFrom && !hasTo) return false
          // Use whichever date is available; fall back to the other if one is missing
          const fromDate = hasFrom
            ? timezoneDayjs.timezonize(record.row[fromCol.title!])
            : timezoneDayjs.timezonize(record.row[toCol.title!])
          const toDate = hasTo ? timezoneDayjs.timezonize(record.row[toCol.title!]) : fromDate.add(1, 'hour')

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
      .sort((a, b) => {
        const aDate = a.row[fromCol!.title!] || (toCol && a.row[toCol.title!])
        const bDate = b.row[fromCol!.title!] || (toCol && b.row[toCol.title!])
        return timezoneDayjs.timezonize(aDate).isBefore(timezoneDayjs.timezonize(bDate)) ? 1 : -1
      })

    for (const record of sortedFormattedData) {
      const id = record.rowMeta.id ?? generateRandomNumber()

      if (fromCol && toCol) {
        // Use whichever date is available; fall back to the other if one is missing
        const rawStart = record.row[fromCol.title!]
          ? timezoneDayjs.timezonize(record.row[fromCol.title!])
          : record.row[toCol.title!]
          ? timezoneDayjs.timezonize(record.row[toCol.title!])
          : null
        if (!rawStart) continue

        const { startDate, endDate } = calculateNewDates({
          startDate: rawStart,
          endDate: record.row[toCol.title!] ? timezoneDayjs.timezonize(record.row[toCol.title!]) : rawStart.add(1, 'hour'),
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
          startDate: timezoneDayjs.timezonize(record.row[fromCol.title!]),
          endDate: timezoneDayjs.timezonize(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
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
      return timezoneDayjs.timezonize(a.row[fromColA.title!]).isBefore(timezoneDayjs.timezonize(b.row[fromColB.title!])) ? -1 : 1
    })

    for (const record of recordsToDisplay) {
      const fromCol = record.rowMeta.range?.fk_from_col
      const toCol = record.rowMeta.range?.fk_to_col

      if (!fromCol) continue
      const { startDate, endDate } = calculateNewDates({
        startDate: timezoneDayjs.timezonize(record.row[fromCol.title!]),
        endDate:
          toCol && dayjs(record.row[toCol.title!])?.isValid()
            ? timezoneDayjs.timezonize(record.row[toCol.title!])
            : timezoneDayjs.timezonize(record.row[fromCol.title!]).add(1, 'hour').subtract(1, 'minute'),
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

        gridTimeMap.set(
          dayIndex,
          (gridTimeMap.get(dayIndex) ?? new Map()).set(gridCounter, {
            count,
            id: idArray,
          }),
        )
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

      if (isWeekendHidden.value) {
        if (dayIndex === 5 || dayIndex === 6) {
          display = 'none'
        }
      }

      record.rowMeta.numberOfOverlaps = maxOverlaps

      let width = 0
      let left = 100
      let capHidden = false

      const dayWidth = columnWidthPx(dayIndex)
      const majorLeft = columnOffsetPx(dayIndex)

      const isRecordDraggingOrResizeState =
        record.rowMeta.id === dragRecord.value?.rowMeta.id || record.rowMeta.id === resizeRecord.value?.rowMeta.id

      if (!isRecordDraggingOrResizeState) {
        // Shrink overlapping records to fit the day column (Airtable-style slivers), but never
        // below a readable min width: render at most floor(availableWidth / WEEK_MIN_SLIVER_WIDTH)
        // equal columns. Records packed beyond that cap are not drawn (capHidden) — the dense
        // cluster's "View all N events in day view" overlay (which still counts them) covers them,
        // so a 40-deep cluster shows ~8-15 bars instead of 40 hairlines.
        const availableWidth = dayWidth - 3
        const visibleColumns = Math.max(1, Math.min(maxOverlaps, Math.floor(availableWidth / WEEK_MIN_SLIVER_WIDTH)))
        width = availableWidth / visibleColumns
        left = majorLeft + 1.5 + (overlapIndex - 1) * width
        if (overlapIndex > visibleColumns) capHidden = true
      } else {
        left = majorLeft + 1.5
        width = dayWidth - 3
      }

      record.rowMeta.capHidden = capHidden

      record.rowMeta.style = {
        ...record.rowMeta.style,
        left: `${left}px`,
        width: `${width}px`,
        display,
      }
    }
  })

  // Dense "bands": within each day, group records that overlap in time into clusters and
  // capture each cluster's bounding box (its full start→end extent), size, busiest overlap,
  // and tallest card. The template overlays a band ONLY when its cards look empty/too small
  // to read — too thin (high overlap) OR too short (brief duration) — so readable cards in
  // the same day stay visible and interactive.
  interface Band {
    top: number
    bottom: number
    count: number
    maxOverlaps: number
    maxHeight: number
  }
  const denseBands: Array<Band & { dayIndex: number; height: number }> = []
  const recordsByDay = new Map<number, Row[]>()
  for (const record of recordsToDisplay) {
    if (record.rowMeta.style?.display === 'none') continue
    const dayIndex = record.rowMeta.dayIndex
    if (dayIndex == null) continue
    if (!recordsByDay.has(dayIndex)) recordsByDay.set(dayIndex, [])
    recordsByDay.get(dayIndex)!.push(record)
  }
  for (const [dayIndex, dayRecords] of recordsByDay) {
    dayRecords.sort((a, b) => parseFloat(`${a.rowMeta.style?.top ?? 0}`) - parseFloat(`${b.rowMeta.style?.top ?? 0}`))
    let band: Band | null = null
    const pushBand = (b: Band | null) => {
      if (b) denseBands.push({ ...b, dayIndex, height: b.bottom - b.top })
    }
    for (const record of dayRecords) {
      const top = parseFloat(`${record.rowMeta.style?.top ?? 0}`)
      const recHeight = parseFloat(`${record.rowMeta.style?.height ?? 0}`)
      const bottom = top + recHeight
      const overlaps = record.rowMeta.numberOfOverlaps ?? 1
      if (band && top < band.bottom) {
        band.bottom = Math.max(band.bottom, bottom)
        band.count += 1
        band.maxOverlaps = Math.max(band.maxOverlaps, overlaps)
        band.maxHeight = Math.max(band.maxHeight, recHeight)
      } else {
        pushBand(band)
        band = { top, bottom, count: 1, maxOverlaps: overlaps, maxHeight: recHeight }
      }
    }
    pushBand(band)
  }

  return {
    records: recordsToDisplay,
    gridTimeMap,
    spanningRecords: recordSpanningDays,
    denseBands,
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

  const ogStartDate = timezoneDayjs.timezonize(resizeRecord.value.row[fromCol.title])
  const ogEndDate = timezoneDayjs.timezonize(resizeRecord.value.row[toCol.title])

  const day = columnFromX(percentX * containerWidth.value)
  const minutes = Math.round((percentY * 24 * 60) / 15) * 15 // Round to nearest 15 minutes

  const baseDate = timezoneDayjs.timezonize(selectedDateRange.value.start).add(day, 'day').add(minutes, 'minute')

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
    newDate = null
  }

  if (!isValid || !newDate?.isValid()) return

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

  const day = Math.max(0, Math.min(maxVisibleDays.value - 1, columnFromX(percentX * containerWidth.value)))
  const hour = Math.max(0, Math.min(23, Math.floor(percentY * 24)))

  const minutes = Math.round(((percentY * 24 * 60) % 60) / 15) * 15

  const newStartDate = timezoneDayjs
    .timezonize(selectedDateRange.value.start)
    .add(day, 'day')
    .add(hour, 'hour')
    .add(minutes, 'minute')
  if (!newStartDate) return { newRow: null, updatedProperty: [] }

  let endDate
  const updatedProperty = [fromCol.title!]

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value.row,
      [fromCol.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
    },
  }

  if (toCol) {
    const fromDate = dragRecord.value.row[fromCol.title!] ? timezoneDayjs.timezonize(dragRecord.value.row[fromCol.title!]) : null
    const toDate = dragRecord.value.row[toCol.title!]
      ? timezoneDayjs.timezonize(dragRecord.value.row[toCol.title!])
      : fromDate?.clone()

    if (fromDate && toDate) {
      const newMinutes = Math.round(toDate.diff(fromDate, 'minute') / 15) * 15
      endDate = newStartDate.add(newMinutes, 'minute')
    } else if (fromDate && !toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    if (endDate.isBefore(newStartDate)) {
      endDate = newStartDate.clone().add(15, 'minutes')
    }

    newRow.row[toCol.title!] = timezoneDayjs.dayjsTz(endDate).format(updateFormat.value)
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

  // Drag-to-reschedule is gated to editable, non-synced ranges; click-to-expand
  // (onMouseUp below) must work regardless so synced records can be opened.
  const canDrag = isUIAllowed('dataEdit') && !isSyncedFromColumn.value && !record.rowMeta.range?.is_readonly

  if (canDrag) {
    dragTimeout.value = setTimeout(() => {
      isDragging.value = true
      while (!target.classList.contains('draggable-record')) {
        target = target.parentElement as HTMLElement
      }

      isDragging.value = true
      dragRecord.value = record

      document.addEventListener('mousemove', onDrag)
      document.addEventListener('mouseup', stopDrag)
    }, 200)
  }

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
    } = parseProp(data)

    // Not a valid record
    if (!record?.rowMeta) return

    if (record.rowMeta.range?.is_readonly) return

    dragRecord.value = record

    const { newRow, updatedProperty } = calculateNewRow(event, true)

    if (newRow) {
      updateRowProperty(newRow, updatedProperty, false)
      $e('c:calendar:day:drag-record')
    }
  }
}

// A cluster ("band") gets the Airtable-style "view all in day view" overlay (over just that
// cluster — readable cards elsewhere in the day stay clear) when its cards look empty/too
// small to read: either too THIN (busiest overlap shrinks card width below a readable px)
// or too SHORT (even its tallest card is briefer than a readable height).
const WEEK_READABLE_CARD_WIDTH = 36
const WEEK_READABLE_CARD_HEIGHT = 36
const isDenseBand = (band: { dayIndex: number; maxOverlaps: number; maxHeight: number }) => {
  const tooThin = band.maxOverlaps >= 2 && (columnWidthPx(band.dayIndex) - 3) / band.maxOverlaps < WEEK_READABLE_CARD_WIDTH
  // A lone card (maxOverlaps < 2) is never "dense" — only flag too-short when records actually
  // overlap, so a single short event stays readable/interactive instead of being covered by the overlay.
  const tooShort = band.maxOverlaps >= 2 && band.maxHeight > 0 && band.maxHeight < WEEK_READABLE_CARD_HEIGHT
  return tooThin || tooShort
}

// Below the readable width a sliver can't fit even a single letter or an ellipsis, so
// (Airtable-style) we render it as a blank colored block and skip the title/time
// entirely — these cards sit under the dense-cluster overlay, which reveals
// "view all events in day view" on hover.
const isCardTooThinToRender = (record: Row) => {
  const width = Number.parseFloat(`${record.rowMeta?.style?.width ?? ''}`)
  return !Number.isNaN(width) && width < WEEK_READABLE_CARD_WIDTH
}

// Clicking a dense-cluster overlay opens that day in the (readable) day view.
const openDayView = (date: dayjs.Dayjs) => {
  selectedDate.value = date
  activeCalendarView.value = 'day'
  $e('c:calendar:week:open-day-view')
}

const openDayViewForColumn = (dayIndex: number) => {
  const date = datesHours.value[dayIndex]?.[0]
  if (date) openDayView(date)
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const addRecord = (date: dayjs.Dayjs) => {
  if (!isUIAllowed('dataEdit') || !calendarRange.value || isSyncedTable.value) return
  const fromCol = calendarRange.value[0]?.fk_from_col
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
    if (dragRecord.value || resizeRecord.value) return
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
      v-if="!isPublic && timezoneDayjs.dayjsTz().isBetween(selectedDateRange.start, selectedDateRange.end)"
      class="absolute top-16 ml-16 pointer-events-none z-4"
      :class="{
        '!mt-38.5': isExpanded && isRangeEnabled,
        'mt-27': !isExpanded && isRangeEnabled,
        '!mt-6': !recordsAcrossAllRange.spanningRecords?.length,
      }"
      :style="overlayStyle"
    >
      <div class="flex w-full items-center">
        <span
          class="text-nc-content-inverted-primary bg-nc-content-brand rounded-md leading-3.5 font-bold text-xs pointer-events-auto p-0.5 cursor-pointer"
          @click="addRecord(timezoneDayjs.dayjsTz())"
        >
          {{ currTime.format(is12hrAxis ? 'hh:mm A' : 'HH:mm') }}
        </span>
        <div class="flex-1 relative ml-1 nc-calendar-border-line border-b-2 border-nc-border-brand"></div>
      </div>
    </div>
    <div class="flex sticky h-6 z-4 top-0 pl-16 bg-nc-bg-gray-extralight w-full">
      <div
        v-for="(date, index) in datesHours"
        :key="date[0].toISOString()"
        :class="{
          'text-nc-content-brand': date[0].isSame(timezoneDayjs.dayjsTz(), 'date'),
        }"
        :style="{ width: columnWidthPct(index) }"
        class="text-center text-[10px] font-semibold leading-4 flex items-center justify-center uppercase text-nc-content-gray-muted py-1 border-nc-border-gray-medium last:border-r-0 border-b-1 border-l-1 border-r-0 bg-nc-bg-gray-extralight"
      >
        {{ timezoneDayjs.dayjsTz(date[0]).format('DD ddd') }}
      </div>
    </div>
    <div
      :class="{
        'top-20.5': !isExpanded && isRangeEnabled,
        'top-32': isExpanded && isRangeEnabled,
        '!top-0': !recordsAcrossAllRange.spanningRecords?.length,
      }"
      class="absolute bg-nc-bg-default w-16 z-1"
    >
      <div
        v-for="(hour, index) in datesHours[0]"
        :key="index"
        class="h-13 first:mt-0 pt-7.1 nc-calendar-day-hour text-right pr-2 font-semibold text-xs text-nc-content-gray-muted py-1"
      >
        {{ hour.format(is12hrAxis ? 'hh a' : 'HH:00') }}
      </div>
    </div>
    <div
      v-if="isRangeEnabled && recordsAcrossAllRange.spanningRecords?.length"
      class="sticky top-6 nc-bg-default z-4 inset-x-0 w-full"
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
        :style="{ width: columnWidthPct(index) }"
        class="h-full mt-5.95"
        data-testid="nc-calendar-week-day"
      >
        <div
          v-for="(hour, hourIndex) in date"
          :key="hourIndex"
          :class="{
            'border-1 !border-nc-border-brand !bg-nc-bg-gray-light':
              hour.isSame(selectedTime, 'hour') && (hour.get('day') === 6 || hour.get('day') === 0),
            'selected-hour': hour.isSame(selectedTime, 'hour'),
            'bg-nc-bg-gray-extralight hover:nc-bg-gray-light': hour.get('day') === 0 || hour.get('day') === 6,
            'hover:bg-nc-bg-gray-extralight': hour.get('day') !== 0 && hour.get('day') !== 6,
          }"
          class="text-center relative transition h-13 text-sm text-nc-content-gray-muted w-full py-1 border-transparent border-1 border-x-nc-border-gray-light border-t-nc-border-gray-light border-l-nc-border-gray-light"
          data-testid="nc-calendar-week-hour"
          @dblclick="addRecord(hour)"
          @click="
            () => {
              selectedDate = hour
              selectedTime = hour
              dragRecord = null
            }
          "
        ></div>
      </div>

      <div
        class="absolute pointer-events-none z-2 inset-0 overflow-hidden !mt-5.95"
        data-testid="nc-calendar-week-record-container"
      >
        <template v-for="record in recordsAcrossAllRange.records" :key="record.rowMeta.id">
          <div
            v-if="record.rowMeta.style?.display !== 'none' && !record.rowMeta.capHidden"
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
                :clamp-lines="cardClampLines(record)"
                @resize-start="onResizeStart"
              >
                <template v-if="!isCardTooThinToRender(record)">
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
                </template>
                <template #tooltip>
                  <SmartsheetRecordFieldsTooltip :record="record" :fields="fields" />
                </template>
                <template #time>
                  <div v-if="!isCardTooThinToRender(record)" class="text-xs font-medium text-nc-content-gray-disabled">
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

      <!-- Dense-cluster overlay (Airtable-style): only the time band where cards shrink to
           unreadable slivers gets an overlay. Hovering it highlights that band and reveals a
           "View all N events in day view" pill (N = cluster size); clicking opens that day in
           the readable day view. Readable cards elsewhere in the day are left untouched. -->
      <div class="absolute inset-0 z-3 overflow-hidden !mt-5.95 pointer-events-none">
        <template v-for="(band, bandIndex) in recordsAcrossAllRange.denseBands" :key="`dense-${bandIndex}`">
          <div
            v-if="isDenseBand(band)"
            :style="{
              left: `${columnOffsetPx(band.dayIndex)}px`,
              width: `${columnWidthPx(band.dayIndex)}px`,
              top: `${band.top}px`,
              height: `${band.height}px`,
            }"
            class="nc-dense-day-overlay group absolute pointer-events-auto cursor-pointer flex items-center justify-center transition-colors"
            data-testid="nc-calendar-week-dense-overlay"
            @click="openDayViewForColumn(band.dayIndex)"
          >
            <span
              class="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gray-800 text-white text-xs font-semibold leading-4 rounded-md px-2 py-1 shadow-md text-center max-w-[92%] whitespace-normal"
            >
              {{ $t('tooltip.viewAllEventsInDayView', { count: band.count }) }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// Subtle highlight when hovering a dense day's "view all in day view" overlay; the thin
// slivers underneath stay faintly visible.
.nc-dense-day-overlay:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.prevent-select {
  -webkit-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.selected-hour {
  @apply relative !bg-nc-bg-brand;
}

.nc-calendar-border-line::after {
  @apply absolute bg-nc-content-brand w-0.5 h-3;
  content: '';
  top: -5px;
  bottom: -6px;
  left: 0px;
}
</style>
