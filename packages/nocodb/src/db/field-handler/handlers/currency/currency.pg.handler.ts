import { DecimalPgHandler } from '../decimal/decimal.pg.handler';
import { CurrencyGeneralHandler } from './currency.general.handler';

export class CurrencyPgHandler extends DecimalPgHandler {
  currencyGeneralHandler = new CurrencyGeneralHandler();
  override parseUserInput = this.currencyGeneralHandler.parseUserInput;
}
