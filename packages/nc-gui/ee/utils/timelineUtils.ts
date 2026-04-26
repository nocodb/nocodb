import dayjs from 'dayjs'

export type TimelineZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year' | '5year'

export const TIMELINE_ZOOM_LEVELS: TimelineZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year', '5year']

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
