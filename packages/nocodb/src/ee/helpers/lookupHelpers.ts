/* eslint-disable @typescript-eslint/no-unused-vars */
import { RelationTypes } from 'nocodb-sdk';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import { generateRecursiveCTE } from '~/helpers/dbHelpers';

export async function recursiveCTEFromLookupColumn({
  baseModelSqlV2,
  lookupColumn,
  tableAlias,
}: {
  baseModelSqlV2: IBaseModelSqlV2;
  lookupColumn: Column;
  tableAlias: string;
}) {
  // TODO: [recursive lookup]
  return (_qb: Knex.QueryBuilder) => {};

  // const lookupColOpt = await lookupColumn.getColOptions<LookupColumn>(
  //   baseModelSqlV2.context,
  // );
  // const relationCol = await lookupColOpt.getRelationColumn(
  //   baseModelSqlV2.context,
  // );
  // const relation = await relationCol.getColOptions<LinkToAnotherRecordColumn>(
  //   baseModelSqlV2.context,
  // );

  // const childColumn = await relation.getChildColumn(baseModelSqlV2.context);
  // const parentColumn = await relation.getParentColumn(baseModelSqlV2.context);
  // const parentModel = await parentColumn.getModel(baseModelSqlV2.context);
  // const selectColumn = (
  //   await parentModel.getColumns(baseModelSqlV2.context)
  // ).find((col) => col.id === lookupColOpt.fk_lookup_column_id);

  // if (relation.type === RelationTypes.HAS_MANY) {
  //   return (qb: Knex.QueryBuilder) => {
  //     generateRecursiveCTE({
  //       qb,
  //       cteTableName: tableAlias,
  //       idColumnName: parentColumn.column_name,
  //       linkIdColumnName: childColumn.column_name,
  //       knex: baseModelSqlV2.dbDriver,
  //       selectingColumnName: selectColumn.column_name,
  //       sourceTable: baseModelSqlV2.getTnPath(parentModel.table_name),
  //     });
  //   };
  // } else if (relation.type === RelationTypes.BELONGS_TO) {
  //   return (qb: Knex.QueryBuilder) => {
  //     generateRecursiveCTE({
  //       qb,
  //       cteTableName: tableAlias,
  //       idColumnName: parentColumn.column_name,
  //       linkIdColumnName: childColumn.column_name,
  //       knex: baseModelSqlV2.dbDriver,
  //       selectingColumnName: selectColumn.column_name,
  //       direction: 'link_to_id',
  //       sourceTable: baseModelSqlV2.getTnPath(parentModel.table_name),
  //     });
  //   };
  // }
}
