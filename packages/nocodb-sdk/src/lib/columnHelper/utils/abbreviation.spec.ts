import {
  abbreviateNumber,
  formatCurrencyValue,
  NumberAbbreviationType,
  resolveNumberAbbreviation,
  shouldAbbreviateNumber,
} from './abbreviation';
import { parseCurrencyValue, parseDecimalValue, parseIntValue } from './parser';
import { SeparatorType } from './common';

// Intl emits NBSP/NNBSP between number and symbol in some locales
const normalizeSpaces = (value: string) =>
  value.replace(/[\u00A0\u202F]/g, ' ');

describe('resolveNumberAbbreviation', () => {
  it('maps legacy boolean true to Auto', () => {
    expect(resolveNumberAbbreviation({ abbreviate: true })).toBe(
      NumberAbbreviationType.Auto
    );
  });

  it('accepts valid enum strings', () => {
    expect(resolveNumberAbbreviation({ abbreviate: 'million' })).toBe(
      NumberAbbreviationType.Million
    );
  });

  it('falls back to None for invalid values', () => {
    expect(resolveNumberAbbreviation({ abbreviate: 'bogus' })).toBe(
      NumberAbbreviationType.None
    );
    expect(resolveNumberAbbreviation({ abbreviate: false })).toBe(
      NumberAbbreviationType.None
    );
    expect(resolveNumberAbbreviation({})).toBe(NumberAbbreviationType.None);
    expect(resolveNumberAbbreviation(undefined)).toBe(
      NumberAbbreviationType.None
    );
  });
});

describe('shouldAbbreviateNumber', () => {
  it('is false for None and missing meta', () => {
    expect(shouldAbbreviateNumber({ abbreviate: 'none' })).toBe(false);
    expect(shouldAbbreviateNumber(null)).toBe(false);
  });

  it('is true for Auto and fixed units', () => {
    expect(shouldAbbreviateNumber({ abbreviate: 'auto' })).toBe(true);
    expect(shouldAbbreviateNumber({ abbreviate: 'thousand' })).toBe(true);
  });
});

describe('abbreviateNumber', () => {
  const auto = { abbreviate: NumberAbbreviationType.Auto };

  it('picks the unit by magnitude in Auto mode', () => {
    expect(abbreviateNumber(1500, auto)).toBe('1.5K');
    expect(abbreviateNumber(2_500_000, auto)).toBe('2.5M');
    expect(abbreviateNumber(3_400_000_000, auto)).toBe('3.4B');
    expect(abbreviateNumber(2_000_000_000_000, auto)).toBe('2T');
  });

  it('leaves values below 1000 unabbreviated in Auto mode', () => {
    expect(abbreviateNumber(500, auto)).toBe('500');
    expect(abbreviateNumber(999.4, auto, { precision: 1 })).toBe('999.4');
  });

  it('promotes across the unit boundary after rounding', () => {
    expect(abbreviateNumber(999999, auto, { precision: 1 })).toBe('1M');
    expect(abbreviateNumber(999999999, auto, { precision: 1 })).toBe('1B');
    expect(abbreviateNumber(999.99, auto, { precision: 1 })).toBe('1K');
  });

  it('does not promote when the precision resolves the boundary', () => {
    expect(abbreviateNumber(999.99, auto, { precision: 2 })).toBe('999.99');
  });

  it('handles negative values', () => {
    expect(abbreviateNumber(-1234567, auto, { precision: 1 })).toBe('-1.2M');
    expect(abbreviateNumber(-999999, auto, { precision: 1 })).toBe('-1M');
  });

  it('keeps the configured unit in fixed mode', () => {
    const thousand = { abbreviate: NumberAbbreviationType.Thousand };
    expect(abbreviateNumber(1234567, thousand, { precision: 1 })).toBe(
      '1234.6K'
    );
    expect(abbreviateNumber(999999, thousand, { precision: 1 })).toBe('1000K');
    expect(
      abbreviateNumber(1234567, { abbreviate: NumberAbbreviationType.Billion })
    ).toBe('0B');
  });

  it('drops trailing zeros', () => {
    expect(
      abbreviateNumber(
        1000000,
        { abbreviate: NumberAbbreviationType.Million },
        { precision: 2 }
      )
    ).toBe('1M');
  });

  it('honours the column separator config', () => {
    expect(
      abbreviateNumber(
        1234567890,
        {
          abbreviate: NumberAbbreviationType.Thousand,
          separator: SeparatorType.PeriodComma,
        },
        { precision: 1 }
      )
    ).toBe('1.234.567,9K');
    expect(
      abbreviateNumber(
        1234567890,
        {
          abbreviate: NumberAbbreviationType.Thousand,
          separator: SeparatorType.CommaPeriod,
        },
        { precision: 1 }
      )
    ).toBe('1,234,567.9K');
  });

  it('returns non-finite values as-is', () => {
    expect(abbreviateNumber(Infinity, auto)).toBe('Infinity');
    expect(abbreviateNumber(NaN, auto)).toBe('NaN');
  });
});

