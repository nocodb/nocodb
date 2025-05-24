import { GenericPgFieldHandler } from '../generic.pg';
import { UserGeneralHandler } from './user.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { replaceDelimitedWithKeyValuePg } from '~/db/aggregations/pg';

export class UserLikeNLikePgHandler extends UserGeneralHandler {
  override singleLineTextHandler: GenericFieldHandler =
    new GenericPgFieldHandler();

  override replaceDelimitedWithKeyValue(param: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }) {
    const { knex, needleColumn, stack } = param;
    return `(${replaceDelimitedWithKeyValuePg({
      knex,
      needleColumn,
      stack,
    })})`;
  }
}

export class UserPgHandler extends GenericPgFieldHandler {
  userHandler = new UserLikeNLikePgHandler();

  override filter = this.userHandler.filter;
  override filterLike = this.userHandler.filterLikeNlike;
  override filterNlike = this.userHandler.filterLikeNlike;
  override parseUserInput = this.userHandler.parseUserInput;
}
