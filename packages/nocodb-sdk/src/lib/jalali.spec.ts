import dayjs from 'dayjs';
import {
  isJalaliFormat,
  isLeapJalaaliYear,
  jalaaliMonthLength,
  jalaliPlugin,
  parseJalaliToGregorian,
  toGregorian,
  toJalaali,
} from './jalali';

dayjs.extend(jalaliPlugin);

describe('jalali calendar helpers', () => {
  describe('toJalaali / toGregorian', () => {
    it('converts a known Gregorian date to Jalali (Nowruz)', () => {
      // 2024-03-20 is 1 Farvardin 1403
      expect(toJalaali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 });
    });

    it('converts a known Jalali date back to Gregorian', () => {
      expect(toGregorian(1403, 1, 1)).toEqual({ gy: 2024, gm: 3, gd: 20 });
    });

    it('round-trips a range of dates', () => {
      let d = dayjs('2000-01-01');
      const end = dayjs('2030-12-31');
      while (d.isBefore(end)) {
        const { jy, jm, jd } = toJalaali(d.year(), d.month() + 1, d.date());
        const { gy, gm, gd } = toGregorian(jy, jm, jd);
        expect({ gy, gm, gd }).toEqual({
          gy: d.year(),
          gm: d.month() + 1,
          gd: d.date(),
        });
        d = d.add(37, 'day');
      }
    });
  });

  describe('leap years and month lengths', () => {
    it('detects leap Jalali years', () => {
      expect(isLeapJalaaliYear(1403)).toBe(true);
      expect(isLeapJalaaliYear(1404)).toBe(false);
    });

    it('returns correct month lengths', () => {
      expect(jalaaliMonthLength(1403, 1)).toBe(31); // Farvardin
      expect(jalaaliMonthLength(1403, 7)).toBe(30); // Mehr
      expect(jalaaliMonthLength(1403, 12)).toBe(30); // Esfand in a leap year
      expect(jalaaliMonthLength(1404, 12)).toBe(29); // Esfand in a common year
    });
  });

  describe('isJalaliFormat', () => {
    it('detects Jalali format strings', () => {
      expect(isJalaliFormat('jYYYY/jMM/jDD')).toBe(true);
      expect(isJalaliFormat('jDD jMMMM jYYYY')).toBe(true);
    });

    it('returns false for Gregorian formats and empty values', () => {
      expect(isJalaliFormat('YYYY-MM-DD')).toBe(false);
      expect(isJalaliFormat('')).toBe(false);
      expect(isJalaliFormat(null)).toBe(false);
    });
  });

  describe('dayjs format plugin', () => {
    it('renders Jalali tokens while leaving Gregorian tokens intact', () => {
      const d = dayjs('2024-03-20');
      expect(d.format('jYYYY/jMM/jDD')).toBe('1403/01/01');
      expect(d.format('jYYYY-jMM-jDD')).toBe('1403-01-01');
    });

    it('renders Persian month names', () => {
      expect(dayjs('2024-03-20').format('jDD jMMMM jYYYY')).toBe(
        '01 فروردین 1403'
      );
    });

    it('mixes Jalali date tokens with Gregorian time tokens', () => {
      expect(dayjs('2024-03-20 13:45').format('jYYYY/jMM/jDD HH:mm')).toBe(
        '1403/01/01 13:45'
      );
    });

    it('does not alter plain Gregorian formatting', () => {
      expect(dayjs('2024-03-20').format('YYYY-MM-DD')).toBe('2024-03-20');
    });

    it('does not throw for dates outside the Jalali range and degrades to Gregorian', () => {
      // 4000-01-01 is beyond the supported Jalali range — must not throw.
      expect(() => dayjs('4000-01-01').format('jYYYY/jMM/jDD')).not.toThrow();
      expect(dayjs('4000-01-01').format('jYYYY/jMM/jDD')).toBe('4000/01/01');
    });
  });

  describe('parseJalaliToGregorian', () => {
    it('parses a numeric Jalali string', () => {
      expect(parseJalaliToGregorian('1403/01/01', 'jYYYY/jMM/jDD')).toEqual({
        y: 2024,
        m: 3,
        d: 20,
      });
    });

    it('parses a Jalali string with a Persian month name', () => {
      expect(
        parseJalaliToGregorian('01 فروردین 1403', 'jDD jMMMM jYYYY')
      ).toEqual({ y: 2024, m: 3, d: 20 });
    });

    it('rejects invalid Jalali dates', () => {
      expect(parseJalaliToGregorian('1404/12/30', 'jYYYY/jMM/jDD')).toBeNull();
      expect(parseJalaliToGregorian('not a date', 'jYYYY/jMM/jDD')).toBeNull();
    });

    it('parses a month-only Jalali format to the first of the month', () => {
      // 1 Mordad 1403 -> 2024-07-22 (no day token: defaults to the 1st)
      expect(parseJalaliToGregorian('1403/05', 'jYYYY/jMM')).toEqual({
        y: 2024,
        m: 7,
        d: 22,
      });
      expect(parseJalaliToGregorian('1403-05', 'jYYYY-jMM')).toEqual({
        y: 2024,
        m: 7,
        d: 22,
      });
    });

    it('returns null (does not throw) for out-of-range Jalali years', () => {
      expect(() =>
        parseJalaliToGregorian('5000/01/01', 'jYYYY/jMM/jDD')
      ).not.toThrow();
      expect(parseJalaliToGregorian('5000/01/01', 'jYYYY/jMM/jDD')).toBeNull();
      expect(parseJalaliToGregorian('9999/12/29', 'jYYYY/jMM/jDD')).toBeNull();
    });
  });
});
