import { ColumnType } from '~/lib/Api';
import { AbstractColumn } from '..';
import { parseDurationValue } from '../utils/parser';
import { serializeDurationValue } from '../utils/serializer';

export class DurationColumn extends AbstractColumn {
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
