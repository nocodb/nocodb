import AbstractColumnHelper from '../column.interface';

export class QrCodeHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value: any): null {
    return null;
  }

  parseValue(value: any): string | null {
    return value?.toString() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
