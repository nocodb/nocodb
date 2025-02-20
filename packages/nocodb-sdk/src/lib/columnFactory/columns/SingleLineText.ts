import { AbstractColumn } from '..';

export class SingleLineTextColumn extends AbstractColumn {
  serializeValue(value: any): string | null {
    return value?.toString() ?? null;
  }

  parseValue(value: any): string | null {
    return value?.toString() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return value?.toString() ?? '';
  }
}
