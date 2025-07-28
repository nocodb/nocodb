import { DecimalMysqlHandler } from '../decimal/decimal.mysql.handler';
import { CurrencyGeneralHandler } from './currency.general.handler';

export class CurrencyMysqlHandler extends DecimalMysqlHandler {
  currencyGeneralHandler = new CurrencyGeneralHandler();
  override parseUserInput = this.currencyGeneralHandler.parseUserInput;
}
