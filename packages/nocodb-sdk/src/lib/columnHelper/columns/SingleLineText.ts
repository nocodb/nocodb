import AbstractColumnHelper from '../column.interface';

export class SingleLineTextHelper extends AbstractColumnHelper {
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
