import { ColumnType } from '~/lib/Api';
import { parseCurrencyValue, serializeCurrencyValue } from '..';
import AbstractColumnHelper from '../column.interface';

export class CurrencyHelper extends AbstractColumnHelper {
  columnDefaultMeta = {
    currency_locale: 'en-US',
    currency_code: 'USD',
  };

  serializeValue(value: any): number | null {
    return serializeCurrencyValue(value);
  }

  parseValue(value: any, col: ColumnType): string | number | null {
    return parseCurrencyValue(value, col);
  }

  parsePlainCellValue(value: any, col: ColumnType): string {
    return `${parseCurrencyValue(value, col) ?? ''}`;
  }
}
