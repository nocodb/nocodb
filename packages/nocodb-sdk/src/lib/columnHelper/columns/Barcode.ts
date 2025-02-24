import AbstractColumnHelper from '../column.interface';
import { supportedBarcodeFormats } from '../utils';

export class BarcodeHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    barcodeFormat: supportedBarcodeFormats[0].value,
  };

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
