import { RatingGeneralHandler } from './rating.general.handler';
import { DecimalSqliteHandler } from '~/db/field-handler/handlers/decimal/decimal.sqlite.handler';

export class RatingSqliteHandler extends DecimalSqliteHandler {
  ratingGeneralHandler = new RatingGeneralHandler();

  parseUserInput = this.ratingGeneralHandler.parseUserInput;

  filterLt = this.ratingGeneralHandler.filterLt;
  filterLte = this.ratingGeneralHandler.filterLte;
  filterGte = this.ratingGeneralHandler.filterGte;
}
