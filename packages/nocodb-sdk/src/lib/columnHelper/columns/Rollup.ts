import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class RollupHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value?: any): null {
    return null;
  }

  // pending
  parseValue(
    value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return value?.toString();
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
