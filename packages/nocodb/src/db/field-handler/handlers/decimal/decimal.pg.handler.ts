import { DecimalGeneralHandler } from './decimal.general.handler';
import { GenericPgFieldHandler } from '~/db/field-handler/handlers/generic.pg';

export class DecimalPgHandler extends GenericPgFieldHandler {
  decimalGeneralHandler = new DecimalGeneralHandler();

  override select = this.decimalGeneralHandler.select;
  override filter = this.decimalGeneralHandler.filter;
  override verifyFilter = this.decimalGeneralHandler.verifyFilter;
  override parseUserInput = this.decimalGeneralHandler.parseUserInput;
  override parseDbValue = this.decimalGeneralHandler.parseDbValue;

  override filterBlank = this.decimalGeneralHandler.filterBlank;
  override filterNotblank = this.decimalGeneralHandler.filterNotblank;
}
