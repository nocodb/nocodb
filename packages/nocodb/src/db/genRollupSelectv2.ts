import { RelationTypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { LinksColumn } from '~/models';
import type { RollupColumn } from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { Knex } from 'knex';

export default async function ({
  baseModelSqlv2,
  knex,
  // tn,
  // column,
  alias,
  columnOptions,
}: {
  baseModelSqlv2: BaseModelSqlv2;
  knex: XKnex;
  alias?: string;
  columnOptions: RollupColumn | LinksColumn;
}): Promise<{ builder: Knex.QueryBuilder | any }> {
  const relationColumn = await columnOptions.getRelationColumn();
  const relationColumnOption: LinkToAnotherRecordColumn =
    (await relationColumn.getColOptions()) as LinkToAnotherRecordColumn;
  const rollupColumn = await columnOptions.getRollupColumn();
  const childCol = await relationColumnOption.getChildColumn();
  const childModel = await childCol?.getModel();
  const parentCol = await relationColumnOption.getParentColumn();
  const parentModel = await parentCol?.getModel();
  const refTableAlias = `__nc_rollup`;

  switch (relationColumnOption.type) {
    case RelationTypes.HAS_MANY:
      return {
        builder: knex(
          `${baseModelSqlv2.getTnPath(
            childModel?.table_name,
          )} as ${refTableAlias}`,
        )
          [columnOptions.rollup_function as string]?.(
            knex.ref(`${refTableAlias}.${rollupColumn.column_name}`),
          )
          .where(
            knex.ref(
              `${alias || baseModelSqlv2.getTnPath(parentModel.table_name)}.${
                parentCol.column_name
              }`,
            ),
            '=',
            knex.ref(`${refTableAlias}.${childCol.column_name}`),
          ),
      };
    case RelationTypes.MANY_TO_MANY: {
      const mmModel = await relationColumnOption.getMMModel();
      const mmChildCol = await relationColumnOption.getMMChildColumn();
      const mmParentCol = await relationColumnOption.getMMParentColumn();

      return {
        builder: knex(
          `${baseModelSqlv2.getTnPath(
            parentModel?.table_name,
          )} as ${refTableAlias}`,
        )
          [columnOptions.rollup_function as string]?.(
            knex.ref(`${refTableAlias}.${rollupColumn.column_name}`),
          )
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name),
            knex.ref(
              `${baseModelSqlv2.getTnPath(mmModel.table_name)}.${
                mmParentCol.column_name
              }`,
            ),
            '=',
            knex.ref(`${refTableAlias}.${parentCol.column_name}`),
          )
          .where(
            knex.ref(
              `${baseModelSqlv2.getTnPath(mmModel.table_name)}.${
                mmChildCol.column_name
              }`,
            ),
            '=',
            knex.ref(
              `${alias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
                childCol.column_name
              }`,
            ),
          ),
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
