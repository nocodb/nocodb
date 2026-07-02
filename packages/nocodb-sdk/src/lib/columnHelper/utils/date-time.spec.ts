import {
  parseDateTimeValue,
  parseDateValue,
  parseDayjsWithJalaliSupport,
  serializeDateOrDateTimeValue,
} from './date-time';
import dayjs from 'dayjs';
import UITypes from '~/lib/UITypes';
import { getDateTimeValue } from '~/lib/dateTimeHelper';

describe('parse date', () => {
  it('should parse a valid date string with default format', () => {
    const col = { meta: null, uidt: UITypes.Date };
    expect(parseDateValue('2023-10-27', col as any)).toBe('2023-10-27');
  });

  it('should parse a valid date string with custom format', () => {
    const col = { meta: { date_format: 'MM/DD/YYYY' }, uidt: UITypes.Date };
    expect(parseDateValue('10/27/2023', col as any)).toBe('10/27/2023');
  });

  it('should parse a valid numeric timestamp', () => {
    const col = { meta: null, uidt: UITypes.Date };
    // FIXME: this is still affected by system's timezone (error when America/Los_Angeles)
    // need to strictly return utc, but can break something
    // Timestamp for 2023-10-27T00:00:00.000Z
    expect(parseDateValue('1698364800000', col as any)).toBe('2023-10-27');
  });

  it('should parse a valid date string for a system column', () => {
    const col = { meta: null, uidt: UITypes.Date };
    expect(parseDateValue('2023-10-27 10:30:00', col as any, true)).toBe(
      '2023-10-27 10:30:00'
    );
  });

  it('should serialize a valid date value for Date type', () => {
    const col = { uidt: UITypes.Date, meta: null };
    expect(
      serializeDateOrDateTimeValue('2023-10-27', { col: col as any })
    ).toBe('2023-10-27');
  });
});

describe('parse date-time', () => {
  it('should parse a valid ISO datetime string with quotes', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => false };
    const value = '"2023-10-27T10:30:00.000Z"';
    const expected = dayjs(value.replace(/["']/g, '')).format(
      'YYYY-MM-DD HH:mm'
    );
    expect(parseDateTimeValue(value, params as any)).toBe(expected);
  });

  it('should parse a valid ISO datetime string without quotes', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => false };
    const value = '2023-10-27T10:30:00.000Z';
    const expected = dayjs(value).format('YYYY-MM-DD HH:mm');
    expect(parseDateTimeValue(value, params as any)).toBe(expected);
  });

  it('should parse a valid datetime string in YYYY-MM-DD HH:mm:ss format with isMysql true', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => true };
    const value = '2023-10-27 10:30:00';
    const expected = dayjs(value, 'YYYY-MM-DD HH:mm:ss').format(
      'YYYY-MM-DD HH:mm'
    );
    expect(parseDateTimeValue(value, params as any)).toBe(expected);
  });

  it('should parse a valid datetime string in YYYY-MM-DD HH:mm:ssZ format', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => false };
    const value = '2023-10-27 10:30:00Z';
    const expected = dayjs(value, 'YYYY-MM-DD HH:mm:ssZ').format(
      'YYYY-MM-DD HH:mm'
    );
    expect(parseDateTimeValue(value, params as any)).toBe(expected);
  });

  it('should return null for invalid datetime string', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => false };
    const value = 'invalid-date-string';
    expect(parseDateTimeValue(value, params as any)).toBeNull();
  });

  it('should return null for null input', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const params = { col, isMysql: () => false };
    const value = null;
    expect(parseDateTimeValue(value, params as any)).toBeFalsy();
  });
});

