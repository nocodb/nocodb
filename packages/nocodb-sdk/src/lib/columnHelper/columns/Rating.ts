import { SilentTypeConversionError } from '~/lib/error';
import { parseProp } from '~/lib/helperFunctions';
import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ncIsNaN } from '~/lib/is';

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
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    if (res) {
      if (params.serializeSearchQuery) {
        return res;
      }

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
    if (params.isAggregation && ncIsNaN(value)) {
      value = 0;
    }

    return `${parseIntValue(value, params.col) ?? ''}`;
  }

  // simply copy highlighted rows
  // since rating doesn't need increment
  // override populateFillHandle
}
