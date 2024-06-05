import { NcDataErrorCodes, RelationTypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  LinksColumn,
  LinkToAnotherRecordColumn,
  RollupColumn,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import { Filter } from '~/models';
import getAst from '~/helpers/getAst';
import conditionV2 from '~/db/conditionV2';

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
    case RelationTypes.HAS_MANY: {
      const queryBuilder: any = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(childModel?.table_name),
          refTableAlias,
        ]),
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
        );

      return {
        builder: queryBuilder,
      };
    }

    case RelationTypes.ONE_TO_ONE: {
      const qb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(childModel?.table_name),
          refTableAlias,
        ]),
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
        );

      return {
        builder: qb,
      };
    }

    case RelationTypes.MANY_TO_MANY: {
      const mmModel = await relationColumnOption.getMMModel();
      const mmChildCol = await relationColumnOption.getMMChildColumn();
      const mmParentCol = await relationColumnOption.getMMParentColumn();

      if (!mmModel) {
        return this.dbDriver.raw(`?`, [
          NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
        ]);
      }

      const qb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(parentModel?.table_name),
          refTableAlias,
        ]),
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
        );

      return {
        builder: qb,
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
