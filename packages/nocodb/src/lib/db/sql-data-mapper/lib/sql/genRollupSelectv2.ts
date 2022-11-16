import RollupColumn from '../../../../models/RollupColumn';
import { XKnex } from '../../index';
import LinkToAnotherRecordColumn from '../../../../models/LinkToAnotherRecordColumn';
import { Knex } from 'knex';
import { RelationTypes } from 'nocodb-sdk';

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

  switch (relationColumnOption.type) {
    case RelationTypes.HAS_MANY:
      // if (!rollup.table_name || !rollup.rtn) {
      //   rollup = { ...rollup, ...hasMany.find(hm => hm.table_name === rollup.rltn) };
      // }
      return {
        builder: knex(childModel?.table_name)
          [columnOptions.rollup_function]?.(
            knex.ref(`${childModel?.table_name}.${rollupColumn.column_name}`)
          )
          .where(
            knex.ref(
              `${alias || parentModel.table_name}.${parentCol.column_name}`
            ),
            '=',
            knex.ref(`${childModel.table_name}.${childCol.column_name}`)
          ),
      };
    case RelationTypes.MANY_TO_MANY: {
      const mmModel = await relationColumnOption.getMMModel();
      const mmChildCol = await relationColumnOption.getMMChildColumn();
      const mmParentCol = await relationColumnOption.getMMParentColumn();

      return {
        builder: knex(parentModel.table_name)
          [columnOptions.rollup_function]?.(
            knex.ref(`${parentModel.table_name}.${rollupColumn.column_name}`)
          )
          .innerJoin(
            mmModel.table_name,
            knex.ref(`${mmModel.table_name}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${parentModel.table_name}.${parentCol.column_name}`)
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
