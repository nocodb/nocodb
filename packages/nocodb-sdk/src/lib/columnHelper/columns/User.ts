import { SilentTypeConversionError } from '~/lib/error';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsArray, ncIsObject, ncIsString } from '~/lib/is';
import { NcRecord } from '~/lib/ncTypes';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseUserValue, serializeEmail, serializeStringValue } from '../utils';

export class UserHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    is_multi: false,
    notify: false,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null | NcRecord {
    if (params.serializeSearchQuery) {
      return serializeStringValue(value);
    }

    try {
      value = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {}

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    const is_multi = parseProp(params.col.meta).is_multi;

    if (ncIsArray(value) || ncIsObject(value)) {
      if (ncIsObject(value)) {
        value = [value];
      }

      value = (value as NcRecord[]).reduce((acc, user) => {
        if (user.email) {
          acc.push(user);
        }
        return acc;
      }, [] as NcRecord[]);

      if (!value.length) return null;

      if (!is_multi) {
        return value[0];
      }

      return value;
    }

    if (!ncIsString(value)) return null;

    if (is_multi) {
      return value
        .split(',')
        .map((val) => serializeEmail(val))
        .filter(Boolean)
        .join(', ');
    }

    return serializeEmail(value);
  }

  parseValue(value: any): string | null {
    return parseUserValue(value, true);
  }

  parsePlainCellValue(value: any): string {
    return parseUserValue(value) ?? '';
  }
}
