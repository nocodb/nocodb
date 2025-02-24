import { ColumnType } from '~/lib/Api';
import AbstractColumnHelper from '../column.interface';

export class RollupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value?: any): null {
    return null;
  }

  // pending
  parseValue(value: any, col: ColumnType): string | null {
    return value?.toString();
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return this.parseValue(value, col) ?? '';
  }
}
