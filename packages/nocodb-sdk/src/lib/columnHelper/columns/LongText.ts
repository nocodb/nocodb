import { AIRecordType, ColumnType } from '~/lib/Api';
import { parseProp } from '~/lib/helperFunctions';
import { LongTextAiMetaProp } from '~/lib/globals';
import { ncIsObject } from '~/lib/is';
import AbstractColumnHelper from '../column.interface';

export class LongTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  public serializeValue(value: any) {
    return value?.toString()?.trim() ?? null;
  }

  parseValue(value: any, col: ColumnType): string | null {
    const columnMeta = parseProp(col.meta);

    if (columnMeta?.[LongTextAiMetaProp]) {
      if (ncIsObject(value)) {
        return (value as AIRecordType)?.value ?? null;
      }
    } else {
      return `"${(value ?? '').replace(/"/g, '\\"')}"`;
    }

    return null;
  }

  parsePlainCellValue(value: any): string {
    return value?.toString()?.trim() ?? '';
  }
}
