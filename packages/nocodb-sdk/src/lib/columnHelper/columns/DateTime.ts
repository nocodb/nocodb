import { dateFormats, timeFormats } from '~/lib/dateTimeHelper';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseDateTimeValue, serializeDateOrDateTimeValue } from '../utils';
import { SilentTypeConversionError } from '~/lib/error';

export class DateTimeHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    date_format: dateFormats[0],
    time_format: timeFormats[0],
    is12hrFormat: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    value = serializeDateOrDateTimeValue(value, params.col);

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
    return parseDateTimeValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return parseDateTimeValue(value, params) ?? '';
  }
}
