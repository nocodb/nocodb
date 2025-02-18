import { ColumnType } from '~/lib/Api';
import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper from '../column.interface';

export class NumberHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

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
