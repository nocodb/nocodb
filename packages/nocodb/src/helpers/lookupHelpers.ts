import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';

export async function recursiveCTEFromLookupColumnHM(_param: {
  baseModelSqlV2: IBaseModelSqlV2;
  lookupColumn: Column;
  tableAlias: string;
}) {
  return (_qb: Knex.QueryBuilder) => {};
}
