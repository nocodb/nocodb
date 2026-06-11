import {
  REGEXSTR_ALPHABET,
  REGEXSTR_CHINESE,
  REGEXSTR_CYRILLIC,
  REGEXSTR_INTL_LETTER,
  REGEXSTR_JAPANESE,
  REGEXSTR_NUMERIC_ARABIC,
} from './token';

describe('regex-token', () => {
  it('will test alphabet', () => {
    const testValue =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(testValue.match(new RegExp(`[${REGEXSTR_ALPHABET}]+`))[0]).toBe(
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    );
  });
  it('will test arabic numeral', () => {
    const testValue =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(
      testValue.match(new RegExp(`[${REGEXSTR_NUMERIC_ARABIC}]+`))[0]
    ).toBe('0123456789');
  });
  it('will test chinese letters', () => {
    const testValue =
      '新年快乐おはようございますЁёАяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(testValue.match(new RegExp(`[${REGEXSTR_CHINESE}]+`))[0]).toBe(
      '新年快乐'
    );
  });
  it('will test japanese letters', () => {
    const testValue =
      '新年快乐おはようございますЁёАяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(testValue.match(new RegExp(`[${REGEXSTR_JAPANESE}]+`))[0]).toBe(
      'おはようございます'
    );
  });
  it('will test cryillic letters', () => {
    const testValue =
      '新年快乐おはようございますЁёАяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(testValue.match(new RegExp(`[${REGEXSTR_CYRILLIC}]+`))[0]).toBe(
      'ЁёАя'
    );
  });
  it('will test international letters', () => {
    const testValue =
      '新年快乐おはようございますЁёАяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.';
    expect(testValue.match(new RegExp(`[${REGEXSTR_INTL_LETTER}]+`))[0]).toBe(
      '新年快乐おはようございますЁёАяabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    );
  });
});
