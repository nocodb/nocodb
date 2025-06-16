import { NumberGeneralHandler } from './number.general.handler';
import { DecimalSqliteHandler } from '~/db/field-handler/handlers/decimal/decimal.sqlite.handler';

export class NumberSqliteHandler extends DecimalSqliteHandler {
  numberGeneralHandler = new NumberGeneralHandler();

  parseUserInput = this.numberGeneralHandler.parseUserInput;
}
