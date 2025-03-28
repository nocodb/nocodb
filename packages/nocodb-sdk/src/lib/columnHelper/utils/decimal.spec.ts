import { composeNewDecimalValue, extractDecimalFromString } from './decimal';

describe('decimal-utils', () => {
  describe('extractDecimalFromString', () => {
    it('will extract from alnum string', () => {
      const sourceText = 'USD $ 123456.001231 Hello World';
      const expected = '123456.001231';
      const result = extractDecimalFromString(sourceText);
      expect(result).toBe(expected);
    });
    it('will remove 2nd and more occurrence of decimal point', () => {
      const sourceText = '123.456.0-01.231';
      const expected = '123.456001231';
      const result = extractDecimalFromString(sourceText);
      expect(result).toBe(expected);
    });
    it('will extract valid minus value', () => {
      const sourceText = '-123.456.001.231';
      const expected = '-123.456001231';
      const result = extractDecimalFromString(sourceText);
      expect(result).toBe(expected);
    });
  });
  describe('composeNewDecimalValue', () => {
    it('will paste from the start', () => {
      const oldValue = '333';
      const sourceText = 'USD $ 111.111 Hello World';
      const expected = '111.111333';
      const result = composeNewDecimalValue({
        selectionStart: 0,
        selectionEnd: 0,
        newValue: sourceText,
        lastValue: oldValue,
      });
      expect(result).toBe(expected);
    });
    it('will paste from the end', () => {
      const oldValue = '333';
      const sourceText = 'USD $ -111.111 Hello World';
      const expected = '333111.111';
      const result = composeNewDecimalValue({
        selectionStart: 3,
        selectionEnd: 3,
        newValue: sourceText,
        lastValue: oldValue,
      });
      expect(result).toBe(expected);
    });
    it('will paste from the middle', () => {
      const oldValue = '333444';
      const sourceText = 'USD $ -111.111 Hello World';
      const expected = '33111.11144';
      const result = composeNewDecimalValue({
        selectionStart: 2,
        selectionEnd: 4,
        newValue: sourceText,
        lastValue: oldValue,
      });
      expect(result).toBe(expected);
    });
    it('will paste from the start negative', () => {
      const oldValue = '333';
      const sourceText = 'USD $ -111.111 Hello World';
      const expected = '-111.111333';
      const result = composeNewDecimalValue({
        selectionStart: 0,
        selectionEnd: 0,
        newValue: sourceText,
        lastValue: oldValue,
      });
      expect(result).toBe(expected);
    });
    it('will paste from the middle part 2', () => {
      const oldValue = '33.3444';
      const sourceText = 'USD $ 111.111 Hello World';
      const expected = '33.11111144';
      const result = composeNewDecimalValue({
        selectionStart: 3,
        selectionEnd: 5,
        newValue: sourceText,
        lastValue: oldValue,
      });
      expect(result).toBe(expected);
    });
  });
});
