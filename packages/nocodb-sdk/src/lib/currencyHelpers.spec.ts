import {
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

  describe('normalizeLocaleNumericString', () => {
    // A group character that is not grouping is a decimal point. Deleting it
    // multiplied de-DE/pt-BR/it-IT values by 100 (nocodb/nocodb#14563).
    it.each(['de-DE', 'pt-BR', 'it-IT'])(
      'reads a lone period as the decimal point in %s, whose group char is a period',
      (locale) => {
        expect(normalizeLocaleNumericString('1234.56', locale)).toBe('1234.56');
      }
    );

    it('still strips periods that really are grouping in de-DE', () => {
      expect(normalizeLocaleNumericString('1.234.567,89', 'de-DE')).toBe(
        '1234567.89'
      );
      expect(normalizeLocaleNumericString('1.234', 'de-DE')).toBe('1234');
    });

    // The locale's own decimal char settles the reading when present, so an
    // en-US "1.234" must stay 1.234 rather than being read as grouping.
    it('leaves an en-US decimal alone', () => {
      expect(normalizeLocaleNumericString('1.234', 'en-US')).toBe('1.234');
      expect(normalizeLocaleNumericString('1,234.56', 'en-US')).toBe('1234.56');
    });

    it('drops the symbol and every group separator flavour', () => {
      // fr-SN groups with U+202F, ru-RU with U+00A0, de-CH with an apostrophe.
      expect(normalizeLocaleNumericString('3\u202f116,50\u00a0€', 'fr-SN')).toBe(
        '3116.50'
      );
      expect(normalizeLocaleNumericString('1234567,89\u00a0₽', 'ru-RU')).toBe(
        '1234567.89'
      );
      expect(normalizeLocaleNumericString("1'234.56", 'de-CH')).toBe('1234.56');
    });

    it('keeps the minus for the caller to resolve', () => {
      expect(normalizeLocaleNumericString('-1234.56', 'de-DE')).toBe('-1234.56');
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
