import { dateFormats } from '~/lib/dateTimeHelper';
import { parseDateValue, serializeDateOrDateTimeValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { SilentTypeConversionError } from '~/lib/error';

export class DateHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    date_format: dateFormats[0],
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
