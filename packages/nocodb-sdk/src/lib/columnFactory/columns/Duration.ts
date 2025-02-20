import { ColumnType } from '~/lib/Api';
import { AbstractColumnHelper } from '..';
import { parseDurationValue } from '../utils/parser';
import { serializeDurationValue } from '../utils/serializer';

export class DurationHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    duration: 0,
  };

  serializeValue(value: any, col: ColumnType): number | null {
    return serializeDurationValue(value, col);
  }

  parseValue(value: any, col: ColumnType): number | null {
    return parseDurationValue(value, col);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return parseDurationValue(value, col) ?? '';
  }
}
