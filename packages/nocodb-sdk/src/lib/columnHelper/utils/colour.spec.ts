import {
  HEX_COLOUR_REGEX,
  HEX_COLOUR_WITH_ALPHA_REGEX,
  isValidHexColour,
  normalizeHexColour,
  normalizeHexColourWithAlpha,
} from './colour';

describe('colour utilities', () => {
  describe('HEX_COLOUR_REGEX', () => {
    it('matches 6-digit hex with #', () => {
      expect('#FF5733'.match(HEX_COLOUR_REGEX)).toBeTruthy();
    });
    it('matches 6-digit hex without #', () => {
      expect('ff5733'.match(HEX_COLOUR_REGEX)).toBeTruthy();
    });
    it('rejects 3-digit shorthand', () => {
      expect('#F53'.match(HEX_COLOUR_REGEX)).toBeNull();
    });
    it('rejects 8-digit hex (with alpha)', () => {
      expect('#FF5733AA'.match(HEX_COLOUR_REGEX)).toBeNull();
    });
    it('rejects non-hex characters', () => {
      expect('#GGGGGG'.match(HEX_COLOUR_REGEX)).toBeNull();
    });
  });

  describe('HEX_COLOUR_WITH_ALPHA_REGEX', () => {
    it('matches 6-digit hex', () => {
      expect('#FF5733'.match(HEX_COLOUR_WITH_ALPHA_REGEX)).toBeTruthy();
    });
    it('matches 8-digit hex (with alpha)', () => {
      const match = '#FF5733AA'.match(HEX_COLOUR_WITH_ALPHA_REGEX);
      expect(match).toBeTruthy();
      expect(match![1]).toBe('FF5733');
      expect(match![2]).toBe('AA');
    });
    it('rejects 7-digit values', () => {
      expect('#FF5733A'.match(HEX_COLOUR_WITH_ALPHA_REGEX)).toBeNull();
    });
  });

  describe('normalizeHexColour', () => {
    it('normalizes lowercase to uppercase with #', () => {
      expect(normalizeHexColour('ff5733')).toBe('#FF5733');
    });
    it('normalizes value already with #', () => {
      expect(normalizeHexColour('#ff5733')).toBe('#FF5733');
    });
    it('preserves already-uppercase value', () => {
      expect(normalizeHexColour('#FF5733')).toBe('#FF5733');
    });
    it('returns null for empty string', () => {
      expect(normalizeHexColour('')).toBeNull();
    });
    it('returns null for null', () => {
      expect(normalizeHexColour(null)).toBeNull();
    });
    it('returns null for undefined', () => {
      expect(normalizeHexColour(undefined)).toBeNull();
    });
    it('returns null for invalid hex', () => {
      expect(normalizeHexColour('not-a-color')).toBeNull();
    });
    it('returns null for 3-digit shorthand', () => {
      expect(normalizeHexColour('#F53')).toBeNull();
    });
    it('returns null for 8-digit hex (alpha not accepted)', () => {
      expect(normalizeHexColour('#FF5733AA')).toBeNull();
    });
    it('trims whitespace', () => {
      expect(normalizeHexColour('  #FF5733  ')).toBe('#FF5733');
    });
    it('accepts numeric value whose digits happen to be valid hex', () => {
      // String(123456) = '123456' which IS valid hex
      expect(normalizeHexColour(123456)).toBe('#123456');
    });
    it('handles zero', () => {
      expect(normalizeHexColour(0)).toBeNull();
    });
  });

  describe('normalizeHexColourWithAlpha', () => {
    it('normalizes 6-digit hex', () => {
      expect(normalizeHexColourWithAlpha('#ff5733')).toBe('#FF5733');
    });
    it('strips alpha channel from 8-digit hex', () => {
      expect(normalizeHexColourWithAlpha('#FF5733AA')).toBe('#FF5733');
    });
    it('strips alpha channel without # prefix', () => {
      expect(normalizeHexColourWithAlpha('ff5733aa')).toBe('#FF5733');
    });
    it('returns null for invalid values', () => {
      expect(normalizeHexColourWithAlpha('rgb(255,0,0)')).toBeNull();
    });
  });

  describe('isValidHexColour', () => {
    it('returns true for valid #RRGGBB', () => {
      expect(isValidHexColour('#FF5733')).toBe(true);
    });
    it('returns true for lowercase #rrggbb', () => {
      expect(isValidHexColour('#ff5733')).toBe(true);
    });
    it('returns false without # prefix', () => {
      expect(isValidHexColour('FF5733')).toBe(false);
    });
    it('returns false for null', () => {
      expect(isValidHexColour(null)).toBe(false);
    });
    it('returns false for undefined', () => {
      expect(isValidHexColour(undefined)).toBe(false);
    });
    it('returns false for non-string', () => {
      expect(isValidHexColour(123)).toBe(false);
    });
    it('returns false for empty string', () => {
      expect(isValidHexColour('')).toBe(false);
    });
    it('returns false for 8-digit hex', () => {
      expect(isValidHexColour('#FF5733AA')).toBe(false);
    });
  });
});
