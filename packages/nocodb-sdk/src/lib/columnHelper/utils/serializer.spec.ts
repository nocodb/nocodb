import {
  serializeCurrencyValue,
  serializeDecimalValue,
  serializeExcelDateValue,
  serializeIntValue,
} from './serializer';
import { parseCurrencyValue } from './parser';
import { SeparatorType } from './common';
import UITypes from '~/lib/UITypes';

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
      expect(
        serializeDecimalValue(
          'abc',
          undefined,
          makeParams(SeparatorType.NonePeriod)
        )
      ).toBeNull();
    });
  });

  describe('NonePeriod (no thousand sep, "." decimal)', () => {
    const params = makeParams(SeparatorType.NonePeriod);

    it('parses simple decimal', () => {
      expect(serializeDecimalValue('1234.56', undefined, params)).toBe(1234.56);
    });

    it('strips non-numeric characters', () => {
      expect(serializeDecimalValue('$1234.56', undefined, params)).toBe(
        1234.56
      );
    });

    it('handles negative', () => {
      expect(serializeDecimalValue('-99.5', undefined, params)).toBe(-99.5);
    });

    it('handles a U+2212 minus sign', () => {
      expect(serializeDecimalValue('\u221299.5', undefined, params)).toBe(
        -99.5
      );
    });

    it('keeps a leading minus padded with whitespace', () => {
      expect(serializeDecimalValue(' -99.5 ', undefined, params)).toBe(-99.5);
    });

    it('truncates at second decimal separator and strips non-numeric', () => {
      // a1,234.5678,45 → no thousand sep removal → first "." at index 6
      // no second "." → stays a1,234.5678,45 → regex removes a and commas → 1234.567845
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(
        1234.567845
      );
    });

    it('truncates at second dot', () => {
      // 123.456.789 → first "." at 3, second "." at 7 → truncate to 123.456
      // regex cleanup → 123.456
      expect(serializeDecimalValue('123.456.789', undefined, params)).toBe(
        123.456
      );
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
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(
        1.2345678
      );
    });

    it('handles simple value with non-numeric prefix', () => {
      expect(serializeDecimalValue('$100,50', undefined, params)).toBe(100.5);
    });

    it('handles multiple commas', () => {
      // 1,2,3,4 → first "," at 1, second at 3 → truncate to 1,2
      // replace "," with "." → 1.2
      expect(serializeDecimalValue('1,2,3,4', undefined, params)).toBe(1.2);
    });

    it('treats period as noise when separator is NoneComma', () => {
      // For NoneComma, "," is the decimal separator and "." is not part of the
      // allowed char set — the strip regex removes it as noise. So "123.46"
      // becomes "12346". This matches the keystroke handler in DecimalInput.vue,
      // which also strips dots first when the column's decimal separator is ",".
      expect(serializeDecimalValue('123.46', undefined, params)).toBe(12346);
    });
  });

  describe('CommaPeriod ("," thousand, "." decimal)', () => {
    const params = makeParams(SeparatorType.CommaPeriod);

    it('strips thousand separator commas', () => {
      expect(serializeDecimalValue('1,234,567.89', undefined, params)).toBe(
        1234567.89
      );
    });

    it('handles value with non-numeric chars', () => {
      // a1,234.5678,45 → remove commas → a1234.567845 → no second "."
      // regex removes "a" → 1234.567845
      expect(serializeDecimalValue('a1,234.5678,45', undefined, params)).toBe(
        1234.567845
      );
    });

    it('handles negative with thousand separators', () => {
      expect(serializeDecimalValue('-1,000,000.50', undefined, params)).toBe(
        -1000000.5
      );
    });

    // a minus ahead of the digits is the sign, wherever the symbol sits
    it('keeps a minus that follows the currency symbol', () => {
      expect(serializeDecimalValue('$-100.50', undefined, params)).toBe(-100.5);
      expect(serializeDecimalValue('$ -1,234.56', undefined, params)).toBe(
        -1234.56
      );
    });
  });

  describe('PeriodComma ("." thousand, "," decimal)', () => {
    const params = makeParams(SeparatorType.PeriodComma);

    it('strips period thousand separators and uses comma as decimal', () => {
      expect(serializeDecimalValue('1.234.567,89', undefined, params)).toBe(
        1234567.89
      );
    });

    it('handles mixed input', () => {
      // a1.234,5678 → remove "." → a1234,5678 → replace "," with "." → a1234.5678
      // regex removes "a" → 1234.5678
      expect(serializeDecimalValue('a1.234,5678', undefined, params)).toBe(
        1234.5678
      );
    });
  });

  describe('SpacePeriod (NBSP thousand, "." decimal)', () => {
    const params = makeParams(SeparatorType.SpacePeriod);

    it('strips non-breaking space thousand separators', () => {
      expect(
        serializeDecimalValue('1\u00A0234\u00A0567.89', undefined, params)
      ).toBe(1234567.89);
    });
  });

  describe('SpaceComma (NBSP thousand, "," decimal)', () => {
    const params = makeParams(SeparatorType.SpaceComma);

    it('strips non-breaking space and uses comma as decimal', () => {
      expect(
        serializeDecimalValue('1\u00A0234\u00A0567,89', undefined, params)
      ).toBe(1234567.89);
    });
  });

  describe('no params (fallback path)', () => {
    it('strips whitespace and non-numeric chars', () => {
      expect(serializeDecimalValue('$1,234.56')).toBe(1234.56);
    });

    it('handles negative', () => {
      expect(serializeDecimalValue('-42.5')).toBe(-42.5);
    });

    it('handles a U+2212 minus sign', () => {
      expect(serializeDecimalValue('\u221242.5')).toBe(-42.5);
    });

    it('drops a minus that follows the digits', () => {
      expect(serializeDecimalValue('100-50')).toBe(10050);
      expect(serializeDecimalValue('1,234.56-')).toBe(1234.56);
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
          column: {
            meta: JSON.stringify({ separator: SeparatorType.NonePeriod }),
          },
        },
      } as any;
      expect(serializeDecimalValue('1.23', undefined, params)).toBe(1.23);
    });
  });
});

