import { DecimalHelper } from './Decimal';
import { SilentTypeConversionError } from '~/lib/error';
import { SeparatorType } from '../utils/common';

describe('DecimalHelper', () => {
  const helper = new DecimalHelper();

  function makeParams(
    overrides: Record<string, any> = {},
    metaOverrides: Record<string, any> = {}
  ) {
    return {
      col: {
        meta: JSON.stringify({
          separator: SeparatorType.NonePeriod,
          precision: 1,
          ...metaOverrides,
        }),
      },
      isMultipleCellPaste: false,
      serializeSearchQuery: false,
      ...overrides,
    } as any;
  }

  describe('columnDefaultMeta', () => {
    it('has sensible defaults', () => {
      expect(helper.columnDefaultMeta).toEqual({
        precision: 1,
        isLocaleString: false,
        separator: SeparatorType.NonePeriod,
      });
    });
  });

  describe('serializeValue', () => {
    it('returns number for valid numeric string', () => {
      expect(helper.serializeValue('123.45', makeParams())).toBe(123.45);
    });

    it('returns number for numeric input', () => {
      expect(helper.serializeValue(42, makeParams())).toBe(42);
    });

    it('returns number for zero', () => {
      expect(helper.serializeValue(0, makeParams())).toBe(0);
    });

    it('returns number for negative value', () => {
      expect(helper.serializeValue('-99.5', makeParams())).toBe(-99.5);
    });

    it('strips non-numeric characters', () => {
      expect(helper.serializeValue('$1234.56', makeParams())).toBe(1234.56);
    });

    it('throws SilentTypeConversionError for non-numeric string in single paste', () => {
      expect(() => helper.serializeValue('abc', makeParams())).toThrow(
        SilentTypeConversionError
      );
    });

    it('throws SilentTypeConversionError for empty string in single paste', () => {
      expect(() => helper.serializeValue('', makeParams())).toThrow(
        SilentTypeConversionError
      );
    });

    it('throws SilentTypeConversionError for null in single paste', () => {
      expect(() => helper.serializeValue(null, makeParams())).toThrow(
        SilentTypeConversionError
      );
    });

    it('returns null for non-numeric string in multi-cell paste', () => {
      const params = makeParams({ isMultipleCellPaste: true });
      expect(helper.serializeValue('abc', params)).toBeNull();
    });

    it('returns null for empty string in multi-cell paste', () => {
      const params = makeParams({ isMultipleCellPaste: true });
      expect(helper.serializeValue('', params)).toBeNull();
    });

    it('returns null for null in multi-cell paste', () => {
      const params = makeParams({ isMultipleCellPaste: true });
      expect(helper.serializeValue(null, params)).toBeNull();
    });

    it('returns null for non-numeric string in search query', () => {
      const params = makeParams({ serializeSearchQuery: true });
      expect(helper.serializeValue('abc', params)).toBeNull();
    });

    it('handles comma decimal separator', () => {
      const params = makeParams({}, { separator: SeparatorType.NoneComma });
      expect(helper.serializeValue('1234,56', params)).toBe(1234.56);
    });

    it('handles thousand separators', () => {
      const params = makeParams({}, { separator: SeparatorType.CommaPeriod });
      expect(helper.serializeValue('1,234,567.89', params)).toBe(1234567.89);
    });

    it('handles European format (period thousand, comma decimal)', () => {
      const params = makeParams({}, { separator: SeparatorType.PeriodComma });
      expect(helper.serializeValue('1.234.567,89', params)).toBe(1234567.89);
      expect(helper.serializeValue('1.23', params)).toBe(123);
    });

    it('uses clipboard dbCellValue when source and target separators match', () => {
      const params = makeParams({
        clipboardItem: {
          dbCellValue: 99.99,
          column: { meta: JSON.stringify({ separator: SeparatorType.NonePeriod }) },
        },
      });
      expect(helper.serializeValue('ignored', params)).toBe(99.99);
    });

    it('ignores clipboard dbCellValue when source and target separators differ', () => {
      // Source uses NonePeriod (dot decimal), target uses NoneComma (comma decimal)
      // Pasting "1.23" should strip the dot and produce 123
      const params = makeParams(
        {
          clipboardItem: {
            dbCellValue: 1.23,
            column: { meta: JSON.stringify({ separator: SeparatorType.NonePeriod }) },
          },
        },
        { separator: SeparatorType.NoneComma },
      );
      expect(helper.serializeValue('1.23', params)).toBe(123);
    });

    it('strips dot from pasted text for NoneComma separator', () => {
      const params = makeParams({}, { separator: SeparatorType.NoneComma });
      expect(helper.serializeValue('1.23', params)).toBe(123);
    });
  });

  describe('parseValue', () => {
    it('returns formatted string for numeric value', () => {
      const result = helper.parseValue(42.1, makeParams());
      expect(result).toBeDefined();
      expect(result).not.toBe('');
    });

    it('returns empty string for null', () => {
      expect(helper.parseValue(null, makeParams())).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(helper.parseValue(undefined, makeParams())).toBe('');
    });

    it('formats with precision', () => {
      const params = makeParams({}, { precision: 2 });
      const result = helper.parseValue(42.123, params);
      // parseDecimalValue rounds to precision
      expect(result).toContain('42.12');
    });

    it('formats with comma decimal separator', () => {
      const params = makeParams({}, { separator: SeparatorType.NoneComma, precision: 2 });
      const result = helper.parseValue(42.12, params);
      expect(result).toContain('42,12');
    });

    it('formats with thousand separator', () => {
      const params = makeParams({}, { separator: SeparatorType.CommaPeriod, precision: 2 });
      const result = helper.parseValue(1234567.89, params);
      expect(result).toBe('1,234,567.89');
    });

    it('returns null for NaN value', () => {
      expect(helper.parseValue(NaN, makeParams())).toBeNull();
    });
  });

  describe('parsePlainCellValue', () => {
    it('returns formatted string for numeric value', () => {
      const result = helper.parsePlainCellValue(42.1, makeParams());
      expect(typeof result).toBe('string');
      expect(result).not.toBe('');
    });

    it('returns empty string for null', () => {
      expect(helper.parsePlainCellValue(null, makeParams())).toBe('');
    });

    it('returns empty string for NaN', () => {
      expect(helper.parsePlainCellValue(NaN, makeParams())).toBe('');
    });

    it('treats NaN as 0 when isAggregation is true', () => {
      const params = makeParams({ isAggregation: true });
      const result = helper.parsePlainCellValue(NaN, params);
      expect(result).not.toBe('');
      expect(result).toContain('0');
    });

    it('formats with precision and separator', () => {
      const params = makeParams({}, { separator: SeparatorType.CommaPeriod, precision: 2 });
      const result = helper.parsePlainCellValue(1234567.89, params);
      expect(result).toBe('1,234,567.89');
    });
  });
});
