import { NumberGeneralHandler } from './number.general.handler';
import { DecimalPgHandler } from '~/db/field-handler/handlers/decimal/decimal.pg.handler';

export class NumberPgHandler extends DecimalPgHandler {
  numberGeneralHandler = new NumberGeneralHandler();

  parseUserInput = this.numberGeneralHandler.parseUserInput;
}
