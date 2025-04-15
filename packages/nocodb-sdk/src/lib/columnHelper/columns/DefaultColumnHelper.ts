import AbstractColumnHelper from '../column.interface';

export class DefaultColumnHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): string | null {
    return value ?? null;
  }

  parseValue(value: any): string | null {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    } else {
      return value?.toString();
    }
  }

  parsePlainCellValue(value: any): string {
    return this.parsePlainCellValue(value) ?? '';
  }
}
