import { DecimalGeneralHandler } from './decimal.general.handler';
import { GenericSqliteFieldHandler } from '~/db/field-handler/handlers/generic.sqlite';

export class DecimalSqliteHandler extends GenericSqliteFieldHandler {
  decimalGeneralHandler = new DecimalGeneralHandler();

  override select = this.decimalGeneralHandler.select;
  override filter = this.decimalGeneralHandler.filter;
  override verifyFilter = this.decimalGeneralHandler.verifyFilter;
  override parseUserInput = this.decimalGeneralHandler.parseUserInput;
  override parseDbValue = this.decimalGeneralHandler.parseDbValue;

  override filterBlank = this.decimalGeneralHandler.filterBlank;
  override filterNotblank = this.decimalGeneralHandler.filterNotblank;
}
