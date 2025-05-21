import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseTimeValue, serializeTimeValue } from '../utils';

export class TimeHelper extends AbstractColumnHelper {
  public columnDefaultMeta = {
    is12hrFormat: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    value = serializeTimeValue(value, params);

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
  ): string | null {
    return parseTimeValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return parseTimeValue(value, params) ?? '';
  }
}
