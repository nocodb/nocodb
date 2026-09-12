import { getUnpaddedDateFormat, parseDateWithFormat } from './dateTimeHelper';

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
});
