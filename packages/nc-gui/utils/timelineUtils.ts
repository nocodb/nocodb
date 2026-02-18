import dayjs from 'dayjs'

/**
 * Get an array of visible dates based on the center date and zoom level
 */
export function getVisibleDates(centerDate: dayjs.Dayjs, zoom: 'week' | 'month'): dayjs.Dayjs[] {
  const dates: dayjs.Dayjs[] = []

  if (zoom === 'month') {
    const startOfMonth = centerDate.startOf('month')
    const daysInMonth = centerDate.daysInMonth()
    for (let i = 0; i < daysInMonth; i++) {
      dates.push(startOfMonth.add(i, 'day'))
    }
  } else {
    const startOfWeek = centerDate.startOf('week')
    for (let i = 0; i < 7; i++) {
      dates.push(startOfWeek.add(i, 'day'))
    }
  }

  return dates
}

/**
 * Calculate bar left offset in pixels
 */
export function getBarPosition(
  startDate: dayjs.Dayjs,
  firstVisibleDate: dayjs.Dayjs,
  colWidth: number,
): number {
  const offset = startDate.diff(firstVisibleDate, 'day')
  return Math.max(offset * colWidth, 0)
}

/**
 * Calculate bar width in pixels
 */
export function getBarWidth(
  startDate: dayjs.Dayjs,
  endDate: dayjs.Dayjs,
  colWidth: number,
): number {
  const duration = endDate.diff(startDate, 'day') + 1
  return Math.max(duration * colWidth - 4, 20) // minimum 20px
}

/**
 * Check if a date is today
 */
export function isToday(date: dayjs.Dayjs): boolean {
  return date.isSame(dayjs(), 'day')
}

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: dayjs.Dayjs): boolean {
  return date.day() === 0 || date.day() === 6
}

/** Shared layout constants for timeline views */
export const TIMELINE_GROUP_SIDEBAR_WIDTH = 200
export const TIMELINE_GROUP_HEADER_HEIGHT = 32
