import {
  formatCustomNumber,
  isValidCustomNumberFormat,
} from './customNumberFormat';

describe('customNumberFormat', () => {
  describe('formatCustomNumber', () => {
    it('appends a literal unit suffix', () => {
      expect(formatCustomNumber(5, '0" ft"')).toBe('5 ft');
      expect(formatCustomNumber(-5, '0" ft"')).toBe('-5 ft');
    });

    it('applies thousands separators', () => {
      expect(formatCustomNumber(1500, '#,##0" ft"')).toBe('1,500 ft');
    });

    it('applies fixed decimal places', () => {
      expect(formatCustomNumber(1500.4, '#,##0.00" W"')).toBe('1,500.40 W');
    });

    it('formats percentages', () => {
      expect(formatCustomNumber(0.5, '0%')).toBe('50%');
    });

    it('scales down by 1000 per trailing comma', () => {
      expect(formatCustomNumber(1234567, '0,," M"')).toBe('1 M');
    });

    it('rounds to the requested precision', () => {
      expect(formatCustomNumber(3.14159, '0.00')).toBe('3.14');
    });

    it('supports positive;negative sections', () => {
      expect(formatCustomNumber(-1500, '#,##0;(#,##0)')).toBe('(1,500)');
      expect(formatCustomNumber(1500, '#,##0;(#,##0)')).toBe('1,500');
    });

    it('supports a dedicated zero section', () => {
      expect(
        formatCustomNumber(0, '#,##0.00;(#,##0.00);"zero"')
      ).toBe('zero');
    });

    it('trims optional trailing decimal digits but keeps required ones', () => {
      expect(formatCustomNumber(5, '0.##')).toBe('5');
      expect(formatCustomNumber(5.5, '0.##')).toBe('5.5');
    });

    it('supports escaped literal characters', () => {
      expect(formatCustomNumber(100, '0 \\W')).toBe('100 W');
    });

    it('returns an empty string for null/undefined/blank values', () => {
      expect(formatCustomNumber(null, '0.00')).toBe('');
      expect(formatCustomNumber(undefined, '0.00')).toBe('');
      expect(formatCustomNumber('', '0.00')).toBe('');
    });

    it('falls back to the plain number when no format is given', () => {
      expect(formatCustomNumber(42, '')).toBe('42');
      expect(formatCustomNumber(42, null)).toBe('42');
    });
  });

  describe('isValidCustomNumberFormat', () => {
    it('accepts a well-formed format', () => {
      expect(isValidCustomNumberFormat('#,##0.00" ft"')).toEqual({
        valid: true,
      });
    });

    it('accepts an empty format', () => {
      expect(isValidCustomNumberFormat('')).toEqual({ valid: true });
    });

    it('rejects unmatched quotes', () => {
      expect(isValidCustomNumberFormat('0.00" ft').valid).toBe(false);
    });

    it('rejects unmatched brackets', () => {
      expect(isValidCustomNumberFormat('[Red]0.00]').valid).toBe(false);
    });

    it('rejects more than 4 sections', () => {
      expect(isValidCustomNumberFormat('0;0;0;0;0').valid).toBe(false);
    });
  });
});
