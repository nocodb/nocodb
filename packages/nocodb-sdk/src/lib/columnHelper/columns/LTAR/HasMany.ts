import { SilentTypeConversionError } from '~/lib/error';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../../column.interface';
import { LookupHelper } from '../Lookup';

export class HasManyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {};

  serializeValue(_value: any, _params: SerializerOrParserFnProps['params']) {
    throw new SilentTypeConversionError();
  }

  parseValue(value: any, params: SerializerOrParserFnProps['params']) {
    // Clipboard text is the display values the cell renders — the raw value
    // is an array of related records and would stringify as noise.
    return this.parsePlainCellValue(value, params);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return new LookupHelper().parsePlainCellValue(value, params) ?? '';
  }
}
