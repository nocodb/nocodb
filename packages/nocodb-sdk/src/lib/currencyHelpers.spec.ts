import {
  getCurrencyFormatExample,
  getCurrencySymbol,
  getNumericValue,
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
