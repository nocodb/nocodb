import { DecimalSqliteHandler } from '../decimal/decimal.sqlite.handler';
import { CurrencyGeneralHandler } from './currency.general.handler';

export class CurrencySqliteHandler extends DecimalSqliteHandler {
  currencyGeneralHandler = new CurrencyGeneralHandler();
  override parseUserInput = this.currencyGeneralHandler.parseUserInput;
}
