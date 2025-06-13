import { RatingGeneralHandler } from './rating.general.handler';
import { DecimalPgHandler } from '~/db/field-handler/handlers/decimal/decimal.pg.handler';

export class RatingPgHandler extends DecimalPgHandler {
  ratingGeneralHandler = new RatingGeneralHandler();

  parseUserInput = this.ratingGeneralHandler.parseUserInput;

  filterLt = this.ratingGeneralHandler.filterLt;
  filterLte = this.ratingGeneralHandler.filterLte;
  filterGte = this.ratingGeneralHandler.filterGte;
}
