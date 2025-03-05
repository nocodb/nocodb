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

  parseValue(value: any): string | null {
    if (!value) return null;

    if (ncIsArray(value)) {
      return value.join(', ');
    }

    return value.toString().split(',').join(', ');
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
