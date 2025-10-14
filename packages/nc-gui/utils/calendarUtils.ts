import type dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'

const isRowInDateRange = (
  rowData: Record<string, any>,
  rangeStart: dayjs.Dayjs,
  rangeEnd: dayjs.Dayjs,
  calendarRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>,
  timezoneDayjs: { timezonize: (date: any) => dayjs.Dayjs },
): boolean => {
  if (!calendarRange?.length) return false

  for (const range of calendarRange) {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col

    if (!fromCol) continue

    const fromDate = rowData[fromCol.title!]
    const toDate = toCol ? rowData[toCol.title!] : null

    if (!fromDate) continue

    const rowStartDate = timezoneDayjs.timezonize(fromDate)
    const rowEndDate = toDate ? timezoneDayjs.timezonize(toDate) : rowStartDate

    // Check if row's date range intersects with given range
    if (rowStartDate.isSameOrBefore(rangeEnd) && rowEndDate.isSameOrAfter(rangeStart)) {
      return true
    }
  }

  return false
}

const isRowInCurrentDateRange = (
  rowData: Record<string, any>,
  calendarRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>,
  activeCalendarView: 'month' | 'year' | 'day' | 'week',
  selectedDate: dayjs.Dayjs,
  selectedDateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  selectedMonth: dayjs.Dayjs,
  timezoneDayjs: { timezonize: (date: any) => dayjs.Dayjs },
): boolean => {
  if (!calendarRange?.length) return false

  for (const range of calendarRange) {
    const fromCol = range.fk_from_col
    const toCol = range.fk_to_col

    if (!fromCol) continue

    const fromDate = rowData[fromCol.title!]
    const toDate = toCol ? rowData[toCol.title!] : null

    if (!fromDate) continue

    // Check if row's date range intersects with current calendar view
    const rowStartDate = timezoneDayjs.timezonize(fromDate)
    const rowEndDate = toDate ? timezoneDayjs.timezonize(toDate) : rowStartDate

    let viewStartDate: dayjs.Dayjs
    let viewEndDate: dayjs.Dayjs

    switch (activeCalendarView) {
      case 'day':
        viewStartDate = selectedDate.startOf('day')
        viewEndDate = selectedDate.endOf('day')
        break
      case 'week':
        viewStartDate = selectedDateRange.start.startOf('week')
        viewEndDate = selectedDateRange.end.endOf('week')
        break
      case 'month': {
        const startOfMonth = timezoneDayjs.timezonize(selectedMonth.startOf('month'))
        viewStartDate = timezoneDayjs.timezonize(startOfMonth.startOf('week'))
        viewEndDate = timezoneDayjs.timezonize(selectedMonth.endOf('month')).endOf('week')
        break
      }
      case 'year':
        viewStartDate = selectedDate.startOf('year')
        viewEndDate = selectedDate.endOf('year')
        break
      default:
        return false
    }

    // Check if date ranges overlap
    if (rowStartDate.isSameOrBefore(viewEndDate) && rowEndDate.isSameOrAfter(viewStartDate)) {
      return true
    }
  }

  return false
}

const isRowMatchingSidebarFilter = (
  rowData: Record<string, any>,
  sideBarFilterOption: string,
  calendarRange: Array<{
    fk_from_col: ColumnType
    fk_to_col?: ColumnType | null
    id: string
    is_readonly: boolean
  }>,
  selectedDate: dayjs.Dayjs,
  selectedDateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  selectedMonth: dayjs.Dayjs,
  selectedTime: dayjs.Dayjs,
  timezoneDayjs: {
    timezonize: (date: any) => dayjs.Dayjs
    dayjsTz: () => dayjs.Dayjs
  },
): boolean => {
  if (!calendarRange?.length) return false

  // Apply the same logic as sideBarFilter computed property
  switch (sideBarFilterOption) {
    case 'allRecords':
      return true

    case 'withoutDates':
      for (const range of calendarRange) {
        const fromCol = range.fk_from_col
        const toCol = range.fk_to_col

        const fromDate = fromCol ? rowData[fromCol.title!] : null
        const toDate = toCol ? rowData[toCol.title!] : null

        // If both columns exist, both dates must be present
        if (fromCol && toCol && (!fromDate || !toDate)) {
          return true
        }

        // If only fromCol exists, fromDate must be present
        if (fromCol && !toCol && !fromDate) {
          return true
        }
      }
      return false

    case 'day':
    case 'selectedDate':
      return isRowInDateRange(rowData, selectedDate.startOf('day'), selectedDate.endOf('day'), calendarRange, timezoneDayjs)

    case 'week':
      return isRowInDateRange(
        rowData,
        selectedDateRange.start.startOf('week'),
        selectedDateRange.end.endOf('week'),
        calendarRange,
        timezoneDayjs,
      )

    case 'month': {
      const startOfMonth = timezoneDayjs.timezonize(selectedMonth.startOf('month'))
      const firstDayToDisplay = timezoneDayjs.timezonize(startOfMonth.startOf('week'))
      const endOfMonth = timezoneDayjs.timezonize(selectedMonth.endOf('month')).endOf('week')
      return isRowInDateRange(rowData, firstDayToDisplay, endOfMonth, calendarRange, timezoneDayjs)
    }
    case 'year':
      return isRowInDateRange(rowData, selectedDate.startOf('year'), selectedDate.endOf('year'), calendarRange, timezoneDayjs)

    case 'selectedHours': {
      const hourStart = timezoneDayjs.timezonize((selectedTime ?? timezoneDayjs.dayjsTz()).startOf('hour'))
      const hourEnd = timezoneDayjs.timezonize((selectedTime ?? timezoneDayjs.dayjsTz()).endOf('hour'))
      return isRowInDateRange(rowData, hourStart, hourEnd, calendarRange, timezoneDayjs)
    }

    default:
      return false
  }
}

export { isRowInDateRange, isRowInCurrentDateRange, isRowMatchingSidebarFilter }
