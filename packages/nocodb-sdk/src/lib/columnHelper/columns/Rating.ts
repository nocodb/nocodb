import { SilentTypeConversionError } from '~/lib/error';
import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseProp } from '~/lib/helperFunctions';

export class RatingHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    iconIdx: 0,
    icon: {
      full: 'mdi-star',
      empty: 'mdi-star-outline',
    },
    color: '#fcb401',
    max: 5,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    const res = serializeIntValue(value ?? 0);

    if (res === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    if (res) {
      return Math.min(
        res,
        parseProp(params.col.meta)?.max || this.columnDefaultMeta.max
      );
    }

    return res;
  }

  parseValue(value: any): string | number | null {
    return parseIntValue(value);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${parseIntValue(value, params.col) ?? ''}`;
  }
}
