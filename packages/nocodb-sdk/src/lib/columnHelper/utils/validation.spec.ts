import { isValidPhoneNumber } from '.';

describe('isValidPhoneNumber', () => {
  it('accepts plain and spaced numbers', () => {
    expect(isValidPhoneNumber('+919845012345')).toBe(true);
    expect(isValidPhoneNumber('+91 98450 12345')).toBe(true);
    expect(isValidPhoneNumber('(415) 555-2671')).toBe(true);
    expect(isValidPhoneNumber(4155552671)).toBe(true);
  });

  it('rejects non-numbers', () => {
    expect(isValidPhoneNumber('')).toBe(false);
    expect(isValidPhoneNumber(null)).toBe(false);
    expect(isValidPhoneNumber(undefined)).toBe(false);
    expect(isValidPhoneNumber('call me')).toBe(false);
    expect(isValidPhoneNumber('12')).toBe(false);
  });
});
