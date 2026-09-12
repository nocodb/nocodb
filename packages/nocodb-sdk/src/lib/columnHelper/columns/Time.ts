import dayjs from 'dayjs';
import { constructTimeFormat } from '~/lib/dateTimeHelper';
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
    if (params.serializeSearchQuery) {
      return this.parseValue(value, params);
    }

    value = serializeTimeValue(value, params);

    if (value === null) {
      if (params.isMultipleCellPaste || params.serializeSearchQuery) {
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

  override equalityComparison(
    a: any,
    b: any,
    param: SerializerOrParserFnProps['params']
  ): boolean {
    // A Time cell is a wall-clock time-of-day with no date/zone meaning. A
    // serialized value can carry a trailing zone offset (e.g.
    // "1999-01-01 02:15:00+07:00"); dayjs() would shift it into the host
    // timezone and make equality depend on where the code runs. Strip the
    // offset first so we compare the time-of-day as written.
    const stripZone = (v: any) =>
      typeof v === 'string'
        ? v.trim().replace(/\s*(?:Z|[+-]\d{2}:?\d{2})$/i, '')
        : v;

    const aDayjs =
      typeof a === 'string'
        ? dayjs(serializeTimeValue(stripZone(a), param))
        : dayjs(a);
    const bDayjs =
      typeof b === 'string'
        ? dayjs(serializeTimeValue(stripZone(b), param))
        : dayjs(b);

    return (
      aDayjs.format(constructTimeFormat(param.col)) ===
      bDayjs.format(constructTimeFormat(param.col))
    );
  }
}
