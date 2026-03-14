import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { ComputedTypePasteError } from '~/lib/error';

export class DocHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    _value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (params.serializeSearchQuery) return null;

    if (params.isMultipleCellPaste) {
      return undefined;
    } else {
      throw new ComputedTypePasteError();
    }
  }

  parseValue(
    _value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return null;
  }

  parsePlainCellValue(
    _value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return '';
  }
}
