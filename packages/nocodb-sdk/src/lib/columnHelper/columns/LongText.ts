import { AIRecordType, ColumnType } from '~/lib/Api';
import { parseProp } from '~/lib/helperFunctions';
import { LongTextAiMetaProp } from '~/lib/globals';
import { ncIsObject } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeStringValue } from '../utils';
import { populateFillHandleStrictCopy } from '../utils/fill-handler';

export class LongTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  public serializeValue(value: any) {
    // This is to remove the quotes added from LongText
    return serializeStringValue(value);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    const columnMeta = parseProp(params.col.meta);

    if (columnMeta[LongTextAiMetaProp]) {
      if (ncIsObject(value)) {
        return (value as AIRecordType)?.value ?? null;
      }
    }

    if (!value) return null;

    return `"${value.replace(/"/g, '\\"')}"`;
  }

  parsePlainCellValue(value: any): string {
    // Remove trim() to preserve leading and trailing spaces
    return value?.toString() ?? '';
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