describe('serializeIntValue', () => {
  const params = makeParams(SeparatorType.CommaPeriod);

  it('truncates the fractional part', () => {
    expect(serializeIntValue('1,234.56', params)).toBe(1234);
  });

  it('keeps a leading minus', () => {
    expect(serializeIntValue('-1,234.56', params)).toBe(-1234);
  });

  it('keeps a leading minus padded with whitespace', () => {
    expect(serializeIntValue(' -1,234.56 ', params)).toBe(-1234);
  });

  it('keeps a U+2212 minus sign', () => {
    expect(serializeIntValue('\u22121,234.56', params)).toBe(-1234);
  });

  it('keeps a minus that follows the currency symbol', () => {
    expect(serializeIntValue('$-1,234.56', params)).toBe(-1234);
  });

  it('drops a minus that follows the digits', () => {
    expect(serializeIntValue('1,234.56-', params)).toBe(1234);
  });

  it('returns null for a non-numeric string', () => {
    expect(serializeIntValue('abc', params)).toBeNull();
  });
});

describe('serializeCurrencyValue', () => {
  function currencyParams(currency_locale?: string) {
    return {
      col: {
        meta: JSON.stringify({ currency_locale, currency_code: 'USD' }),
      },
    } as any;
  }

  describe('en-US (fast path)', () => {
    const params = currencyParams('en-US');

    it('keeps a leading minus', () => {
      expect(serializeCurrencyValue('-100.50', params)).toBe(-100.5);
    });

    it('keeps a leading minus ahead of the currency symbol', () => {
      expect(serializeCurrencyValue('-$1,234.56', params)).toBe(-1234.56);
    });

    it('keeps a leading minus padded with whitespace', () => {
      expect(serializeCurrencyValue(' -100.50 ', params)).toBe(-100.5);
    });

    it('keeps a U+2212 minus sign', () => {
      expect(serializeCurrencyValue('\u2212100.50', params)).toBe(-100.5);
    });

    it('strips symbols and group separators from positive values', () => {
      expect(serializeCurrencyValue('$1,234.56', params)).toBe(1234.56);
    });

    it('keeps a minus that follows the currency symbol', () => {
      expect(serializeCurrencyValue('$-100.50', params)).toBe(-100.5);
      expect(serializeCurrencyValue('$ -1,234.56', params)).toBe(-1234.56);
    });

    it('drops a minus that follows the digits', () => {
      expect(serializeCurrencyValue('100-50', params)).toBe(10050);
    });

    it('returns null for a non-numeric string', () => {
      expect(serializeCurrencyValue('abc', params)).toBeNull();
    });
  });

  it('applies the same rule when no locale is set', () => {
    expect(serializeCurrencyValue('-100.50', currencyParams())).toBe(-100.5);
  });

  it('keeps a leading minus on the locale-aware path', () => {
    expect(serializeCurrencyValue('-1.234,56', currencyParams('de-DE'))).toBe(
      -1234.56
    );
  });

  // sv-SE is one of 36 selectable locales whose Intl.NumberFormat output uses
  // U+2212 for the sign (also fi, nb, nn, hr, et, sl, lt, eu, fo, gsw, se, ksh).
  it('round-trips a negative value rendered by a U+2212 locale', () => {
    const params = currencyParams('sv-SE');
    const rendered = parseCurrencyValue(-1234.56, params.col) as string;

    expect(rendered).toContain('\u2212');
    expect(serializeCurrencyValue(rendered, params)).toBe(-1234.56);
  });

  it('prefers a numeric clipboard dbCellValue over the string', () => {
    const params = {
      ...currencyParams('en-US'),
      clipboardItem: { dbCellValue: -42.5 },
    } as any;
    expect(serializeCurrencyValue('ignored', params)).toBe(-42.5);
  });
});

