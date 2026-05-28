import { ClientType } from 'nocodb-sdk';
import { GenericSqliteFieldHandler } from '../generic.sqlite';
import { UserGeneralHandler } from './user.general.handler';
import type CustomKnex from 'src/db/CustomKnex';
import type { Knex } from 'src/db/CustomKnex';
import type { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { DBQueryClient } from '~/dbQueryClient';

export class UserLikeNLikeSqliteHandler extends UserGeneralHandler {
  override singleLineTextHandler: GenericFieldHandler =
    new GenericSqliteFieldHandler();

  override replaceDelimitedWithKeyValue(param: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }) {
    return `(${DBQueryClient.get(
      ClientType.SQLITE,
    ).replaceDelimitedWithKeyValue(param)})`;
  }
}

export class UserSqliteHandler extends GenericSqliteFieldHandler {
  userHandler = new UserLikeNLikeSqliteHandler();

  override filter = this.userHandler.filter;
  override filterLike = this.userHandler.filterLikeNlike;
  override filterNlike = this.userHandler.filterLikeNlike;
  override parseUserInput = this.userHandler.parseUserInput;
  singleLineTextHandler = this.userHandler.singleLineTextHandler;
  replaceDelimitedWithKeyValue = this.userHandler.replaceDelimitedWithKeyValue;
}
