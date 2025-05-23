import { DecimalGeneralHandler } from './decimal.general.handler';
import { GenericMysqlFieldHandler } from '~/db/field-handler/handlers/generic.mysql';

export class DecimalMysqlHandler extends GenericMysqlFieldHandler {
  decimalGeneralHandler = new DecimalGeneralHandler();

  override select = this.decimalGeneralHandler.select;
  override filter = this.decimalGeneralHandler.filter;
  override verifyFilter = this.decimalGeneralHandler.verifyFilter;
  override parseUserInput = this.decimalGeneralHandler.parseUserInput;
  override parseDbValue = this.decimalGeneralHandler.parseDbValue;

  override filterBlank = this.decimalGeneralHandler.filterBlank;
  override filterNotblank = this.decimalGeneralHandler.filterNotblank;
}
