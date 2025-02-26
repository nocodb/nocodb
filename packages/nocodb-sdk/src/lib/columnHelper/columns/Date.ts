import { dateFormats } from '~/lib/dateTimeHelper';
import { parseDateValue, serializeDateOrDateTimeValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DateHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    date_format: dateFormats[0],
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
    return parseDateValue(value, params.col, params.isSystemCol);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params'] & { isSystemCol?: boolean }
  ): string | null {
    return parseDateValue(value, params.col, params.isSystemCol) ?? '';
  }
}
