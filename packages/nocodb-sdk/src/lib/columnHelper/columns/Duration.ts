import { SilentTypeConversionError } from '~/lib/error';
import { parseDurationValue, serializeDurationValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DurationHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    duration: 0,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    value = serializeDurationValue(value, params.col);

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
  ): number | null {
    return parseDurationValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return parseDurationValue(value, params.col) ?? '';
  }
}
