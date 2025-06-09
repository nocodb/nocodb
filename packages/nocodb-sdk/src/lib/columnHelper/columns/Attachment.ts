import { parseProp } from '~/lib/helperFunctions';
import { parseDefault } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ncIsArray, ncIsEmptyObject, ncIsObject } from '~/lib/is';
import { SilentTypeConversionError } from '~/lib/error';
import { ColumnType } from '~/lib/Api';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class AttachmentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any, params: SerializerOrParserFnProps['params']) {
    if (!value) return null;

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

  // simply copy highlighted rows
  override populateFillHandle(params: {
    column: ColumnType;
    highlightedData: any[];
    numberOfRows: number;
  }): any[] {
    return populateFillHandleStrictCopy(params);
  }
}
