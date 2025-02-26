import { ColumnType } from '~/lib/Api';
import { parseDecimalValue, precisionFormats, serializeDecimalValue } from '..';
import AbstractColumnHelper from '../column.interface';

export class DecimalHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    precision: precisionFormats[1],
    isLocaleString: false,
  };

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
