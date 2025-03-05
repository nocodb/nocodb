import { dateFormats, timeFormats } from '~/lib/dateTimeHelper';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseDateTimeValue, serializeDateOrDateTimeValue } from '../utils';

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
    return serializeDateOrDateTimeValue(value, params.col);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { isSystemCol?: boolean }
  ): string | null {
    return parseDateTimeValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { isSystemCol?: boolean }
  ): string | null {
    return parseDateTimeValue(value, params) ?? '';
  }
}
