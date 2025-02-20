import AbstractColumnHelper from '../column.interface';
import { parseUserValue } from '../utils';

export class UserHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  //   Todo: pending
  serializeValue(value: any): string | null {
    return value;
  }

  parseValue(value: any): string | null {
    return parseUserValue(value);
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
