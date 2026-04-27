import dayjs from 'dayjs'

export type TimelineZoomLevel =
  | 'day'
  | 'week'
  | '2week'
  | 'month'
  | 'quarter'
  | '6month'
  | 'year'
  | '2year'
  | '5year'

export const TIMELINE_ZOOM_LEVELS: TimelineZoomLevel[] = [
  'day',
  'week',
  '2week',
  'month',
  'quarter',
  '6month',
  'year',
  '2year',
  '5year',
]

export type GridlineUnit = 'day' | 'week' | 'fortnight' | 'month' | 'quarter'

// Reference Sunday for "every other Sunday" alignment in fortnight cadence —
// any known Sunday works as long as it's stable across runs.
const FORTNIGHT_REF_SUNDAY = dayjs('2000-01-02')

/**
 * True when the date's right edge falls on a gridline boundary for the
 * given cadence — i.e. the cell ending here marks the start of the next
 * day / week / fortnight / month / quarter.
 */
export function isGridlineBoundary(date: dayjs.Dayjs, unit: GridlineUnit): boolean {
  switch (unit) {
    case 'day':
      return true
    case 'week':
      return date.day() === 0 // Sunday — right edge is start of next Monday
    case 'fortnight':
      return date.day() === 0 && Math.abs(date.diff(FORTNIGHT_REF_SUNDAY, 'day')) % 14 === 0
    case 'month':
      return date.date() === date.daysInMonth()
    case 'quarter':
      return date.date() === date.daysInMonth() && date.month() % 3 === 2
  }
}

/**
 * Calculate bar left offset in pixels (relative to a base date).
 */
export function getBarPosition(startDate: dayjs.Dayjs, firstVisibleDate: dayjs.Dayjs, colWidth: number): number {
  const offset = startDate.diff(firstVisibleDate, 'day')
  return Math.max(offset * colWidth, 0)
}

/**
 * Calculate bar width in pixels — allows shrinking to a 1px hairline so a
 * single-day record stays visible at coarse zoom levels.
 */
export function getBarWidth(startDate: dayjs.Dayjs, endDate: dayjs.Dayjs, colWidth: number): number {
  const duration = endDate.diff(startDate, 'day') + 1
  return Math.max(duration * colWidth - 4, 1)
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
