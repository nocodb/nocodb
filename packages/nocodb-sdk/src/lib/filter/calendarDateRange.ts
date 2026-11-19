import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import type { Dayjs } from 'dayjs';
import { isDateTimeStringHasTimezone } from '~/lib/timezoneUtils';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * A filter date read in `tz`: one with an offset keeps its instant, one
 * without is a wall time there. Unparseable input comes back invalid, not thrown.
 */
export const parseDateInTimezone = (value: string, tz: string): Dayjs => {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return parsed;
  return isDateTimeStringHasTimezone(value)
    ? parsed.tz(tz)
    : dayjs.tz(value, tz);
};

// `isWithin` sub-ops bounded by calendar periods, not rolling windows from today.
export const CALENDAR_PERIOD_SUB_OPS = [
  'thisCalendarWeek',
  'thisCalendarMonth',
  'thisCalendarYear',
  'lastCalendarWeek',
  'lastCalendarMonth',
  'lastCalendarYear',
  'nextCalendarWeek',
  'nextCalendarMonth',
  'nextCalendarYear',
] as const;

export type CalendarPeriodSubOp = (typeof CALENDAR_PERIOD_SUB_OPS)[number];

// `isWithin` + `dateRange`: value is "from,to" (dates), both days inclusive.
export const DATE_RANGE_SUB_OP = 'dateRange' as const;

export const isCalendarPeriodSubOp = (
  subOp: unknown
): subOp is CalendarPeriodSubOp =>
  CALENDAR_PERIOD_SUB_OPS.includes(subOp as CalendarPeriodSubOp);

// Monday-first week, computed without dayjs locale state (weekStart is global).
const startOfIsoWeek = (date: Dayjs) =>
  date.subtract((date.day() + 6) % 7, 'day').startOf('day');

/**
 * First and last instant of the calendar period `subOp` names, relative to
 * `now`. `now` must already be in the filter's timezone.
 */
export const getCalendarPeriodRange = (
  subOp: CalendarPeriodSubOp,
  now: Dayjs
): [Dayjs, Dayjs] => {
  const unit = subOp.endsWith('Week')
    ? 'week'
    : subOp.endsWith('Month')
    ? 'month'
    : 'year';
  const shift = subOp.startsWith('last')
    ? -1
    : subOp.startsWith('next')
    ? 1
    : 0;
  const cursor = now.add(shift, unit);
  const start =
    unit === 'week'
      ? startOfIsoWeek(cursor)
      : cursor.startOf(unit).startOf('day');
  const end =
    unit === 'week'
      ? start.add(6, 'day').endOf('day')
      : cursor.endOf(unit).endOf('day');
  return [start, end];
};

// hours and minutes are range-checked: dayjs rolls 25:00 into the next day
const DATE_RANGE_PART =
  /^(\d{4}-\d{2}-\d{2})([T ]([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?)?(Z|[+-]([01]\d|2[0-3]):?[0-5]\d)?$/;

/**
 * Whether a `dateRange` end is an ISO date, optionally with a time and offset.
 * Non-ISO text would fall back to engine-specific `Date()` parsing, and dayjs
 * rolls impossible days over (2026-02-31 → 2026-03-03), so the date part must
 * round-trip.
 */
export const isValidDateRangePart = (value: string): boolean => {
  const match = DATE_RANGE_PART.exec(value);
  if (!match || !dayjs(value).isValid()) return false;
  return dayjs(match[1]).format('YYYY-MM-DD') === match[1];
};

// A range with an end still blank: matches every row while the user picks.
export const DATE_RANGE_PENDING = 'pending' as const;

export const DATE_RANGE_NEEDS_TWO_DATES =
  "'dateRange' needs two dates: from,to";

/**
 * The two ends of a `dateRange` value, earlier first; `DATE_RANGE_PENDING`
 * when empty or one end is blank; null when it isn't two real dates.
 */
export const parseDateRangeValue = (
  value: unknown
): [string, string] | typeof DATE_RANGE_PENDING | null => {
  if (value === null || value === undefined || value === '') {
    return DATE_RANGE_PENDING;
  }
  const parts = Array.isArray(value)
    ? value.map((v) => `${v ?? ''}`)
    : typeof value === 'string'
    ? value.split(',')
    : [];
  if (parts.length !== 2) return null;
  const [from, to] = parts.map((p) => p.trim());
  if (!from || !to) return DATE_RANGE_PENDING;
  if (!isValidDateRangePart(from) || !isValidDateRangePart(to)) return null;
  return dayjs(to).isBefore(dayjs(from)) ? [to, from] : [from, to];
};

/**
 * A `where` value of `isWithin` that is `dateRange` with an end missing, for
 * any field: a lookup's leaf type is unknown to the parser.
 */
export const isPendingDateRangeWhere = (op: unknown, value: unknown) => {
  if (op !== 'isWithin') return false;
  const parts = Array.isArray(value)
    ? value.map((v) => `${v ?? ''}`)
    : typeof value === 'string'
    ? value.split(',')
    : [];
  const range = parts.slice(1).join(',');
  return (
    parts[0]?.trim() === DATE_RANGE_SUB_OP &&
    parseDateRangeValue(range.trim() ? range : '') === DATE_RANGE_PENDING
  );
};

/**
 * Whether `date` falls inside a calendar-period or `dateRange` filter, by day.
 * `now` and `toDate` (reads a range end) must use the filter's timezone.
 */
export const isDateWithinPeriod = (
  subOp: CalendarPeriodSubOp | typeof DATE_RANGE_SUB_OP,
  value: unknown,
  date: Dayjs,
  now: Dayjs,
  toDate: (end: string) => Dayjs
): boolean => {
  let bounds: [Dayjs, Dayjs];
  if (isCalendarPeriodSubOp(subOp)) {
    bounds = getCalendarPeriodRange(subOp, now);
  } else {
    const range = parseDateRangeValue(value);
    if (range === DATE_RANGE_PENDING) return true;
    if (!range) return false;
    bounds = [toDate(range[0]), toDate(range[1])];
  }
  // an invalid date is neither before nor after anything
  if (![date, ...bounds].every((d) => d.isValid())) return false;
  return !date.isBefore(bounds[0], 'day') && !date.isAfter(bounds[1], 'day');
};
