import { parsePercentValue, serializePercentValue } from '..';
import AbstractColumnHelper from '../column.interface';

export class PercentHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    is_progress: false,
  };

  serializeValue(value: any): number | null {
    return serializePercentValue(value);
  }

  parseValue(value: any): string | number | null {
    return parsePercentValue(value);
  }

  parsePlainCellValue(value: any): string {
    return `${parsePercentValue(value) ?? ''}`;
  }
}
