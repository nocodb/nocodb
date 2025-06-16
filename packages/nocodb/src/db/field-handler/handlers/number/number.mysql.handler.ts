import { NumberGeneralHandler } from './number.general.handler';
import { DecimalMysqlHandler } from '~/db/field-handler/handlers/decimal/decimal.mysql.handler';

export class NumberMysqlHandler extends DecimalMysqlHandler {
  numberGeneralHandler = new NumberGeneralHandler();

  parseUserInput = this.numberGeneralHandler.parseUserInput;
}
