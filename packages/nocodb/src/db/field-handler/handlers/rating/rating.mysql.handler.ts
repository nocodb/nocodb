import { RatingGeneralHandler } from './rating.general.handler';
import { DecimalMysqlHandler } from '~/db/field-handler/handlers/decimal/decimal.mysql.handler';

export class RatingMysqlHandler extends DecimalMysqlHandler {
  ratingGeneralHandler = new RatingGeneralHandler();

  parseUserInput = this.ratingGeneralHandler.parseUserInput;

  filterLt = this.ratingGeneralHandler.filterLt;
  filterLte = this.ratingGeneralHandler.filterLte;
  filterGte = this.ratingGeneralHandler.filterGte;
}
