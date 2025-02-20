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
    return value?.toString().trim() ?? null;
  }

  parsePlainCellValue(value: any): string {
    return this.parseValue(value) ?? '';
  }
}
