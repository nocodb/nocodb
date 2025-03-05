import { parseProp } from '~/lib/helperFunctions';
import { parseDefault } from '..';
import AbstractColumnHelper from '../column.interface';
import { ncIsArray, ncIsEmptyObject, ncIsObject } from '~/lib/is';

export class AttachmentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  // Incomplete
  serializeValue(value: any) {
    if (!value) return null;

    let parsedVal = [];

    try {
      parsedVal = parseProp(value);

      if (ncIsArray(parsedVal)) {
        parsedVal = parsedVal;
      } else if (ncIsObject(parsedVal) && !ncIsEmptyObject(parsedVal)) {
        parsedVal = [parsedVal];
      } else {
        parsedVal = [];
      }
    } catch (e) {
      return null;
    }

    if (parsedVal.some((v: any) => !v || (v && !(v.url || v.data || v.path)))) {
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
