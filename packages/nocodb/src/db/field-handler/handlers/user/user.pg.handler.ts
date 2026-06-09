import { ClientType } from 'nocodb-sdk';
import { GenericPgFieldHandler } from '../generic.pg';
import { UserGeneralHandler } from './user.general.handler';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { GenericFieldHandler } from '~/db/field-handler/handlers/generic';
import { DBQueryClient } from '~/dbQueryClient';

export class UserLikeNLikePgHandler extends UserGeneralHandler {
  override singleLineTextHandler: GenericFieldHandler =
    new GenericPgFieldHandler();

  override replaceDelimitedWithKeyValue(param: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }) {
    return `(${DBQueryClient.get(ClientType.PG).replaceDelimitedWithKeyValue(
      param,
    )})`;
  }
}

export class UserPgHandler extends GenericPgFieldHandler {
  userHandler = new UserLikeNLikePgHandler();

  override filter = (...args: Parameters<UserGeneralHandler['filter']>) =>
    this.userHandler.filter(...args);
  override filterLike = (
    ...args: Parameters<UserGeneralHandler['filterLikeNlike']>
  ) => this.userHandler.filterLikeNlike(...args);
  override filterNlike = (
    ...args: Parameters<UserGeneralHandler['filterLikeNlike']>
  ) => this.userHandler.filterLikeNlike(...args);
  override applySort = (...args: Parameters<UserGeneralHandler['applySort']>) =>
    this.userHandler.applySort(...args);
  override parseUserInput = this.userHandler.parseUserInput;
  singleLineTextHandler = this.userHandler.singleLineTextHandler;
  replaceDelimitedWithKeyValue = this.userHandler.replaceDelimitedWithKeyValue;
}
