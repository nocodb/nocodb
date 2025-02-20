import { AbstractColumn } from '..';
import { parseIntValue } from '../utils/parser';
import { serializeIntValue } from '../utils/serializer';

export class NumberColumn extends AbstractColumn {
  columnDefaultMeta = {
    isLocaleString: false,
  };

  serializeValue(value: any): number | null {
    return serializeIntValue(value);
  }

  parseValue(value: any): number | null {
    return parseIntValue(value);
  }

  parsePlainCellValue(value: any): string {
    return `${parseIntValue(value) ?? ''}`;
  }
}
