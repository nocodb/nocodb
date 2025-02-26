import { ComputedTypePasteError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { supportedBarcodeFormats } from '../utils';

export class BarcodeHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    barcodeFormat: supportedBarcodeFormats[0].value,
  };

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): undefined {
    if (params.isMultipleCellPaste) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(value: any): string | null {
    return value?.toString() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
