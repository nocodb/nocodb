import { SilentTypeConversionError } from '~/lib/error';
import { parseProp } from '~/lib/helperFunctions';
import { ncIsArray, ncIsEmptyObject, ncIsObject } from '~/lib/is';
import { parseDefault } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class AttachmentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    if (!value || params.serializeSearchQuery) return null;

    let parsedVal = [];

    try {
      parsedVal = parseProp(value);

      if (ncIsObject(parsedVal) && !ncIsEmptyObject(parsedVal)) {
        parsedVal = [parsedVal];
      } else if (!ncIsArray(parsedVal)) {
        parsedVal = [];
      }
    } catch {
      if (params.isMultipleCellPaste) {
        return null;
      }

      throw new SilentTypeConversionError();
    }

    if (parsedVal.some((v: any) => !(v?.url || v?.data || v?.path))) {
      return null;
    }

    return parsedVal;
  }

  parseValue(value: any): boolean {
    return parseDefault(value);
  }

  parsePlainCellValue(value: any): string {
    return parseDefault(value) ?? '';
  }
}
