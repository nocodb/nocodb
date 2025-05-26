import type { Knex } from 'knex';
import type CustomKnex from '~/db/CustomKnex';
import { NC_RECURSIVE_MAX_DEPTH } from '~/constants';

export * from 'src/helpers/dbHelpers';

export function generateRecursiveCTE({
  knex,
  idColumnName,
  linkIdColumnName,
  selectingColumnName,
  cteTableName,
  sourceTable,
  tableAlias,
  qb,
}: {
  knex: CustomKnex;
  idColumnName: string;
  linkIdColumnName: string;
  selectingColumnName: string;
  cteTableName: string;
  // sourceTable can be a subquery, another CTE, or physical table
  sourceTable: string | Knex.QueryInterface | Knex.Raw;
  tableAlias?: string;
  qb: Knex.QueryBuilder;
}) {
  const innerTableAlias = tableAlias ?? '__nc_t1';

  qb.withRecursive(
    cteTableName,
    knex.raw(
      `select 
        0 as lvl,
        :innerTableAlias:.:innerIdColumn: as id,
        :innerTableAlias:.:innerIdColumn: as root_id,
        :innerTableAlias:.:innerLinkIdColumn: as link_id,
        :innerTableAlias:.:innerColumnName: as :innerColumnName:
      from 
        :sourceTable: as :innerTableAlias:
      union ALL
      select 
        :cteTableName:.lvl + 1,
        :innerTableAlias:.:innerIdColumn: as id,
        :cteTableName:.root_id as root_id,
        :innerTableAlias:.:innerLinkIdColumn: as link_id,
        :innerTableAlias:.:innerColumnName: as :innerColumnName:
      from 
        :sourceTable: as :innerTableAlias:
        inner join :cteTableName: on
          :innerTableAlias:.:innerLinkIdColumn: = :cteTableName:.id
          and :cteTableName:.lvl < ${NC_RECURSIVE_MAX_DEPTH}`,
      {
        innerTableAlias,
        sourceTable,
        cteTableName,
        innerIdColumn: idColumnName,
        innerLinkIdColumn: linkIdColumnName,
        innerColumnName: selectingColumnName,
      },
    ),
  );

  return true;
}
