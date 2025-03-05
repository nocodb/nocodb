import AbstractColumnHelper from '../column.interface';
import { parseJsonValue, serializeJsonValue } from '../utils';

export class JsonHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    return serializeJsonValue(value);
  }

  parseValue(value: any): string | null {
    return parseJsonValue(value);
  }

  parsePlainCellValue(value: any): string {
    return parseJsonValue(value);
  }
}
