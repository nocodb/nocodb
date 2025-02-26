import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { parseUserValue } from '../utils';
import { SilentTypeConversionError } from '~/lib/error';

export class UserHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    try {
      value = typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
      value = value;
    }

    if (value === null) {
      if (params.isMultipleCellPaste) {
        return null;
      } else {
        throw new SilentTypeConversionError();
      }
    }

    return value;
  }

  parseValue(value: any): string | null {
    return parseUserValue(value);
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
