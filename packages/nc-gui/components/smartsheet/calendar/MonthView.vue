<script lang="ts" setup>
import type dayjs from 'dayjs'
import { CalendarEventTheme, PermissionEntity, PermissionKey, UITypes } from 'nocodb-sdk'

const emit = defineEmits(['newRecord', 'expandRecord', 'recordContextMenu'])

const { isMobileMode } = useGlobal()

const {
  selectedDate,
  selectedMonth,
  selectedDateRange,
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
  timezoneDayjs,
  isSyncedFromColumn,
  isAddDeleteInlineEnabled,
  weeksInRange,
  isMultiWeekRange,
  recordHeightMode,
  eventDisplayTheme,
  calendarMetaData,
} = useCalendarViewStoreOrThrow()

// Interface editor: a date/"+"/dblclick selects the calendar element (opens
// `Page › Calendar`) instead of highlighting the date or adding a record. Null in
// the published view and outside interface pages, so the calendar stays live.
const interfaceEditSelect = inject(InterfaceVizEditSelectInj, ref<(() => void) | null>(null))

// Flat themes (dot / minimal / pill) render a single text line, so they stack
// tighter than the bordered / solid chip themes (which keep the taller chip).
const isCompactRowTheme = computed(() =>
  [CalendarEventTheme.DOT, CalendarEventTheme.MINIMAL, CalendarEventTheme.PILL].includes(eventDisplayTheme.value),
)

// Interface pages render the chips at 24px (12px text) — the lane math follows.
const interfacePageDataApi = inject(InterfacePageDataInj, undefined)

// Per-record lane height (px) — drives both stacking offsets and the lane cap.
// Kept in sync with the card height in RecordCard.vue (24px in interfaces —
// see the VizWrapper gutter overrides).
const perRecordHeightPx = computed(() => (isCompactRowTheme.value ? 22 : interfacePageDataApi ? 24 : 28))

// The calendar range (start/end date) columns are already represented by the
// event's time prefix + grid position, so rendering them again in the card body
// is pure duplication (the old "• 2026-06-05 08:00 • …" noise). Exclude them so
// the card defaults to a clean title line for every theme.
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

const isMondayFirst = ref(true)

const { isUIAllowed } = useRoles()

// Interface pages provide ReadonlyInj when the viz's edit_inline opt-in is
// OFF — event drag/resize must honor it like grid cells do. Plain data-app
// trees never provide it (fallback false → behavior unchanged).
const isCalendarCellReadonly = inject(ReadonlyInj, ref(false))

const canEditCalendarData = computed(() => isUIAllowed('dataEdit') && !isCalendarCellReadonly.value)

const meta = inject(MetaInj, ref())

// Viewport-bounded calendar body height (provided by calendar/index.vue). Used as the
// compact (minimum) week-row height in Expanded mode.
const calendarBodyHeight = inject<Ref<number>>('calendarBodyHeight', ref(0))

