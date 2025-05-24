import { replaceDelimitedWithKeyValueSqlite3 } from 'src/db/aggregations/sqlite3';
import { GenericSqliteFieldHandler } from '../generic.sqlite';
import { UserGeneralHandler } from './user.general.handler';
import type CustomKnex from 'src/db/CustomKnex';
import type { Knex } from 'src/db/CustomKnex';
import type { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class UserLikeNLikeSqliteHandler extends UserGeneralHandler {
  override singleLineTextHandler: GenericFieldHandler =
    new GenericSqliteFieldHandler();

  override replaceDelimitedWithKeyValue(param: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }) {
    const { knex, needleColumn, stack } = param;
    return `(${replaceDelimitedWithKeyValueSqlite3({
      knex,
      needleColumn,
      stack,
    })})`;
  }
}

export class UserSqliteHandler extends GenericSqliteFieldHandler {
  userHandler = new UserLikeNLikeSqliteHandler();

  override filterLike = this.userHandler.filterLikeNlike;
  override filterNlike = this.userHandler.filterLikeNlike;
  override parseUserInput = this.userHandler.parseUserInput;
}
