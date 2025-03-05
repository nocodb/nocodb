import { ColumnType } from '~/lib/Api';
import { SingleLineTextHelper } from './SingleLineText';
import { parseProp } from '~/lib/helperFunctions';
import { LongTextAiMetaProp } from '~/lib/globals';
import { ncIsObject } from '~/lib/is';

export class LongTextHelper extends SingleLineTextHelper {
  columnDefaultMeta = {};
  parseValue(value: any, col: ColumnType): string | null {
    const columnMeta = parseProp(col.meta);

    if (columnMeta?.[LongTextAiMetaProp]) {
      if (ncIsObject(value)) {
        return value?.value ?? null;
      }
    } else {
      return (value ?? '').replace(/"/g, '\\"');
    }
  }
}
