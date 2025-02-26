import { parseDecimalValue, serializeDecimalValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DateHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(value: any): number | null {
    return serializeDecimalValue(value);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    return parseDecimalValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${parseDecimalValue(value, params.col) ?? ''}`;
  }
}
