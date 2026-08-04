import type { Knex } from 'knex';
import type { ClientType, NcContext } from 'nocodb-sdk';
import type { ICteBlock, ICTEGenerator } from './types';
import { buildBaseUserCteSelect } from '~/db/cte-generator/base-user.cte.utils';
import { BaseUser } from '~/models';

export class BaseUserGeneralCte {
  constructor(protected readonly clientType: ClientType) {}
  async inquiry(
    {
      context,
      include_ws_deleted = true,
    }: {
      context: NcContext;
      include_ws_deleted?: boolean;
    },
    cteGen: ICTEGenerator,
  ) {
    const alias = `nc_base_user_${context.base_id}`;
    const existingAlias = cteGen.getExistingAlias(alias);
    if (existingAlias) {
      return existingAlias;
    }
    const baseUsers = await BaseUser.getUsersList(context, {
      base_id: context.base_id,
      include_ws_deleted,
      mode: 'full',
    });
    return {
      alias: alias,
      applyCte: (qb: Knex.QueryInterface, { knex }) => {
        qb.with(alias, buildBaseUserCteSelect(knex, baseUsers));
      },
    } as ICteBlock;
  }
}
