import { parseCurrencyValue, serializeCurrencyValue } from '..';
import AbstractColumnHelper, {
  SerializerOrParserFnProps,
} from '../column.interface';

export class CurrencyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
  };

  serializeValue(value: any): number | null {
    return serializeCurrencyValue(value);
  }

  parseValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string | number | null {
    return parseCurrencyValue(value, params.col);
  }

  parsePlainCellValue(
    value: any,
    params: SerializerOrParserFnProps['params']
  ): string {
    return `${this.parseValue(value, params) ?? ''}`;
  }
}
