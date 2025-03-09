import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeStringValue } from '../utils';

export class SingleLineTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return serializeStringValue(value);
  }

  parseValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return value?.toString()?.trim() ?? null;
  }

  parsePlainCellValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string {
    return value?.toString()?.trim() ?? '';
  }
}
