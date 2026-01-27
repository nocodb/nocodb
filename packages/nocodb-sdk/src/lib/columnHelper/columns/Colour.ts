import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class ColourHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    color: '#3366FF',
    displayFormat: 'swatch_and_hex', // 'swatch_and_hex' | 'swatch_only' | 'hex_only'
    swatchStyle: 'circle', // 'circle' | 'square'
    swatchSize: 'medium', // 'small' | 'medium' | 'large'
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!value) return null;
    
    const stringValue = String(value).trim();
    if (!stringValue) return null;

    // Validate hex color format
    const hexPattern = /^#?([0-9A-Fa-f]{6})$/;
    const match = stringValue.match(hexPattern);
    
    if (!match) {
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    // Normalize to #RRGGBB format
    return `#${match[1].toUpperCase()}`;
  }

  parseValue(value: any): string | null {
    if (!value) return null;
    
    const stringValue = String(value).trim();
    if (!stringValue) return null;

    // Validate hex color format
    const hexPattern = /^#?([0-9A-Fa-f]{6})$/;
    const match = stringValue.match(hexPattern);
    
    if (!match) return null;

    // Normalize to #RRGGBB format
    return `#${match[1].toUpperCase()}`;
  }

  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string {
    if (!value) return '';
    
    const parsed = this.parseValue(value);
    return parsed || '';
  }
}