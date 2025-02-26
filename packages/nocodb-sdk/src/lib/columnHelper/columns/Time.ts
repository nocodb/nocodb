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
    return serializeTimeValue(value, params);
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
