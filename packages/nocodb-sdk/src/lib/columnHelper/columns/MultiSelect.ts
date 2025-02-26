import { ncIsArray } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeSelectValue } from '../utils';

export class MultiSelectHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return serializeSelectValue(value, params.col);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    if (!value) return null;

    if (ncIsArray(value)) {
      return value.join(', ');
    } else if (params.isMysql?.(params.col.source_id)) {
      return value.toString().split(',').join(', ');
    } else {
      return value.toString();
    }
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return this.parseValue(value, params) ?? '';
  }
}
