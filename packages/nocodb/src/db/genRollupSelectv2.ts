import { NcDataErrorCodes, RelationTypes } from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  LinksColumn,
  LinkToAnotherRecordColumn,
  RollupColumn,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import { Model } from '~/models';

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
  const context = baseModelSqlv2.context;

  const relationColumn = await columnOptions.getRelationColumn(context);
  const relationColumnOption: LinkToAnotherRecordColumn =
    (await relationColumn.getColOptions(context)) as LinkToAnotherRecordColumn;
  const rollupColumn = await columnOptions.getRollupColumn(context);
  const childCol = await relationColumnOption.getChildColumn(context);
  const childModel = await childCol?.getModel(context);
  const parentCol = await relationColumnOption.getParentColumn(context);
  const parentModel = await parentCol?.getModel(context);
  const refTableAlias = `__nc_rollup`;

  const parentBaseModel = await Model.getBaseModelSQL(context, {
    model: parentModel,
    dbDriver: knex,
  });
  const childBaseModel = await Model.getBaseModelSQL(context, {
    model: childModel,
    dbDriver: knex,
  });

  const applyFunction = (qb: any) => {
    // if postgres and rollup function is sum/sumDistinct/avgDistinct/avg, then cast the column to integer when type is boolean
    if (
      baseModelSqlv2.isPg &&
      ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(
        columnOptions.rollup_function,
      ) &&
      ['bool', 'boolean'].includes(rollupColumn.dt)
    ) {
      qb[columnOptions.rollup_function as string]?.(
        knex.raw('??.??::integer', [refTableAlias, rollupColumn.column_name]),
      );
      return;
    }

    if (
      ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(
        columnOptions.rollup_function,
      )
    ) {
      qb.select(
        knex.raw(`COALESCE((??), 0)`, [
          knex[columnOptions.rollup_function as string]?.(
            knex.ref(`${refTableAlias}.${rollupColumn.column_name}`),
          ),
        ]),
      );
    } else {
      qb[columnOptions.rollup_function as string]?.(
        knex.ref(`${refTableAlias}.${rollupColumn.column_name}`),
      );
    }
  };

  switch (relationColumnOption.type) {
    case RelationTypes.HAS_MANY: {
      const queryBuilder: any = knex(
        knex.raw(`?? as ??`, [
          childBaseModel.getTnPath(childModel),
          refTableAlias,
        ]),
      ).where(
        knex.ref(
          `${alias || parentBaseModel.getTnPath(parentModel.table_name)}.${
            parentCol.column_name
          }`,
        ),
        '=',
        knex.ref(`${refTableAlias}.${childCol.column_name}`),
      );
      applyFunction(queryBuilder);

      return {
        builder: queryBuilder,
      };
    }

    case RelationTypes.ONE_TO_ONE: {
      const qb = knex(
        knex.raw(`?? as ??`, [
          childBaseModel.getTnPath(childModel?.table_name),
          refTableAlias,
        ]),
      ).where(
        knex.ref(
          `${alias || parentBaseModel.getTnPath(parentModel.table_name)}.${
            parentCol.column_name
          }`,
        ),
        '=',
        knex.ref(`${refTableAlias}.${childCol.column_name}`),
      );

      applyFunction(qb);
      return {
        builder: qb,
      };
    }

    case RelationTypes.MANY_TO_MANY: {
      const mmModel = await relationColumnOption.getMMModel(context);
      const mmChildCol = await relationColumnOption.getMMChildColumn(context);
      const mmParentCol = await relationColumnOption.getMMParentColumn(context);
      const assocBaseModel = await Model.getBaseModelSQL(context, {
        id: mmModel.id,
        dbDriver: knex,
      });
      if (!mmModel) {
        return this.dbDriver.raw(`?`, [
          NcDataErrorCodes.NC_ERR_MM_MODEL_NOT_FOUND,
        ]);
      }

      const qb = knex(
        knex.raw(`?? as ??`, [
          parentBaseModel.getTnPath(parentModel?.table_name),
          refTableAlias,
        ]),
      )
        .innerJoin(
          assocBaseModel.getTnPath(mmModel.table_name) as any,
          knex.ref(
            `${assocBaseModel.getTnPath(mmModel.table_name)}.${
              mmParentCol.column_name
            }`,
          ) as any,
          '=',
          knex.ref(`${refTableAlias}.${parentCol.column_name}`) as any,
        )
        .where(
          knex.ref(
            `${assocBaseModel.getTnPath(mmModel.table_name)}.${
              mmChildCol.column_name
            }`,
          ),
          '=',
          knex.ref(
            `${alias || childBaseModel.getTnPath(childModel.table_name)}.${
              childCol.column_name
            }`,
          ),
        );

      applyFunction(qb);

      return {
        builder: qb,
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