describe('formatCurrencyValue', () => {
  const usd = { currency_locale: 'en-US', currency_code: 'USD', precision: 2 };

  it('formats plain currency when abbreviation is off', () => {
    expect(formatCurrencyValue(1234.5, usd)).toBe('$1,234.50');
  });

  it('abbreviates with a fixed unit', () => {
    expect(
      formatCurrencyValue(1234567, { ...usd, abbreviate: 'million' })
    ).toBe('$1.23M');
  });

  it('attaches the suffix to the number for postfix-symbol locales', () => {
    const eur = {
      currency_locale: 'de-DE',
      currency_code: 'EUR',
      precision: 2,
      abbreviate: 'million',
    };
    expect(normalizeSpaces(formatCurrencyValue(1234567, eur))).toBe('1,23M €');
  });

  it('uses the K/M/B/T ladder in Auto mode', () => {
    expect(formatCurrencyValue(1234567, { ...usd, abbreviate: 'auto' })).toBe(
      '$1.23M'
    );
    expect(formatCurrencyValue(1500, { ...usd, abbreviate: 'auto' })).toBe(
      '$1.5K'
    );
    expect(formatCurrencyValue(500, { ...usd, abbreviate: 'auto' })).toBe(
      '$500'
    );
  });

  it('promotes across the unit boundary after rounding in Auto mode', () => {
    expect(formatCurrencyValue(999999999, { ...usd, abbreviate: 'auto' })).toBe(
      '$1B'
    );
  });

  it('treats legacy boolean true as Auto', () => {
    expect(formatCurrencyValue(1234567, { ...usd, abbreviate: true })).toBe(
      '$1.23M'
    );
  });

  it('skips abbreviation when requested', () => {
    expect(
      formatCurrencyValue(
        1234567,
        { ...usd, abbreviate: 'million' },
        {
          skipAbbreviation: true,
        }
      )
    ).toBe('$1,234,567.00');
  });
});

describe('edge cases', () => {
  const autoCurrency = {
    abbreviate: NumberAbbreviationType.Auto,
    currency_code: 'USD',
    currency_locale: 'en-US',
    precision: 2,
  };

  it('keeps the trillion unit when the mantissa exceeds 1000', () => {
    expect(
      abbreviateNumber(
        999999999999999,
        { abbreviate: NumberAbbreviationType.Auto },
        { precision: 1 }
      )
    ).toBe('1000T');
  });

  it('falls back to plain currency for non-finite values', () => {
    expect(formatCurrencyValue(Infinity, autoCurrency)).toBe(
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Infinity)
    );
  });

  it('parseCurrencyValue abbreviates by default and skips on request', () => {
    const col = { meta: JSON.stringify(autoCurrency) } as any;
    expect(parseCurrencyValue(1234567, col)).toBe('$1.23M');
    expect(parseCurrencyValue(1234567, col, { skipAbbreviation: true })).toBe(
      '$1,234,567.00'
    );
  });
});

describe('parser skipAbbreviation option', () => {
  const col = {
    meta: JSON.stringify({
      abbreviate: NumberAbbreviationType.Million,
      separator: SeparatorType.CommaPeriod,
      precision: 1,
    }),
  } as any;

  it('parseDecimalValue abbreviates by default and skips on request', () => {
    expect(parseDecimalValue(1234567.89, col)).toBe('1.2M');
    expect(parseDecimalValue(1234567.89, col, { skipAbbreviation: true })).toBe(
      '1,234,567.9'
    );
  });

  it('parseIntValue abbreviates by default and skips on request', () => {
    expect(parseIntValue(1234567, col)).toBe('1.2M');
    expect(parseIntValue(1234567, col, { skipAbbreviation: true })).toBe(
      '1,234,567'
    );
  });
});
