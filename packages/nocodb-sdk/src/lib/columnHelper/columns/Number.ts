import { parseIntValue, serializeIntValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class NumberHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): number | null {
    return serializeIntValue(value);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    return parseIntValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${parseIntValue(value, params.col) ?? ''}`;
  }
}
