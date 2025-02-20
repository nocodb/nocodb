import AbstractColumnHelper from '../column.interface';

export class SingleLineTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    return value?.toString()?.trim() ?? null;
  }

  parseValue(value: any): string | null {
    return value?.toString()?.trim() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return value?.toString()?.trim() ?? '';
  }
}
