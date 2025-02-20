import AbstractColumnHelper from '../column.interface';

export class SingleLineTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    // This is to remove the quotes
    value = value?.toString() ?? null;
    if (value && value.match(/^".*"$/)) {
      return value.slice(1, -1);
    }
    return value ?? null;
  }

  parseValue(value: any): string | null {
    return value?.toString()?.trim() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return value?.toString()?.trim() ?? '';
  }
}
