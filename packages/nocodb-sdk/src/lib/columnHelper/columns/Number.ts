import { ColumnType } from '~/lib/Api';
import { AbstractColumnHelper } from '..';
import { parseIntValue } from '../utils/parser';
import { serializeIntValue } from '../utils/serializer';

export class NumberHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    isLocaleString: false,
  };

  serializeValue(value: any): number | null {
    return serializeIntValue(value);
  }

  parseValue(value: any, col: ColumnType): string | number | null {
    return parseIntValue(value, col);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return `${parseIntValue(value, col) ?? ''}`;
  }
}
