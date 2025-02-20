import { ColumnType } from '~/lib/Api';
import { AbstractColumnHelper, parseIntValue, serializeIntValue } from '..';

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