const maxVisibleDays = computed(() => {
  // Hide weekends → 5 columns; honoured for the month layout AND the multi-week
  // (2/6-week) ranges. Each row is still a full week, so the Mon-Fri columns line
  // up across rows.
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

// --- Collapsed-weekend column model -----------------------------------------
// When collapse_weekend is on (and weekends aren't hidden), Sat & Sun render in
// narrower columns. All event positioning here is px-based, so instead of a
// uniform per-column width we expose a per-column width/offset model. When not
// collapsed these helpers return the original uniform values, so the show /
// hide-weekend layouts are unchanged.
const WEEKEND_COLLAPSE_RATIO = 0.5

const isWeekendCollapsed = computed(() => !!viewMetaProperties.value?.collapse_weekend && maxVisibleDays.value === 7)

// Column weights in render order (Mon-first or Sun-first). Weekend columns shrink
// to WEEKEND_COLLAPSE_RATIO only while collapsed; otherwise every column is equal.
const columnWeights = computed<number[]>(() => {
  const weekendCols = isMondayFirst.value ? [5, 6] : [0, 6]
  return Array.from({ length: 7 }, (_, i) => (isWeekendCollapsed.value && weekendCols.includes(i) ? WEEKEND_COLLAPSE_RATIO : 1))
})

const totalColumnWeight = computed(() => columnWeights.value.reduce((sum, w) => sum + w, 0))

const columnWidth = (index: number) => {
  if (!isWeekendCollapsed.value) return gridContainerWidth.value / maxVisibleDays.value
  return (gridContainerWidth.value * columnWeights.value[index]) / totalColumnWeight.value
}

const columnOffset = (index: number) => {
  if (!isWeekendCollapsed.value) return index * (gridContainerWidth.value / maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < index; i++) offset += columnWidth(i)
  return offset
}

// Map a horizontal pixel position (within the grid) to a column index (0-6).
const columnFromX = (x: number) => {
  if (!isWeekendCollapsed.value) return Math.floor((x / gridContainerWidth.value) * maxVisibleDays.value)
  let offset = 0
  for (let i = 0; i < 7; i++) {
    offset += columnWidth(i)
    if (x < offset) return i
  }
  return 6
}

// grid-template-columns string for the collapsed layout (header + week rows);
// undefined when not collapsed so the grid-cols-* utility class takes over.
const gridTemplateColumns = computed(() =>
  isWeekendCollapsed.value ? columnWeights.value.map((w) => `${w}fr`).join(' ') : undefined,
)

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

// Interface calendars split card LABELS from tooltip fields: `label_field_ids`
// picks what renders ON the chip (absent → display value only), while the
// injected visible fields keep driving the hover tooltip. Data tab: unchanged
// (chips render the visible fields).
const interfaceCalendarMeta = computed(() => (interfacePageDataApi ? parseProp(calendarMetaData.value?.meta) : undefined))

const cardFields = computed(() => {
  if (!interfacePageDataApi) return fields.value ?? []

  const metaColumns = (meta.value?.columns ?? []) as ColumnType[]
  const labelIds: string[] = interfaceCalendarMeta.value?.label_field_ids ?? []
  if (labelIds.length) return metaColumns.filter((c) => labelIds.includes(c.id as string))

  const displayValue = metaColumns.find((c) => c.pv)
  return displayValue ? [displayValue] : []
})

const labelImageColumn = computed(() => {
  const id = interfaceCalendarMeta.value?.label_image_field_id
  return id ? ((meta.value?.columns ?? []) as ColumnType[]).find((c) => c.id === id) : undefined
})

/** First attachment of the label-image field — the chip's right-edge thumbnail. */
function recordLabelAttachment(record: Row) {
  const column = labelImageColumn.value
  if (!column?.title) return null

  try {
    const raw = record.row[column.title]
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) && parsed.length ? parsed.flat()[0] : null
  } catch {
    return null
  }
}

const calendarData = computed(() => {
  // startOf and endOf dayjs is bugged with timezone
  const firstDayOffset = isMondayFirst.value ? 0 : -1
  const today = timezoneDayjs.timezonize()

  let firstDayToDisplay: dayjs.Dayjs
  let weeksNeeded: number

  if (isMultiWeekRange.value) {
    // 2-week / 6-week grids anchor to the Monday of the selected week and
    // always render a fixed number of full weeks. The 6-week range maxes the
    // backend's 42-day calendar fetch window exactly — don't extend further
    // without also raising the limit in calendar-datas.service.ts.
    firstDayToDisplay = timezoneDayjs.timezonize(selectedDateRange.value.start.startOf('week')).add(firstDayOffset, 'day')
    weeksNeeded = weeksInRange.value
  } else {
    const startOfMonth = timezoneDayjs.timezonize(selectedMonth.value.startOf('month'))
    firstDayToDisplay = timezoneDayjs.timezonize(startOfMonth.startOf('week')).add(firstDayOffset, 'day')
    const daysInMonth = startOfMonth.daysInMonth()
    const firstDayOfMonth = startOfMonth.day()
    const adjustedFirstDay = isMondayFirst.value ? (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1) : firstDayOfMonth
    weeksNeeded = Math.ceil((daysInMonth + adjustedFirstDay) / 7)
  }

  return {
    weeks: Array.from({ length: weeksNeeded }, (_, weekIndex) => ({
      weekIndex,
      days: Array.from({ length: 7 }, (_, dayIndex) => {
        const day = firstDayToDisplay.add(weekIndex * 7 + dayIndex, 'day')

        return {
          date: day,
          key: `${weekIndex}-${dayIndex}`,
          isWeekend: day.get('day') === 0 || day.get('day') === 6,
          isToday: day.isSame(today, 'date'),
          // For multi-week grids every cell is "in range" — the layout itself
          // is bounded to the visible window, so we don't fade non-month days.
          isInPagedMonth: isMultiWeekRange.value ? true : day.isSame(selectedMonth.value, 'month'),
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

// --- Compact / Expanded record height ---------------------------------------
// Compact (default): the grid fits the viewport and surplus records collapse into a
// "+N more" popover per day. Expanded: lanes are uncapped and the grid grows so every
// record is visible, scrolling the page instead.
const isExpanded = computed(() => recordHeightMode.value === 'expanded')

const recordsToDisplay = computed<{
  records: Row[]
  count: {
    [p: string]: { overflow: boolean; count: number; overflowCount: number; overflowRecords: Array<Row>; lanes?: boolean[] }
  }
}>(() => {
  if (!calendarData.value || !calendarRange.value) return { records: [], count: {} }

  const perHeight = gridContainerHeight.value / calendarData.value.weeks.length
  const perRecordHeight = perRecordHeightPx.value

  // Interfaces run tighter type (12px chips) — the date→first-record inset follows.
  const spaceBetweenRecords = interfacePageDataApi ? 22 : 27
  // Expanded: never cap lanes — every record gets a lane (no "+N more"), and the grid
  // grows to fit (see expandedGridHeightPx). Compact: derive the cap from the row height.
  // Interfaces cap on the REAL render pitch (+4) — the Data tab's +8 reserve
  // left a whole visible lane unused with the tighter 24px chips.
  const laneCapPitch = perRecordHeight + (interfacePageDataApi ? 4 : 8)
  // The "+N more" badge is bottom-anchored inside each day cell (23px xxsmall button +
  // 4px `bottom-1` inset), while the record overlay renders ~8px lower than the cells
  // (`mt-8` vs the ~24px weekday header). The Data tab's +8 cap pitch accrues enough
  // slack under the last lane to keep that band clear, but capping interfaces on the
  // exact render pitch left zero slack — the last lane and the badge shared the same
  // vertical band. Reserve the badge row in the interface cap: 23px badge + 8px overlay
  // downshift (the badge's 4px inset is covered by the last lane's trailing 4px gap).
  const overflowRowReserve = interfacePageDataApi ? 31 : 0
  // Always allow at least one lane. `perHeight` is `gridHeight / weeksInMonth`,
  // so a 6-week month (e.g. Aug 2026 — starts on a Saturday) makes each row
  // shorter; in the tighter interface layout (larger `overflowRowReserve`) the
  // floor can hit 0, which sends EVERY record to overflow and renders zero chips
  // (empty cells behind a "+N more" badge). A day cell must always show its
  // first record before overflowing.
  const maxLanes = isExpanded.value
    ? Infinity
    : Math.max(1, Math.floor((perHeight - spaceBetweenRecords - overflowRowReserve) / laneCapPitch))

  // Track records and lanes for each day
  const recordsInDay: {
    [key: string]: {
      overflow: boolean
      count: number
      overflowCount: number
      lanes: boolean[]
      overflowRecords: Array<Row>
    }
  } = {}

  const findAvailableLane = (dateKey: string, duration = 1): number => {
    if (!recordsInDay[dateKey]) {
      recordsInDay[dateKey] = { overflow: false, count: 0, overflowCount: 0, lanes: [], overflowRecords: [] }
    }

    const { lanes } = recordsInDay[dateKey]
    for (let i = 0; i < maxLanes; i++) {
      if (!lanes[i]) {
        // Check if the lane is available for the entire duration
        let isAvailable = true
        for (let j = 0; j < duration; j++) {
          const checkDate = timezoneDayjs.dayjsTz(dateKey).add(j, 'day').format('YYYY-MM-DD')
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
      const occupyDate = timezoneDayjs.dayjsTz(dateKey).add(i, 'day').format('YYYY-MM-DD')
      if (!recordsInDay[occupyDate]) {
        recordsInDay[occupyDate] = { overflow: false, count: 0, overflowCount: 0, lanes: [], overflowRecords: [] }
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
          const fromDate = record.row[startCol.title!] ? timezoneDayjs.timezonize(record.row[startCol.title!]) : null
          const toDate = record.row[endCol.title!] ? timezoneDayjs.timezonize(record.row[endCol.title!]) : null
          // If either date is missing, treat as single-day event using the available date
          if (fromDate && !toDate) return true
          if (!fromDate && toDate) return true
          return fromDate && toDate && !toDate.isBefore(fromDate)
        } else if (startCol && !endCol) {
          const fromDate = record.row[startCol!.title!] ? timezoneDayjs.timezonize(record.row[startCol!.title!]) : null
          return !!fromDate
        }
        return false
      })
      .sort((a, b) => {
        const aStart = a.row[startCol.title!] ? timezoneDayjs.timezonize(a.row[startCol.title!]) : null
        const aEnd = endCol && a.row[endCol.title!] ? timezoneDayjs.timezonize(a.row[endCol.title!]) : null
        const bStart = b.row[startCol.title!] ? timezoneDayjs.timezonize(b.row[startCol.title!]) : null
        const bEnd = endCol && b.row[endCol.title!] ? timezoneDayjs.timezonize(b.row[endCol.title!]) : null

        const aSpan = aStart && aEnd ? aEnd.diff(aStart) : 0
        const bSpan = bStart && bEnd ? bEnd.diff(bStart) : 0

        // Multi-day (spanning) events are laid out first, longest first, so they
        // occupy continuous lanes across day cells. Events that start and end on
        // the same day are then ordered by start time within their day.
        const aMultiDay = !!(aStart && aEnd) && !aEnd.isSame(aStart, 'day')
        const bMultiDay = !!(bStart && bEnd) && !bEnd.isSame(bStart, 'day')
        if (aMultiDay !== bMultiDay) return aMultiDay ? -1 : 1
        if (aMultiDay && bMultiDay) return bSpan - aSpan
        if (aStart && bStart) return aStart.diff(bStart)
        return 0
      })

    sortedFormattedData.forEach((record: Row) => {
      if (!endCol && startCol) {
        // If there is no end date, we just display the record on the start date
        const startDate = timezoneDayjs.timezonize(record.row[startCol.title!])
        const dateKey = startDate.format('YYYY-MM-DD')

        const id = record.rowMeta.id ?? generateRandomNumber()

        const lane = findAvailableLane(dateKey)
        if (lane === -1) {
          recordsInDay[dateKey].overflow = true
          recordsInDay[dateKey].overflowCount++
          record.rowMeta.id = id
          record.rowMeta.range = range
          recordsInDay[dateKey].overflowRecords.push(record)
          return // Skip this record as there's no available lane
        }

        occupyLane(dateKey, lane)

        const weekIndex = calendarData.value.weeks.findIndex((week) => week.days.some((day) => day.date.isSame(startDate, 'day')))
        const dayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) => day.date.isSame(startDate, 'day'))

        const isRecordDraggingOrResizeState = id === draggingId.value || id === resizeRecord.value?.rowMeta.id

        const style: Partial<CSSStyleDeclaration> = {
          left: `${columnOffset(dayIndex)}px`,
          width: `${columnWidth(dayIndex)}px`,
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
            // Week index + within-row offset, so Expanded can re-derive `top` from the
            // variable per-week row heights (see positionedRecords).
            weekRowIndex: weekIndex,
            withinRowTop: isRecordDraggingOrResizeState ? 0 : spaceBetweenRecords + lane * (perRecordHeight + 4),
          },
        })
      } else if (startCol && endCol) {
        // Multi-day event logic
        // If either date is missing, treat as single-day event using the available date
        let startDate = record.row[startCol.title!]
          ? timezoneDayjs.timezonize(record.row[startCol.title!])
          : record.row[endCol.title!]
          ? timezoneDayjs.timezonize(record.row[endCol.title!])
          : null
        if (!startDate) return

        const endDate = record.row[endCol.title!] ? timezoneDayjs.timezonize(record.row[endCol.title!]) : startDate

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

          if (maxVisibleDays.value === 5 && [0, 6].includes(startDate.day())) {
            currentWeekStart = timezoneDayjs.timezonize(currentWeekStart.add(1, 'week'))
            continue
          }

          if (recordEnd.isBefore(calendarData.value.weeks[0].days[0].date)) {
            currentWeekStart = timezoneDayjs.timezonize(currentWeekStart.add(1, 'week'))
            continue
          }

          const duration = recordEnd.diff(recordStart, 'day') + 1

          const dateKey = recordStart.format('YYYY-MM-DD')
          const lane = findAvailableLane(dateKey, duration)

          if (lane === -1) {
            record.rowMeta.id = id
            record.rowMeta.range = range

            for (let i = 0; i < duration; i++) {
              const overflowDate = recordStart.add(i, 'day').format('YYYY-MM-DD')
              if (recordsInDay[overflowDate]) {
                recordsInDay[overflowDate].overflow = true
                recordsInDay[overflowDate].overflowCount++
                recordsInDay[overflowDate].overflowRecords.push(record)
              }
            }
            currentWeekStart = currentWeekStart.add(1, 'week')
            continue
          }

          occupyLane(dateKey, lane, duration)

          const weekIndex = calendarData.value.weeks.findIndex((week) =>
            week.days.some((day) => day.date.isSame(recordStart, 'day')),
          )

          const startDayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) => day.date.isSame(recordStart, 'day'))

          const endDayIndex = calendarData.value.weeks[weekIndex]?.days.findIndex((day) => day.date.isSame(recordEnd, 'day'))

          const isRecordDraggingOrResizeState = id === draggingId.value || id === resizeRecord.value?.rowMeta.id

          const style: Partial<CSSStyleDeclaration> = {
            left: `${columnOffset(startDayIndex) - 0.5}px`,
            width: `${columnOffset(endDayIndex) + columnWidth(endDayIndex) - columnOffset(startDayIndex)}px`,
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
            ? calendarData.value.weeks[weekIndex - 1].days[0].date.isBefore(recordStart, 'month')
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
              weekRowIndex: weekIndex,
              withinRowTop: isRecordDraggingOrResizeState ? perRecordHeight : spaceBetweenRecords + lane * (perRecordHeight + 4),
            },
          })
          recordIndex++
          currentWeekStart = timezoneDayjs.timezonize(currentWeekStart.add(1, 'week'))
        }
      }
    })
  })

  return {
    records: recordsToDisplay,
    count: recordsInDay,
  }
})

// --- Expanded per-week row heights ------------------------------------------
// Each week row grows to fit its OWN busiest day (lanes), with a floor of the compact
// row height, so empty weeks stay compact and busy weeks expand.
const RECORD_GAP = 8 // matches the compact maxLanes spacing (perRecordHeight + 8)

const ROW_TOP_PADDING = 27 // spaceBetweenRecords — date number + top gap

const ROW_BOTTOM_PADDING = 8

const WEEKDAY_HEADER_PX = 26 // the weekday header grid above the week rows (~1.59rem)

// Compact row height = the viewport-fit height a row gets in Compact mode. Used as the
// minimum row height in Expanded so sparse weeks don't collapse.
const compactRowHeight = computed(() => {
  const weeks = calendarData.value?.weeks.length || 1
  const available = Math.max(0, calendarBodyHeight.value - WEEKDAY_HEADER_PX)
  return available > 0 ? available / weeks : 120
})

// Max lanes used in each week (its busiest day). Looked up via the same date key the
// template uses for the overflow popover, so it stays consistent.
const perWeekLanes = computed(() => {
  const count = recordsToDisplay.value.count
  return (calendarData.value?.weeks ?? []).map((week) => {
    let max = 0
    for (const day of week.days) {
      const lanes = count[day.date.format('YYYY-MM-DD')]?.lanes?.length ?? 0
      if (lanes > max) max = lanes
    }
    return max
  })
})

const perWeekHeights = computed(() =>
  perWeekLanes.value.map((lanes) =>
    // Use the theme-aware lane height so expanded rows track the same density
    // as compact (flat themes pack tighter — see perRecordHeightPx).
    Math.max(compactRowHeight.value, ROW_TOP_PADDING + lanes * (perRecordHeightPx.value + RECORD_GAP) + ROW_BOTTOM_PADDING),
  ),
)

// Cumulative top offset of each week row (relative to the grid top).
const weekRowTops = computed(() => {
  const tops: number[] = []
  let acc = 0
  for (const h of perWeekHeights.value) {
    tops.push(acc)
    acc += h
  }
  return tops
})

// Grid container style. Compact keeps the original viewport-fit height and splits it into
// N equal week rows (driven by the week count, so any custom-week count 1–6 gets uniform
// fixed rows — not just the enumerated 2/5/6 of month/2week/6week, which left 1/3/4-week
// custom grids with content-sized rows that reflow on hover). Expanded sets explicit
// per-week row tracks (variable heights) and grows the grid to their sum.
const gridContainerStyle = computed(() => {
  if (!isExpanded.value) {
    return {
      height: 'calc(100% - 1.59rem)',
      gridTemplateRows: `repeat(${calendarData.value?.weeks.length || 1}, minmax(0, 1fr))`,
    }
  }
  return {
    minHeight: 'calc(100% - 1.59rem)',
    gridTemplateRows: perWeekHeights.value.map((h) => `${h}px`).join(' '),
  }
})

// Records with their `top` re-derived from the variable per-week row heights. In Compact
// the records already carry the correct uniform `top`, so they pass through unchanged.
const positionedRecords = computed<Row[]>(() => {
  const recs = recordsToDisplay.value.records
  if (!isExpanded.value) return recs
  return recs.map((r) => {
    const wi = (r.rowMeta as { weekRowIndex?: number }).weekRowIndex ?? 0
    const within = (r.rowMeta as { withinRowTop?: number }).withinRowTop ?? 0
    return {
      ...r,
      rowMeta: {
        ...r.rowMeta,
        style: { ...r.rowMeta.style, top: `${(weekRowTops.value[wi] ?? 0) + within}px` },
      },
    }
  })
})

// Expanded row-height grows the grid to fit every lane, so a dense day would mount hundreds of DOM
// nodes and lag the tab. Render only the records whose vertical band is within the scrolled
// viewport (the grid height is set by CSS gridTemplateRows, so the scroll range is unaffected).
const calendarScrollContainer = inject<Ref<HTMLElement | undefined>>('calendarScrollContainer', ref())

const visibleRecords = useCalendarWindow(calendarScrollContainer, positionedRecords, {
  alwaysInclude: (record) =>
    record.rowMeta.id === dragRecord.value?.rowMeta.id || record.rowMeta.id === resizeRecord.value?.rowMeta.id,
})

// Map a vertical pixel offset (within the grid) to a week index — honours the variable
// per-week row heights in Expanded; falls back to uniform division in Compact.
const weekFromY = (y: number) => {
  const weeks = calendarData.value?.weeks.length || 1
  if (!isExpanded.value) {
    return Math.max(0, Math.min(weeks - 1, Math.floor((y / (gridContainerHeight.value || 1)) * weeks)))
  }
  for (let i = 0; i < perWeekHeights.value.length; i++) {
    if (y < weekRowTops.value[i] + perWeekHeights.value[i]) return i
  }
  return weeks - 1
}

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

  const fromCol = dragRecord.value?.rowMeta.range?.fk_from_col
  const toCol = dragRecord.value?.rowMeta.range?.fk_to_col

  if (!fromCol) return { newRow: null, updateProperty: [] }

  const week = weekFromY(Math.max(0, Math.min(height, relativeY)))
  const day = columnFromX(percentX * gridContainerWidth.value)

  let newStartDate = calendarData.value.weeks[week] ? calendarData.value.weeks[week].days[day]?.date : null

  if (!newStartDate) return { newRow: null, updateProperty: [] }

  let fromDate = timezoneDayjs.timezonize(dragRecord.value.row[fromCol.title!])
  if (!fromDate.isValid()) {
    fromDate = timezoneDayjs.dayjsTz()
  }

  newStartDate = newStartDate.add(fromDate.hour(), 'hour').add(fromDate.minute(), 'minute').add(fromDate.second(), 'second')

  let endDate

  const newRow = {
    ...dragRecord.value,
    row: {
      ...dragRecord.value?.row,
      [fromCol!.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
    },
  }

  const updateProperty = [fromCol!.title!]

  if (toCol) {
    const fromDate = dragRecord.value?.row[fromCol!.title!]
      ? timezoneDayjs.timezonize(dragRecord.value.row[fromCol!.title!])
      : null
    const toDate = dragRecord.value?.row[toCol!.title!] ? timezoneDayjs.timezonize(dragRecord.value?.row[toCol!.title!]) : null

    if (fromDate && toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).add(toDate.diff(fromDate, 'day'), 'day')
    } else if (fromDate && !toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
    } else if (!fromDate && toDate) {
      endDate = timezoneDayjs.dayjsTz(newStartDate).endOf('day')
    } else {
      endDate = newStartDate.clone()
    }

    newRow.row[toCol!.title!] = timezoneDayjs.dayjsTz(endDate).format(updateFormat.value)
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
  if (!canEditCalendarData.value || !dragRecord.value) return

  calculateNewRow(event, false)
}

const useDebouncedRowUpdate = useDebounceFn((row: Row, updateProperty: string[], isDelete: boolean) => {
  updateRowProperty(row, updateProperty, isDelete)
}, 500)

const onResize = (event: MouseEvent) => {
  if (!canEditCalendarData.value || !resizeRecord.value) return

  const { top, height, width, left } = calendarGridContainer.value.getBoundingClientRect()

  const relativeY = event.clientY - top - window.scrollY
  const percentX = (event.clientX - left - window.scrollX) / width

  const ogEndDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_to_col!.title!]
  const ogStartDate = resizeRecord.value.row[resizeRecord.value.rowMeta!.range!.fk_from_col!.title!]

  const fromCol = resizeRecord.value.rowMeta.range?.fk_from_col
  const toCol = resizeRecord.value.rowMeta.range?.fk_to_col

  const week = weekFromY(Math.max(0, Math.min(height, relativeY)))
  const day = columnFromX(percentX * gridContainerWidth.value)

  let updateProperty: string[] = []
  let newRow: Row

  if (resizeDirection.value === 'right') {
    let newEndDate = calendarData.value.weeks[week] ? calendarData.value.weeks[week].days[day].date.endOf('day') : null
    updateProperty = [toCol!.title!]

    if (timezoneDayjs.dayjsTz(newEndDate).isBefore(ogStartDate)) {
      newEndDate = timezoneDayjs.dayjsTz(ogStartDate).clone().endOf('day')
    }

    if (!newEndDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [toCol!.title!]: timezoneDayjs.dayjsTz(newEndDate).format(updateFormat.value),
      },
    }
  } else {
    let newStartDate = calendarData.value.weeks[week] ? calendarData.value.weeks[week].days[day]?.date : null
    updateProperty = [fromCol!.title!]

    if (!newStartDate) return

    if (timezoneDayjs.dayjsTz(newStartDate).isAfter(ogEndDate)) {
      newStartDate = timezoneDayjs.dayjsTz(ogEndDate).clone()
    }
    if (!newStartDate) return

    newRow = {
      ...resizeRecord.value,
      row: {
        ...resizeRecord.value.row,
        [fromCol!.title!]: timezoneDayjs.dayjsTz(newStartDate).format(updateFormat.value),
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
  if (event.button !== 0) return
  if (!canEditCalendarData.value || draggingId.value) return

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
  if (!canEditCalendarData.value || !dragRecord.value || !isDragging.value) return
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
  // Right/middle-click never drags — it opens the record context menu (or the browser's).
  if (event.button !== 0) return
  if (resizeInProgress.value || !record.rowMeta.id) return
  let target = event.target as HTMLElement
  isDragging.value = false

  // Drag-to-reschedule is only available on editable, non-synced, non-readonly
  // ranges. Click-to-expand (registered via onMouseUp below) must work regardless,
  // otherwise records on synced tables (readonly date column) can't be opened.
  const canDrag = canEditCalendarData.value && !isSyncedFromColumn.value && !record.rowMeta.range?.is_readonly

  if (canDrag) {
    dragTimeout.value = setTimeout(() => {
      isDragging.value = true

      while (!target.classList.contains('draggable-record')) {
        target = target.parentElement as HTMLElement
      }

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
  }

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
  if (!canEditCalendarData.value) return
  event.preventDefault()
  const data = event.dataTransfer?.getData('text/plain')
  if (data) {
    const {
      record,
      isWithoutDates,
    }: {
      record: Row
      isWithoutDates: boolean
    } = parseProp(data)

    // Not a valid record
    if (!record?.rowMeta) return

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
  if (interfaceEditSelect.value) return interfaceEditSelect.value()
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
  return timezoneDayjs.dayjsTz(date).isSame(selectedDate.value, 'day')
}

// TODO: Add Support for multiple ranges when multiple ranges are supported
const addRecord = (date: dayjs.Dayjs) => {
  if (interfaceEditSelect.value) return interfaceEditSelect.value()
  if (!isUIAllowed('dataEdit') || !isAddDeleteInlineEnabled.value || !calendarRange.value || isSyncedTable.value) return
  const fromCol = calendarRange.value[0]?.fk_from_col
  if (!fromCol) return
  const newRecord = {
    row: {
      [fromCol.title!]: date.format(updateFormat.value),
    },
  }
  emit('newRecord', newRecord)
}

const addRecordWithRange = (range: any, date: dayjs.Dayjs) => {
  if (interfaceEditSelect.value) return interfaceEditSelect.value()
  if (!isUIAllowed('dataEdit') || !isAddDeleteInlineEnabled.value || isSyncedTable.value) return
  const record = {
    row: {
      [range.fk_from_col!.title!]: date.format(updateFormat.value),
      ...(range.fk_to_col
        ? {
            [range.fk_to_col!.title!]: date.endOf('day').format(updateFormat.value),
          }
        : {}),
    },
  }
  emit('newRecord', record)
}
</script>

<template>
  <div
    v-if="calendarRange"
    class="prevent-select relative"
    :class="isExpanded ? 'min-h-full' : 'h-full'"
    data-testid="nc-calendar-month-view"
  >
    <div
      class="grid"
      :class="{
        'grid-cols-7': maxVisibleDays === 7,
        'grid-cols-5': maxVisibleDays === 5,
      }"
      :style="gridTemplateColumns ? { gridTemplateColumns } : undefined"
    >
      <div
        v-for="(day, index) in days"
        :key="index"
        class="nc-calendar-weekday-label text-center bg-nc-bg-gray-extralight py-1 border-r-1 last:border-r-0 border-nc-border-gray-light font-semibold leading-4 uppercase text-[10px] text-nc-content-gray-muted"
      >
        {{ day }}
      </div>
    </div>
    <div ref="calendarGridContainer" class="grid" :style="gridContainerStyle" @drop="dropEvent">
      <div
        v-for="week in calendarData.weeks"
        :key="week.weekIndex"
        :class="calendarData.gridClass"
        :style="gridTemplateColumns ? { gridTemplateColumns } : undefined"
        data-testid="nc-calendar-month-week"
      >
        <template v-for="(day, i) in week.days">
          <div
            v-if="day.isVisible"
            :key="day.key"
            :class="{
              'selected-date': isDateSelected(day.date) || (focusedDate && day.date.isSame(focusedDate, 'day')),
              '!text-nc-content-gray-disabled': !day.isInPagedMonth,
              '!bg-nc-bg-gray-extralight !hover:bg-nc-bg-gray-light !border-nc-border-gray-medium': day.isWeekend,
              '!border-r-nc-border-gray-medium': week.days[i + 1]?.isWeekend,
              'border-t-1': week.weekIndex === 0,
            }"
            class="text-right relative group last:border-r-0 bg-nc-bg-default transition text-sm h-full border-r-1 border-b-1 border-nc-border-gray-light font-medium hover:bg-nc-bg-gray-extralight text-nc-content-gray-default bg-nc-bg-default"
            data-testid="nc-calendar-month-day"
            @click="selectDate(day.date)"
            @dblclick="addRecord(day.date)"
          >
            <div
              v-if="canEditCalendarData || (isUIAllowed('dataEdit') && isAddDeleteInlineEnabled)"
              class="flex justify-between p-1"
            >
              <span
                :class="{
                  'block group-hover:hidden':
                    isAddDeleteInlineEnabled &&
                    !isDateSelected(day.date) &&
                    [UITypes.DateTime, UITypes.Date].includes(calDataType),
                  'hidden':
                    isAddDeleteInlineEnabled &&
                    isDateSelected(day.date) &&
                    [UITypes.DateTime, UITypes.Date].includes(calDataType),
                }"
              ></span>

              <NcDropdown v-if="isAddDeleteInlineEnabled && calendarRange.length > 1 && !isSyncedFromColumn" auto-close>
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
                    <NcMenuItem> {{ $t('labels.selectDateFieldToAdd') }} </NcMenuItem>
                    <NcMenuItem
                      v-for="(range, index) in calendarRange"
                      :key="index"
                      class="text-nc-content-gray-default font-semibold text-sm"
                      @click="addRecordWithRange(range, day.date)"
                    >
                      <div class="flex items-center gap-1">
                        <LazySmartsheetHeaderIcon :column="range.fk_from_col" />

                        <span class="ml-1">{{ range.fk_from_col!.title }}</span>
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>

              <PermissionsTooltip
                v-else-if="
                  isAddDeleteInlineEnabled && [UITypes.DateTime, UITypes.Date].includes(calDataType) && !isSyncedFromColumn
                "
                :entity="PermissionEntity.TABLE"
                :entity-id="meta?.id"
                :permission="PermissionKey.TABLE_RECORD_ADD"
              >
                <template #default="{ isAllowed }">
                  <NcButton
                    :class="{
                      '!block': isDateSelected(day.date),
                      '!hidden': !isDateSelected(day.date),
                    }"
                    class="!group-hover:block !w-6 !h-6 !rounded"
                    size="xsmall"
                    type="secondary"
                    :disabled="!isAllowed"
                    @click="addRecordWithRange(calendarRange[0], day.date)"
                  >
                    <component :is="iconMap.plus" />
                  </NcButton>
                </template>
              </PermissionsTooltip>
              <span
                :class="{
                  'bg-nc-bg-brand text-nc-content-brand !font-bold': day.isToday,
                }"
                class="nc-calendar-day-label px-1.3 py-1 text-[13px] text-sm leading-3 font-medium rounded-lg"
              >
                {{ day.dayNumber }}
              </span>
            </div>
            <div
              v-if="!(canEditCalendarData || (isUIAllowed('dataEdit') && isAddDeleteInlineEnabled))"
              class="leading-3 text-[13px] p-3"
            >
              {{ day.dayNumber }}
            </div>

            <NcDropdown
              v-if="
                recordsToDisplay.count[day.date.format('YYYY-MM-DD')] &&
                recordsToDisplay.count[day.date.format('YYYY-MM-DD')]?.overflow &&
                !draggingId
              "
              :trigger="isMobileMode ? [] : ['click']"
            >
              <NcButton
                v-e="`['c:calendar:month-view-more']`"
                class="!absolute bottom-1 right-1 text-center min-w-4.5 mx-auto z-3 text-nc-content-gray-muted"
                :class="{
                  // Interfaces can render narrow day columns (collapsed weekends in a
                  // small viz) — clamp the badge to its own cell so it can't spill
                  // across the border and collide with the neighbouring day's badge.
                  'max-w-[calc(100%_-_8px)] overflow-hidden': !!interfacePageDataApi,
                }"
                size="xxsmall"
                type="secondary"
                @click="viewMore(day.date)"
              >
                <span class="text-xs px-1"> + {{ recordsToDisplay.count[day.date.format('YYYY-MM-DD')]?.overflowCount }} </span>
              </NcButton>

              <template #overlay>
                <div class="bg-nc-bg-default px-4 gap-3 flex flex-col py-4 max-h-70 overflow-y-auto">
                  <LazySmartsheetCalendarSideRecordCard
                    v-for="(record, idx) in recordsToDisplay.count[day.date.format('YYYY-MM-DD')]?.overflowRecords"
                    :key="idx"
                    :draggable="false"
                    class="w-64"
                    :invalid="false"
                    :row="record"
                    data-testid="nc-sidebar-record-card"
                    @click="emit('expandRecord', record)"
                  >
                    <template v-if="!isRowEmpty(record, displayField)">
                      <LazySmartsheetPlainCell v-model="record.row[displayField!.title!]" :column="displayField" />
                    </template>
                    <template v-else-if="fields?.length">
                      <template v-for="field in fields" :key="field.id">
                        <LazySmartsheetPlainCell
                          v-if="!isRowEmpty(record, field!)"
                          v-model="record.row[field!.title!]"
                          :column="field"
                        />
                      </template>
                    </template>
                    <template v-else>
                      <span class="text-nc-content-gray-muted"> - </span>
                    </template>
                    <template #tooltip>
                      <SmartsheetRecordFieldsTooltip :record="record" :fields="fields" />
                    </template>
                  </LazySmartsheetCalendarSideRecordCard>
                </div>
              </template>
            </NcDropdown>
          </div>
        </template>
      </div>
    </div>
    <div class="absolute inset-0 z-2 pointer-events-none mt-8 pb-7.5" data-testid="nc-calendar-month-record-container">
      <template v-for="record in visibleRecords">
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
          @contextmenu="emit('recordContextMenu', $event, record)"
        >
          <LazySmartsheetRow :row="record">
            <LazySmartsheetCalendarRecordCard
              :hover="hoverRecord === record.rowMeta.id"
              :position="record.rowMeta.position"
              :record="record"
              :dragging="draggingId === record.rowMeta.id || resizeRecord?.rowMeta?.id === record.rowMeta.id"
              :resize="!!record.rowMeta.range?.fk_to_col && canEditCalendarData"
              :label-attachment="recordLabelAttachment(record)"
              @resize-start="onResizeStart"
            >
              <template v-if="[UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime].includes(calDataType)" #time>
                <span class="text-xs font-medium text-nc-content-gray-disabled">
                  {{
                    is12hrTimeColumn(record.rowMeta.range?.fk_from_col)
                      ? timezoneDayjs
                          .timezonize(record.row[record.rowMeta.range?.fk_from_col!.title!])
                          .format('h:mma')
                          .slice(0, -1)
                      : timezoneDayjs.timezonize(record.row[record.rowMeta.range?.fk_from_col!.title!]).format('HH:mm')
                  }}
                </span>
              </template>
              <!-- Range (date) columns are shown as the time prefix already, so
                   they're excluded here — the card body stays a clean title line
                   by default across every theme. -->
              <template v-for="field in cardFields" :key="field.id">
                <LazySmartsheetPlainCell
                  v-if="!isRowEmpty(record, field!) && !rangeFieldIds.has(field!.id)"
                  v-model="record.row[field!.title!]"
                  class="text-xs"
                  :bold="fieldStyles[field.id!]?.bold"
                  :column="field"
                  :italic="fieldStyles[field.id!]?.italic"
                  :underline="fieldStyles[field.id!]?.underline"
                />
              </template>
              <template #tooltip>
                <SmartsheetRecordFieldsTooltip :record="record" :fields="fields" />
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
  @apply relative !bg-nc-bg-brand;

  &:first-of-type::after {
    @apply left-0.5 w-[calc(100%_-_2px)];
  }
}
</style>
