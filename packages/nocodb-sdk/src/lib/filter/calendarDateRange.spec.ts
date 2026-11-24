import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  DATE_RANGE_PENDING,
  getCalendarPeriodRange,
  isValidDateRangePart,
  parseDateInTimezone,
  parseDateRangeValue,
} from '~/lib/filter/calendarDateRange';

dayjs.extend(utc);
dayjs.extend(timezone);

const fmt = ([start, end]: [dayjs.Dayjs, dayjs.Dayjs]) => [
  start.format('YYYY-MM-DD HH:mm:ss'),
  end.format('YYYY-MM-DD HH:mm:ss'),
];

describe('getCalendarPeriodRange', () => {
  // Wednesday
  const now = dayjs.tz('2026-01-07 15:30:00', 'Asia/Kolkata');

  it('weeks run Monday to Sunday', () => {
    expect(fmt(getCalendarPeriodRange('thisCalendarWeek', now))).toEqual([
      '2026-01-05 00:00:00',
      '2026-01-11 23:59:59',
    ]);
    expect(fmt(getCalendarPeriodRange('lastCalendarWeek', now))).toEqual([
      '2025-12-29 00:00:00',
      '2026-01-04 23:59:59',
    ]);
    expect(fmt(getCalendarPeriodRange('nextCalendarWeek', now))).toEqual([
      '2026-01-12 00:00:00',
      '2026-01-18 23:59:59',
    ]);
  });

  it('a Sunday belongs to the week that started the Monday before', () => {
    const sunday = dayjs.tz('2026-01-11 10:00:00', 'Asia/Kolkata');
    expect(fmt(getCalendarPeriodRange('thisCalendarWeek', sunday))).toEqual([
      '2026-01-05 00:00:00',
      '2026-01-11 23:59:59',
    ]);
  });

  it('ignores the global dayjs week start', () => {
    // a locale where weeks start on Sunday must not shift the range
    const sundayFirst = now.locale({ ...dayjs.Ls.en, weekStart: 0 });
    expect(
      fmt(getCalendarPeriodRange('thisCalendarWeek', sundayFirst))
    ).toEqual(['2026-01-05 00:00:00', '2026-01-11 23:59:59']);
  });

  it('months and years cross the year boundary', () => {
    expect(fmt(getCalendarPeriodRange('lastCalendarMonth', now))).toEqual([
      '2025-12-01 00:00:00',
      '2025-12-31 23:59:59',
    ]);
    expect(fmt(getCalendarPeriodRange('thisCalendarMonth', now))).toEqual([
      '2026-01-01 00:00:00',
      '2026-01-31 23:59:59',
    ]);
    expect(fmt(getCalendarPeriodRange('lastCalendarYear', now))).toEqual([
      '2025-01-01 00:00:00',
      '2025-12-31 23:59:59',
    ]);
    expect(fmt(getCalendarPeriodRange('nextCalendarYear', now))).toEqual([
      '2027-01-01 00:00:00',
      '2027-12-31 23:59:59',
    ]);
  });

  it('bounds stay in the given timezone', () => {
    const [start] = getCalendarPeriodRange('thisCalendarMonth', now);
    expect(start.utc().format('YYYY-MM-DD HH:mm')).toBe('2025-12-31 18:30');
  });
});

describe('parseDateRangeValue', () => {
  it('splits a "from,to" value', () => {
    expect(parseDateRangeValue('2026-01-01, 2026-01-31')).toEqual([
      '2026-01-01',
      '2026-01-31',
    ]);
    expect(parseDateRangeValue(['2026-01-01', '2026-01-31'])).toEqual([
      '2026-01-01',
      '2026-01-31',
    ]);
  });

  it('is pending while an end is blank', () => {
    expect(parseDateRangeValue('2026-01-01,')).toBe(DATE_RANGE_PENDING);
    expect(parseDateRangeValue(',2026-01-01')).toBe(DATE_RANGE_PENDING);
    expect(parseDateRangeValue(null)).toBe(DATE_RANGE_PENDING);
    expect(parseDateRangeValue('')).toBe(DATE_RANGE_PENDING);
  });

  it('returns null for anything that is not two real dates', () => {
    expect(parseDateRangeValue('2026-01-01')).toBeNull();
    expect(parseDateRangeValue('a,b,c')).toBeNull();
    expect(parseDateRangeValue('foo,2026-01-01')).toBeNull();
    expect(parseDateRangeValue('2026-02-01,2026-02-31')).toBeNull();
  });

  it('puts a reversed range in order', () => {
    expect(parseDateRangeValue('2026-03-20,2026-03-10')).toEqual([
      '2026-03-10',
      '2026-03-20',
    ]);
  });
});

describe('isValidDateRangePart', () => {
  it('rejects dates dayjs would roll over', () => {
    expect(isValidDateRangePart('2026-02-28')).toBe(true);
    expect(isValidDateRangePart('2026-02-31')).toBe(false);
    expect(isValidDateRangePart('2026-13-01')).toBe(false);
    expect(isValidDateRangePart('garbage')).toBe(false);
    expect(isValidDateRangePart('2026-03-01T10:00:00+05:30')).toBe(true);
    expect(isValidDateRangePart('2026-03-01 10:00')).toBe(true);
    expect(isValidDateRangePart('2026-03-01T10:00:00.123Z')).toBe(true);
    expect(isValidDateRangePart('2026-02-31T10:00:00Z')).toBe(false);
  });

  it('rejects text Date() would still parse', () => {
    for (const value of [
      '1',
      '2',
      'March 1, 2026',
      '03/01/2026',
      '2026-3-1',
      '2026-03-01T25:00',
      '2026-03-01 23:99',
      '2026-03-01T10:00:60',
    ]) {
      expect(isValidDateRangePart(value)).toBe(false);
    }
    expect(parseDateRangeValue('1,2')).toBeNull();
  });
});

describe('parseDateInTimezone', () => {
  const tz = 'Asia/Kolkata';

  it('reads a value without an offset as a wall time in tz', () => {
    const d = parseDateInTimezone('2026-03-01 10:00', tz);
    expect(d.format('YYYY-MM-DD HH:mm Z')).toBe('2026-03-01 10:00 +05:30');
  });

  it('keeps the instant of a value with an offset', () => {
    const d = parseDateInTimezone('2026-03-01T22:00:00Z', tz);
    expect(d.format('YYYY-MM-DD HH:mm Z')).toBe('2026-03-02 03:30 +05:30');
  });

  it('returns an invalid date instead of throwing', () => {
    expect(parseDateInTimezone('not a date', tz).isValid()).toBe(false);
  });
});
