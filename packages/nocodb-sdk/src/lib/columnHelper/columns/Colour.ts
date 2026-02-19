import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { normalizeHexColour } from '../utils/colour';

export class ColourHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    defaultColor: '#FFFFFF',
    displayFormat: 'swatch_hex', // 'swatch_hex' | 'swatch_only' | 'hex_only'
    swatchStyle: 'circle', // 'circle' | 'square'
    swatchSize: 'medium', // 'small' | 'medium' | 'large'
  };

  /**
   * Serialise a user-supplied value for storage.
   *
   * During bulk paste or search-query serialisation, invalid values are
   * silently dropped (returns `null`).  In all other contexts an invalid
   * value throws a {@link SilentTypeConversionError} so the caller can
   * surface an appropriate message.
   */
  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!value) return null;

    const normalized = normalizeHexColour(value);

    if (!normalized) {
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return normalized;
  }

  /** Parse a stored value for display. Returns `null` for invalid values. */
  parseValue(value: any): string | null {
    return normalizeHexColour(value);
  }

  /** Return a plain-text representation suitable for export / clipboard. */
  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string {
    return normalizeHexColour(value) || '';
  }
}
