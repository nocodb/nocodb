import { ColourHelper } from './Colour';
import { SilentTypeConversionError } from '~/lib/error';

describe('ColourHelper', () => {
  const helper = new ColourHelper();

  describe('columnDefaultMeta', () => {
    it('has sensible defaults', () => {
      expect(helper.columnDefaultMeta).toEqual({
        defaultColor: '#FFFFFF',
        displayFormat: 'swatch_hex',
        swatchStyle: 'circle',
        swatchSize: 'medium',
      });
    });
  });

  describe('serializeValue', () => {
    const baseParams = {
      isMultipleCellPaste: false,
      serializeSearchQuery: false,
    } as any;

    it('normalizes lowercase hex to uppercase', () => {
      expect(helper.serializeValue('#ff5733', baseParams)).toBe('#FF5733');
    });

    it('adds # prefix when missing', () => {
      expect(helper.serializeValue('ff5733', baseParams)).toBe('#FF5733');
    });

    it('returns null for null/undefined/empty', () => {
      expect(helper.serializeValue(null, baseParams)).toBeNull();
      expect(helper.serializeValue(undefined, baseParams)).toBeNull();
      expect(helper.serializeValue('', baseParams)).toBeNull();
    });

    it('throws SilentTypeConversionError for whitespace-only string', () => {
      expect(() => helper.serializeValue('  ', baseParams)).toThrow(
        SilentTypeConversionError
      );
    });

    it('throws SilentTypeConversionError for invalid hex in normal mode', () => {
      expect(() => helper.serializeValue('not-a-color', baseParams)).toThrow(
        SilentTypeConversionError
      );
    });

    it('returns null for invalid hex during multi-cell paste', () => {
      const pasteParams = { ...baseParams, isMultipleCellPaste: true };
      expect(helper.serializeValue('not-a-color', pasteParams)).toBeNull();
    });

    it('returns null for invalid hex during search query serialization', () => {
      const searchParams = { ...baseParams, serializeSearchQuery: true };
      expect(helper.serializeValue('not-a-color', searchParams)).toBeNull();
    });

    it('handles value with leading/trailing whitespace', () => {
      expect(helper.serializeValue('  #FF5733  ', baseParams)).toBe('#FF5733');
    });

    it('rejects 3-digit shorthand', () => {
      expect(() => helper.serializeValue('#F53', baseParams)).toThrow(
        SilentTypeConversionError
      );
    });

    it('rejects rgb() format', () => {
      expect(() => helper.serializeValue('rgb(255,87,51)', baseParams)).toThrow(
        SilentTypeConversionError
      );
    });
  });

  describe('parseValue', () => {
    it('normalizes valid hex', () => {
      expect(helper.parseValue('#ff5733')).toBe('#FF5733');
      expect(helper.parseValue('ff5733')).toBe('#FF5733');
    });

    it('returns null for null/undefined/empty', () => {
      expect(helper.parseValue(null)).toBeNull();
      expect(helper.parseValue(undefined)).toBeNull();
      expect(helper.parseValue('')).toBeNull();
    });

    it('returns null for invalid values', () => {
      expect(helper.parseValue('not-a-color')).toBeNull();
      expect(helper.parseValue('#GGG000')).toBeNull();
    });
  });

  describe('parsePlainCellValue', () => {
    const params = {} as any;

    it('returns normalized hex string', () => {
      expect(helper.parsePlainCellValue('#ff5733', params)).toBe('#FF5733');
    });

    it('returns empty string for null/invalid', () => {
      expect(helper.parsePlainCellValue(null, params)).toBe('');
      expect(helper.parsePlainCellValue('invalid', params)).toBe('');
    });
  });
});
