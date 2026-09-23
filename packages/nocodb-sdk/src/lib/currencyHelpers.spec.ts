import {
  getCurrencyDecimalSymbol,
  getCurrencyFormatExample,
  getCurrencySymbol,
  getNumericValue,
  normalizeLocaleNumericString,
} from './currencyHelpers';

describe('currencyHelpers', () => {
  describe('getCurrencySymbol', () => {
    it('resolves the symbol for USD / en-US', () => {
      expect(getCurrencySymbol('USD', 'en-US')).toBe('$');
    });
    it('resolves the symbol for EUR / de-DE', () => {
      expect(getCurrencySymbol('EUR', 'de-DE')).toBe('€');
    });
    it('resolves the symbol for INR / en-IN', () => {
      expect(getCurrencySymbol('INR', 'en-IN')).toBe('₹');
    });
    it('defaults to USD / en-US when args are omitted', () => {
      expect(getCurrencySymbol()).toBe('$');
    });
    it('falls back to the code on an invalid currency', () => {
      expect(getCurrencySymbol('NOTACODE', 'en-US')).toBe('NOTACODE');
    });
  });

  describe('getCurrencyFormatExample', () => {
    it('renders a USD example at precision 2', () => {
      expect(getCurrencyFormatExample('USD', 'en-US', 2)).toBe('$1,234.56');
    });
    it('honours precision 0', () => {
      expect(getCurrencyFormatExample('USD', 'en-US', 0)).toBe('$1,235');
    });
  });

  describe('getCurrencyDecimalSymbol', () => {
    it('reads the currency format, which can disagree with the plain one', () => {
      // fr-CH/en-FI/en-SE/en-BE render plain numbers with ',' but currency
      // with '.', so the plain format is the wrong source for parsing a cell.
      expect(getCurrencyDecimalSymbol('EUR', 'fr-CH')).toBe('.');
      expect(getCurrencyDecimalSymbol('EUR', 'en-BE')).toBe('.');
      expect(getCurrencyDecimalSymbol('EUR', 'de-DE')).toBe(',');
      expect(getCurrencyDecimalSymbol('USD', 'en-US')).toBe('.');
    });
    it('falls back to a period on nonsense input', () => {
      expect(getCurrencyDecimalSymbol('NOTACODE', 'en-US')).toBe('.');
    });
  });

  describe('normalizeLocaleNumericString', () => {
    const forLocale = (value: string, locale: string) =>
      normalizeLocaleNumericString(
        value,
        getCurrencyDecimalSymbol('EUR', locale)
      );

    // A separator that is not grouping is a decimal point. Deleting it
    // multiplied de-DE/pt-BR/it-IT values by 100 (nocodb/nocodb#14563).
    it.each(['de-DE', 'pt-BR', 'it-IT'])(
      'reads a lone period as the decimal point in %s, whose group char is a period',
      (locale) => {
        expect(forLocale('1234.56', locale)).toBe('1234.56');
        expect(forLocale('-1234.56', locale)).toBe('-1234.56');
      }
    );

    // Both separators present: the later one is the fraction, whatever the
    // locale says, so a value pasted from another convention still reads.
    it('resolves both conventions when both separators are present', () => {
      expect(forLocale('1.234.567,89', 'de-DE')).toBe('1234567.89');
      expect(forLocale('1,234,567.89', 'de-DE')).toBe('1234567.89');
      expect(forLocale('1,234,567.89', 'fr-SN')).toBe('1234567.89');
      expect(forLocale('1,234.56', 'en-US')).toBe('1234.56');
      // en-IN groups in twos above the thousand
      expect(forLocale('12,34,567.89', 'en-IN')).toBe('1234567.89');
    });

    // Three digits behind a lone separator is genuinely ambiguous, so the
    // column's own format decides, and it must decide differently per locale.
    it('lets the locale settle the ambiguous three-digit case', () => {
      expect(forLocale('1.234', 'en-US')).toBe('1.234');
      expect(forLocale('1.234', 'de-DE')).toBe('1234');
      expect(forLocale('1,234', 'en-US')).toBe('1234');
    });

    it('treats a repeated separator as grouping', () => {
      expect(forLocale('1.234.567', 'de-DE')).toBe('1234567');
      expect(forLocale('1,234,567', 'en-US')).toBe('1234567');
    });

    // A precision-3 currency in a locale whose plain format uses ',' — this is
    // what broke when the separator was read from the plain number format.
    it('keeps a three-digit fraction when the currency format says period', () => {
      expect(forLocale('3116.500', 'fr-CH')).toBe('3116.500');
      expect(forLocale('1.00', 'en-BE')).toBe('1.00');
    });

    it('drops the symbol and every group separator flavour', () => {
      // fr-SN groups with U+202F, ru-RU with U+00A0, de-CH with an apostrophe.
      expect(forLocale('3\u202f116,50\u00a0€', 'fr-SN')).toBe('3116.50');
      expect(forLocale('1234567,89\u00a0₽', 'ru-RU')).toBe('1234567.89');
      expect(forLocale("1'234.56", 'de-CH')).toBe('1234.56');
    });

    it('defaults to a period separator when none is given', () => {
      expect(normalizeLocaleNumericString('1234.56')).toBe('1234.56');
    });
  });

  describe('getNumericValue', () => {
    it('will parse a correct number', () => {
      const strVal = '1,234.5';
      const locale = 'us-US';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(true);
      expect(result.pointDecimalValue).toBe('1234.5');
    });
    it('will parse a correct number for german locale', () => {
      const strVal = '1.234,5';
      const locale = 'de-DE';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(true);
      expect(result.pointDecimalValue).toBe('1234.5');
    });
    it('will parse a correct number for german locale with currency', () => {
      const strVal = '€ 1.234,5';
      const locale = 'de-DE';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(true);
      expect(result.pointDecimalValue).toBe('1234.5');
    });
    it('will parse a correct number for USD with currency', () => {
      const strVal = '$ 1,234.5';
      const locale = 'us-US';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(true);
      expect(result.pointDecimalValue).toBe('1234.5');
    });
    it('will parse a incorrect correct number', () => {
      const strVal = '1.234,5';
      const locale = 'us-US';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(false);
      expect(result.pointDecimalValue).toBe(undefined);
    });
    it('will parse an incorrect correct number due to misplaced thousand separator', () => {
      const strVal = '1,2';
      const locale = 'us-US';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(false);
      expect(result.pointDecimalValue).toBe(undefined);
    });
    it('will parse an incorrect number for german locale', () => {
      const strVal = '1,234.5';
      const locale = 'de-DE';
      const result = getNumericValue(strVal, locale);
      expect(result.isValid).toBe(false);
      expect(result.pointDecimalValue).toBe(undefined);
    });
  });
});
