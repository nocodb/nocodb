import AbstractColumnHelper from '../column.interface';
import { parseYearValue, serializeYearValue } from '../utils';

export class YearHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): number | null {
    return serializeYearValue(value);
  }

  parseValue(value: any): string | number | null {
    return parseYearValue(value);
  }

  parsePlainCellValue(value: any): string {
    return `${parseYearValue(value) ?? ''}`;
  }
}
