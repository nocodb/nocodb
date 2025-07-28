import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '~/lib/columnHelper/column.interface';
import { SilentTypeConversionError } from '~/lib/error';
import { parseJsonValue, serializeJsonValue } from '../utils';
import { ncIsString } from '~/lib/is';

export class JsonHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.serializeSearchQuery) {
      return ncIsString(value) ? value : null;
    }

    value = serializeJsonValue(value);

    if (value === null) {
      throw new SilentTypeConversionError();
    }

    return value;
  }

  parseValue(value: any): string | null {
    return parseJsonValue(value);
  }

  parsePlainCellValue(value: any): string {
    return parseJsonValue(value);
  }

  override equalityComparison(
    a: any,
    b: any,
    _param: SerializerOrParserFnProps['params']
  ): boolean {
    const aStr =
      typeof a === 'object'
        ? JSON.stringify(a)
        : typeof a === 'string'
        ? a
        : a.toString();
    const bStr =
      typeof b === 'object'
        ? JSON.stringify(b)
        : typeof b === 'string'
        ? b
        : b.toString();
    return aStr === bStr;
  }
}
