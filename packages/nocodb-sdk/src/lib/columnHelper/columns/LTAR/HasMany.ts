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

  parseValue(value: any, _params: SerializerOrParserFnProps['params']) {
    return value ?? '';
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return new LookupHelper().parsePlainCellValue(value, params) ?? '';
  }
}
