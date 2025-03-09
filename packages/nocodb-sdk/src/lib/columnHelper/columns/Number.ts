import { SilentTypeConversionError } from '~/lib/error';
import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { toSafeInteger } from '~/lib/helperFunctions';

export class NumberHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    isLocaleString: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeIntValue(value);

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return toSafeInteger(value);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    return parseIntValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${parseIntValue(value, params.col) ?? ''}`;
  }
}
