import { isLinksOrLTAR } from 'nocodb-sdk';
import conditionV2 from 'src/db/conditionV2';
import type { Knex } from 'knex';
import type { Column, Model } from '~/models';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { Filter } from '~/models';

export * from 'src/db/conditionV2';
export { conditionV2 as default };

// Extract filters mapped to the Rollup or Lookup cell
// and apply it to the query builder
export async function extractLinkRelFiltersAndApply(param: {
  qb: Knex.QueryBuilder & Knex.QueryInterface;
  column: Column<any>;
  alias?: string;
  table: Model;
  context: NcContext;
  baseModel: IBaseModelSqlV2;
}) {
  // skip it for Links/LTAR column
  if (isLinksOrLTAR(param.column)) {
    return;
  }

  // skip if condition is in disabled state
  if (!param.column.meta?.enableConditions) {
    return;
  }

  // extract filters
  const filters = await Filter.rootFilterListByLink(
    {
      ...param.context,
      // extract base id from the column since inter base link might have different base id
      base_id: param.column.base_id ?? param.table.base_id,
    },
    {
      columnId: param.column.id,
    },
  );

  if (filters?.length) {
    await conditionV2(param.baseModel, filters, param.qb, param.alias);
  }
}
