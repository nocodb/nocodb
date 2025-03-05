import { ColumnType } from '~/lib/Api';
import { parseDecimalValue, serializeDecimalValue } from '..';
import AbstractColumnHelper from '../column.interface';

export class DateHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): number | null {
    return serializeDecimalValue(value);
  }

  parseValue(value: any, col: ColumnType): string | number | null {
    return parseDecimalValue(value, col);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return `${parseDecimalValue(value, col) ?? ''}`;
  }
}