describe('serialize', () => {
  it('should serialize a valid datetime value for non-Date type', () => {
    const col = {
      uidt: UITypes.DateTime,
      meta: {},
    };
    const value = '2023-10-27 10:00:00';
    const expected = dayjs(value).utc().format('YYYY-MM-DD HH:mm:ssZ');

    expect(serializeDateOrDateTimeValue(value, { col: col as any })).toBe(
      expected
    );
  });

  it('should serialize a date string to datetime format for DateTime type', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const value = '2023-10-27';
    const expected = dayjs(value).utc().format('YYYY-MM-DD HH:mm:ssZ');
    expect(serializeDateOrDateTimeValue(value, { col: col as any })).toBe(
      expected
    );
  });

  it('should serialize a date string to datetime format for custom date format (1)', () => {
    const col = {
      uidt: UITypes.Date,
      meta: { date_format: 'MM/DD/YYYY' },
    };
    const value = '09/05/1980';
    const expected = dayjs(value, 'MM/DD/YYYY').format('YYYY-MM-DD');
    expect(serializeDateOrDateTimeValue(value, { col: col as any })).toBe(
      expected
    );
  });

  it('should serialize a date string to datetime format for custom date format (2)', () => {
    const col = {
      uidt: UITypes.Date,
      meta: { date_format: 'DD/MM/YYYY' },
    };
    const value = '09/05/1980';
    const expected = dayjs(value, 'DD/MM/YYYY').format('YYYY-MM-DD');
    expect(serializeDateOrDateTimeValue(value, { col: col as any })).toBe(
      expected
    );
  });
});

// Regression tests for the Jalali (Persian) paste / fill / aggregation paths.
// The dayjs Jalali plugin only makes `.format()` Jalali-aware, not parsing, so
// these paths previously misread a Jalali display string (e.g. `1405/04/23`) as
// the Gregorian year 1405 and silently corrupted data.
describe('jalali interop (paste / fill / aggregation)', () => {
  it('parseDayjsWithJalaliSupport converts a Jalali date string to Gregorian', () => {
    expect(
      parseDayjsWithJalaliSupport('1405/04/23', 'jYYYY/jMM/jDD').format(
        'YYYY-MM-DD'
      )
    ).toBe('2026-07-14');
  });

  it('parseDayjsWithJalaliSupport preserves the time for a Jalali datetime string', () => {
    expect(
      parseDayjsWithJalaliSupport(
        '1405/04/23 14:30',
        'jYYYY/jMM/jDD HH:mm'
      ).format('YYYY-MM-DD HH:mm')
    ).toBe('2026-07-14 14:30');
  });

  it('parseDayjsWithJalaliSupport leaves non-Jalali formats to dayjs', () => {
    expect(
      parseDayjsWithJalaliSupport('2026/07/14', 'YYYY/MM/DD').format(
        'YYYY-MM-DD'
      )
    ).toBe('2026-07-14');
  });

  it('parseDayjsWithJalaliSupport returns an invalid dayjs for an unparseable Jalali string', () => {
    expect(
      parseDayjsWithJalaliSupport('not a date', 'jYYYY/jMM/jDD').isValid()
    ).toBe(false);
  });

  it('serializes a pasted Jalali date to the correct Gregorian ISO (not year 1405)', () => {
    const col = { uidt: UITypes.Date, meta: { date_format: 'jYYYY/jMM/jDD' } };
    expect(
      serializeDateOrDateTimeValue('1405/04/23', { col: col as any })
    ).toBe('2026-07-14');
  });

  it('serializes a pasted Jalali date with a Persian month name', () => {
    const col = {
      uidt: UITypes.Date,
      meta: { date_format: 'jDD jMMMM jYYYY' },
    };
    expect(
      serializeDateOrDateTimeValue('23 تیر 1405', { col: col as any })
    ).toBe('2026-07-14');
  });

  it('serializes a pasted Jalali datetime preserving the time', () => {
    const col = {
      uidt: UITypes.DateTime,
      meta: { date_format: 'jYYYY/jMM/jDD', time_format: 'HH:mm' },
    };
    const expected = dayjs('2026-07-14 14:30:00')
      .utc()
      .format('YYYY-MM-DD HH:mm:ssZ');
    expect(
      serializeDateOrDateTimeValue('1405/04/23 14:30', { col: col as any })
    ).toBe(expected);
  });

  it('getDateTimeValue renders a Jalali datetime instead of "Invalid Date"', () => {
    const col = {
      uidt: UITypes.DateTime,
      meta: { date_format: 'jDD jMMMM jYYYY', time_format: 'HH:mm' },
    };
    // 2024-03-20 is 1 Farvardin 1403 (Nowruz)
    expect(getDateTimeValue('2024-03-20 14:30:00', col as any)).toBe(
      '01 فروردین 1403 14:30'
    );
  });
});
