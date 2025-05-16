import {
  parseDateTimeValue,
  parseDateValue,
  serializeDateOrDateTimeValue,
} from './date-time';
import dayjs from 'dayjs';
import UITypes from '~/lib/UITypes';

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
    expect(serializeDateOrDateTimeValue('2023-10-27', col as any)).toBe(
      '2023-10-27'
    );
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

    expect(serializeDateOrDateTimeValue(value, col as any)).toBe(expected);
  });

  it('should serialize a date string to datetime format for DateTime type', () => {
    const col = { uidt: UITypes.DateTime, meta: {} };
    const value = '2023-10-27';
    const expected = dayjs(value).utc().format('YYYY-MM-DD HH:mm:ssZ');
    expect(serializeDateOrDateTimeValue(value, col as any)).toBe(expected);
  });

  it('should serialize a date string to datetime format for custom date format (1)', () => {
    const col = {
      uidt: UITypes.Date,
      meta: { date_format: 'MM/DD/YYYY' },
    };
    const value = '09/05/1980';
    const expected = dayjs(value, 'MM/DD/YYYY').format('YYYY-MM-DD');
    expect(serializeDateOrDateTimeValue(value, col as any)).toBe(expected);
  });

  it('should serialize a date string to datetime format for custom date format (2)', () => {
    const col = {
      uidt: UITypes.Date,
      meta: { date_format: 'DD/MM/YYYY' },
    };
    const value = '09/05/1980';
    const expected = dayjs(value, 'DD/MM/YYYY').format('YYYY-MM-DD');
    expect(serializeDateOrDateTimeValue(value, col as any)).toBe(expected);
  });
});
