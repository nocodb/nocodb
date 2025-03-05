import { ncIsArray } from '~/lib/is';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';
import { serializeSelectValue } from '../utils';

export class SingleSelectHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return serializeSelectValue(value, params.col);
  }

  parseValue(value: any): string | null {
    if (!value) return null;

    if (ncIsArray(value) && value.length) {
      return value[0]?.toString().trim();
    }

    return value?.toString().trim() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
