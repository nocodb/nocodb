import { RelationTypes } from 'nocodb-sdk';
import type { RollupColumn } from '../models';
import type { XKnex } from '../db/CustomKnex';
import type { LinkToAnotherRecordColumn } from '../models';
import type { Knex } from 'knex';

export default async function ({
  knex,
  // tn,
  // column,
  alias,
  columnOptions,
}: {
  knex: XKnex;
  alias?: string;
  columnOptions: RollupColumn;
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
        builder: knex(`${childModel?.table_name} as ${refTableAlias}`)
          [columnOptions.rollup_function as string]?.(
            knex.ref(`${refTableAlias}.${rollupColumn.column_name}`)
          )
          .where(
            knex.ref(
              `${alias || parentModel.table_name}.${parentCol.column_name}`
            ),
            '=',
            knex.ref(`${refTableAlias}.${childCol.column_name}`)
          ),
      };
    case RelationTypes.MANY_TO_MANY: {
      const mmModel = await relationColumnOption.getMMModel();
      const mmChildCol = await relationColumnOption.getMMChildColumn();
      const mmParentCol = await relationColumnOption.getMMParentColumn();

      return {
        builder: knex(`${parentModel?.table_name} as ${refTableAlias}`)
          [columnOptions.rollup_function as string]?.(
            knex.ref(`${refTableAlias}.${rollupColumn.column_name}`)
          )
          .innerJoin(
            mmModel.table_name,
            knex.ref(`${mmModel.table_name}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${refTableAlias}.${parentCol.column_name}`)
          )
          .where(
            knex.ref(`${mmModel.table_name}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${alias || childModel.table_name}.${childCol.column_name}`
            )
          ),
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
