import {
  getDateTimeValue,
  getUnpaddedDateFormat,
  parseDateWithFormat,
} from './dateTimeHelper';

describe('getUnpaddedDateFormat', () => {
  it('unpads numeric month/day/hour/minute/second tokens', () => {
    expect(getUnpaddedDateFormat('MM/DD/YYYY')).toBe('M/D/YYYY');
    expect(getUnpaddedDateFormat('YYYY-MM-DD')).toBe('YYYY-M-D');
    expect(getUnpaddedDateFormat('DD.MM.YYYY')).toBe('D.M.YYYY');
    expect(getUnpaddedDateFormat('YYYY-MM-DD HH:mm:ss')).toBe('YYYY-M-D H:m:s');
  });

  it('leaves month-name and weekday tokens untouched', () => {
    expect(getUnpaddedDateFormat('DD MMM YYYY')).toBe('D MMM YYYY');
    expect(getUnpaddedDateFormat('dddd MM/DD/YYYY')).toBe('dddd M/D/YYYY');
    expect(getUnpaddedDateFormat('MM/DD/YYYY hh:mm A')).toBe('M/D/YYYY h:m A');
  });
});

describe('parseDateWithFormat', () => {
  it('parses a zero-padded date', () => {
    expect(
      parseDateWithFormat('05/05/2026', 'MM/DD/YYYY').format('YYYY-MM-DD')
    ).toBe('2026-05-05');
  });

  it('parses an unpadded date the same way as a padded one', () => {
    expect(
      parseDateWithFormat('5/5/2026', 'MM/DD/YYYY').format('YYYY-MM-DD')
    ).toBe('2026-05-05');

    expect(
      parseDateWithFormat('6/2/2026', 'MM/DD/YYYY').format('YYYY-MM-DD')
    ).toBe('2026-06-02');

    expect(
      parseDateWithFormat('2026-5-5', 'YYYY-MM-DD').format('YYYY-MM-DD')
    ).toBe('2026-05-05');
  });

  it('returns an invalid dayjs for non-date input', () => {
    expect(parseDateWithFormat('hello', 'MM/DD/YYYY').isValid()).toBe(false);
  });

  it.each([
    ['2023-02-29', 'YYYY-MM-DD'],
    ['2024-02-30', 'YYYY-MM-DD'],
    ['2026-13-45', 'YYYY-MM-DD'],
    ['31/04/2026', 'DD/MM/YYYY'],
    ['25:61', 'HH:mm'],
    ['24:00', 'HH:mm'],
    ['13:00 PM', 'hh:mm A'],
    ['31 Apr 2026', 'DD MMM YYYY'],
    ['30 Feb 23', 'DD MMM YY'],
    ['Thu 2023-02-30', 'ddd YYYY-MM-DD'],
    ['Thursday 30/02/2023', 'dddd DD/MM/YYYY'],
  ])('rejects the impossible value %s instead of rolling it over', (v, f) => {
    expect(parseDateWithFormat(v, f).isValid()).toBe(false);
  });

  it.each([
    ['2024-02-29', 'YYYY-MM-DD', 'YYYY-MM-DD', '2024-02-29'],
    ['29/02/2024', 'DD/MM/YYYY', 'YYYY-MM-DD', '2024-02-29'],
    ['05 May 2026', 'DD MMM YYYY', 'YYYY-MM-DD', '2026-05-05'],
    ['Tue 2026-05-05', 'ddd YYYY-MM-DD', 'YYYY-MM-DD', '2026-05-05'],
    ['23:59', 'HH:mm', 'HH:mm', '23:59'],
    ['12:30 AM', 'hh:mm A', 'HH:mm', '00:30'],
  ])('still accepts the real value %s', (v, f, out, expected) => {
    expect(parseDateWithFormat(v, f).format(out)).toBe(expected);
  });
});

describe('getDateTimeValue', () => {
  it.each([
    ['DD/MM/YYYY', '27/10/2023 10:30'],
    ['MM/DD/YYYY', '10/27/2023 10:30'],
    ['DD.MM.YYYY', '27.10.2023 10:30'],
  ])('formats a raw timestamp using %s', (dateFormat, expected) => {
    const result = getDateTimeValue(
      '2023-10-27 10:30:00',
      {
        meta: {
          date_format: dateFormat,
          time_format: 'HH:mm',
        },
      } as any
    );

    expect(result).toBe(expected);
  });
});
