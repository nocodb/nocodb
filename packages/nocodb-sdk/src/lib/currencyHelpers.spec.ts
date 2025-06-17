import { getNumericValue } from './currencyHelpers';

describe('currencyHelpers', () => {
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
