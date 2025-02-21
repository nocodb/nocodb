import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class SingleLineTextHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    // This is to remove the quotes
    value = value?.toString() ?? null;
    if (value && value.match(/^".*"$/)) {
      return value.slice(1, -1);
    }
    return value ?? null;
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
