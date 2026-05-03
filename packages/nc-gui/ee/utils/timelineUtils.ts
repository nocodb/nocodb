import dayjs from 'dayjs'

export const TIMELINE_ZOOM_LEVELS = [
  'day',
  'week',
  '2week',
  'month',
  'quarter',
  '6month',
  'year',
  '2year',
  '5year',
] as const

export type TimelineZoomLevel = (typeof TIMELINE_ZOOM_LEVELS)[number]

export type GridlineUnit = 'day' | 'week' | 'fortnight' | 'month' | 'quarter'

// Reference Sunday for "every other Sunday" alignment in fortnight cadence —
// any known Sunday works as long as it's stable across runs.
const FORTNIGHT_REF_SUNDAY = dayjs('2000-01-02')

/**
 * True when the date is the Monday that starts a fortnight cycle —
 * i.e. the day after a fortnight Sunday boundary. Used by the year scale's
 * minor row to label every other Monday with its day-of-month.
 */
export function isFortnightMonday(date: dayjs.Dayjs): boolean {
  if (date.day() !== 1) return false
  // Monday is exactly 1 day after the prior Sunday; align to the same
  // 14-day cycle as the gridline cadence.
  return Math.abs(date.subtract(1, 'day').diff(FORTNIGHT_REF_SUNDAY, 'day')) % 14 === 0
}

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

/** Shared layout constants for timeline views */
export const TIMELINE_GROUP_SIDEBAR_WIDTH = 200
export const TIMELINE_GROUP_HEADER_HEIGHT = 32

/**
 * Maximum number of records loaded into the timeline at once. The timeline
 * fetches everything up-front (no date-windowed pagination yet) and renders
 * bars in-memory. This cap balances memory + initial-fetch cost against
 * realistic dataset sizes; raise it once the windowed-fetch follow-up lands.
 */
export const TIMELINE_RECORD_LIMIT = 2000
