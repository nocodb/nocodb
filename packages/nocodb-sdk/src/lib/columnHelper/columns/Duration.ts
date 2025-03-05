import { parseDurationValue, serializeDurationValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class DurationHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    duration: 0,
  };

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    return serializeDurationValue(value, params.col);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): number | null {
    return parseDurationValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return parseDurationValue(value, params.col) ?? '';
  }
}
