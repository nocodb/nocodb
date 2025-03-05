import { SilentTypeConversionError } from '~/lib/error';
import { parseDecimalValue, precisionFormats, serializeDecimalValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DecimalHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[1],
    isLocaleString: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeDecimalValue(value);

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return value;
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    return parseDecimalValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${parseDecimalValue(value, params.col) ?? ''}`;
  }
}