describe('serializeExcelDateValue', () => {
  const dateCol = { uidt: UITypes.Date } as any;
  const dateTimeCol = { uidt: UITypes.DateTime } as any;

  describe('empty values', () => {
    it('returns null for null', () => {
      expect(serializeExcelDateValue(null, dateCol)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(serializeExcelDateValue(undefined, dateCol)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(serializeExcelDateValue('', dateCol)).toBeNull();
    });
  });

  describe('non-numeric values are passed through untouched', () => {
    it('returns a Date instance as-is', () => {
      const d = new Date('2023-01-01T00:00:00Z');
      expect(serializeExcelDateValue(d, dateCol)).toBe(d);
    });

    it('returns an already-formatted date string as-is', () => {
      expect(serializeExcelDateValue('2023-01-01', dateCol)).toBe('2023-01-01');
    });
  });

  describe('Date column — serial → YYYY-MM-DD', () => {
    it('converts the Excel epoch serial (25569) to 1970-01-01', () => {
      expect(serializeExcelDateValue(25569, dateCol)).toBe('1970-01-01');
    });

    it('converts a modern serial (44927) to 2023-01-01', () => {
      expect(serializeExcelDateValue(44927, dateCol)).toBe('2023-01-01');
    });

    it('drops the time component for a fractional serial', () => {
      expect(serializeExcelDateValue(44927.5, dateCol)).toBe('2023-01-01');
    });

    it('handles pre-1970 serials (positive integers below the epoch)', () => {
      // serial 1 = 1899-12-31 in the Excel 1900 date system
      expect(serializeExcelDateValue(1, dateCol)).toBe('1899-12-31');
    });
  });

  describe('DateTime column — serial → YYYY-MM-DD HH:mm:ss+00:00', () => {
    it('converts a whole-day serial at midnight UTC', () => {
      expect(serializeExcelDateValue(44927, dateTimeCol)).toBe(
        '2023-01-01 00:00:00+00:00'
      );
    });

    it('converts a fractional serial to the matching UTC time', () => {
      expect(serializeExcelDateValue(44927.5, dateTimeCol)).toBe(
        '2023-01-01 12:00:00+00:00'
      );
    });

    it('converts a three-quarter-day serial (18:00 UTC)', () => {
      expect(serializeExcelDateValue(45658.75, dateTimeCol)).toBe(
        '2025-01-01 18:00:00+00:00'
      );
    });
  });
});
