import { serializeDecimalValue } from './serializer';
import { SeparatorType } from './common';

function makeParams(separator: SeparatorType) {
  return {
    col: {
      meta: JSON.stringify({ separator }),
    },
  } as any;
}

describe('serializeDecimalValue', () => {
  describe('basic values', () => {
    it('returns number for numeric input', () => {
      expect(serializeDecimalValue(42)).toBe(42);
    });

    it('returns null for empty string', () => {
      expect(serializeDecimalValue('')).toBeNull();
    });

    it('returns null for null', () => {
      expect(serializeDecimalValue(null)).toBeNull();
    });

    it('returns null for pure non-numeric string', () => {
      expect(serializeDecimalValue('abc', undefined, makeParams(SeparatorType.NonePeriod))).toBeNull();
    });
  });

  describe('NonePeriod (no thousand sep, "." decimal)', () => {
    const params = makeParams(SeparatorType.NonePeriod);

    it('parses simple decimal', () => {
      expect(serializeDecimalValue('1234.56', undefined, params)).toBe(1234.56);
    });

    it('strips non-numeric characters', () => {
      expect(serializeDecimalValue('$1234.56', undefined, params)).toBe(1234.56);
    });

    it('handles negative', () => {
      expect(serializeDecimalValue('-99.5', undefined, params)).toBe(-99.5);
    });

    it('truncates at second decimal separator and strips non-numeric', () => {
      // a1,234.5678,45 → no thousand sep removal → first "." at index 6
      // no second "." → stays a1,234.5678,45 → regex removes a and commas → 1234.567845
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(1234.567845);
    });

    it('truncates at second dot', () => {
      // 123.456.789 → first "." at 3, second "." at 7 → truncate to 123.456
      // regex cleanup → 123.456
      expect(serializeDecimalValue('123.456.789', undefined, params)).toBe(123.456);
    });

    it('handles multiple dots by keeping only up to second', () => {
      expect(serializeDecimalValue('1.2.3.4', undefined, params)).toBe(1.2);
    });
  });

  describe('NoneComma (no thousand sep, "," decimal)', () => {
    const params = makeParams(SeparatorType.NoneComma);

    it('parses comma as decimal', () => {
      expect(serializeDecimalValue('1234,56', undefined, params)).toBe(1234.56);
    });

    it('truncates at second comma and cleans non-numeric', () => {
      // a1,234.5678,45 → no thousand sep → first "," at 2, second "," at 12
      // truncate → a1,234.5678 → replace "," with "." → a1.234.5678
      // regex removes "a" → 1.234.5678 → remove duplicate dots → 1.2345678
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(1.2345678);
    });

    it('handles simple value with non-numeric prefix', () => {
      expect(serializeDecimalValue('$100,50', undefined, params)).toBe(100.5);
    });

    it('handles multiple commas', () => {
      // 1,2,3,4 → first "," at 1, second at 3 → truncate to 1,2
      // replace "," with "." → 1.2
      expect(serializeDecimalValue('1,2,3,4', undefined, params)).toBe(1.2);
    });

    it('accepts period-based value pasted into comma-decimal field', () => {
      // 123.46 → no thousand sep to remove → first "," not found → no truncation
      // no "," to replace with "." → stays 123.46 → regex keeps digits/dot/minus → 123.46
      // The "." passes through because it is not the column's decimal separator
      expect(serializeDecimalValue('123.46', undefined, params)).toBe(12346);
    });
  });

  describe('CommaPeriod ("," thousand, "." decimal)', () => {
    const params = makeParams(SeparatorType.CommaPeriod);

    it('strips thousand separator commas', () => {
      expect(serializeDecimalValue('1,234,567.89', undefined, params)).toBe(1234567.89);
    });

    it('handles value with non-numeric chars', () => {
      // a1,234.5678,45 → remove commas → a1234.567845 → no second "."
      // regex removes "a" → 1234.567845
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(1234.567845);
    });

    it('handles negative with thousand separators', () => {
      expect(serializeDecimalValue('-1,000,000.50', undefined, params)).toBe(-1000000.5);
    });
  });

  describe('PeriodComma ("." thousand, "," decimal)', () => {
    const params = makeParams(SeparatorType.PeriodComma);

    it('strips period thousand separators and uses comma as decimal', () => {
      expect(serializeDecimalValue('1.234.567,89', undefined, params)).toBe(1234567.89);
    });

    it('handles mixed input', () => {
      // a1.234,5678 → remove "." → a1234,5678 → replace "," with "." → a1234.5678
      // regex removes "a" → 1234.5678
      expect(serializeDecimalValue('a1.234,5678', undefined, params)).toBe(1234.5678);
    });
  });

  describe('SpacePeriod (NBSP thousand, "." decimal)', () => {
    const params = makeParams(SeparatorType.SpacePeriod);

    it('strips non-breaking space thousand separators', () => {
      expect(serializeDecimalValue('1\u00A0234\u00A0567.89', undefined, params)).toBe(1234567.89);
    });
  });

  describe('SpaceComma (NBSP thousand, "," decimal)', () => {
    const params = makeParams(SeparatorType.SpaceComma);

    it('strips non-breaking space and uses comma as decimal', () => {
      expect(serializeDecimalValue('1\u00A0234\u00A0567,89', undefined, params)).toBe(1234567.89);
    });
  });

  describe('no params (fallback path)', () => {
    it('strips whitespace and non-numeric chars', () => {
      expect(serializeDecimalValue('$1,234.56')).toBe(1234.56);
    });

    it('handles negative', () => {
      expect(serializeDecimalValue('-42.5')).toBe(-42.5);
    });
  });

  describe('clipboard data shortcut', () => {
    it('uses dbCellValue from clipboard when available', () => {
      const params = {
        col: { meta: '{}' },
        clipboardItem: { dbCellValue: 99.99 },
      } as any;
      expect(serializeDecimalValue('ignored', undefined, params)).toBe(99.99);
    });

    it('uses dbCellValue even when source and target separators differ', () => {
      const params = {
        col: { meta: JSON.stringify({ separator: SeparatorType.NoneComma }) },
        clipboardItem: {
          dbCellValue: 1.23,
          column: { meta: JSON.stringify({ separator: SeparatorType.NonePeriod }) },
        },
      } as any;
      expect(serializeDecimalValue('1.23', undefined, params)).toBe(1.23);
    });
  });
});
