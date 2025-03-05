import { SerializerOrParserFnProps } from '../column.interface';
import { DateHelper } from './Date';

export class CreatedTimeHelper extends DateHelper {
  serializeValue(
    _value: any,
    _params: SerializerOrParserFnProps['params']
  ): string | null {
    return null;
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return super.parseValue(value, { ...params, isSystemCol: true });
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | null {
    return this.parseValue(value, params) ?? '';
  }
}
