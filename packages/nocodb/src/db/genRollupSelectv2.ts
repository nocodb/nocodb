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

  const childView = await relationColumnOption.getChildView();
  let listArgs: any = {};
  if (childView) {
    const { dependencyFields } = await getAst({
      model: childModel,
      query: {},
      view: childView,
      throwErrorIfInvalidParams: false,
    });

    listArgs = dependencyFields;
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}
  }

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

      await conditionV2(
        baseModelSqlv2,
        [
          ...(childView
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList({ viewId: childView.id })) ||
                    [],
                  is_group: true,
                }),
              ]
            : []),
        ],
        queryBuilder,
        undefined,
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

      await conditionV2(
        baseModelSqlv2,
        [
          ...(childView
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList({ viewId: childView.id })) ||
                    [],
                  is_group: true,
                }),
              ]
            : []),
        ],
        qb,
        undefined,
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

      await conditionV2(
        baseModelSqlv2,
        [
          ...(childView
            ? [
                new Filter({
                  children:
                    (await Filter.rootFilterList({ viewId: childView.id })) ||
                    [],
                  is_group: true,
                }),
              ]
            : []),
        ],
        qb,
        undefined,
      );

      return {
        builder: qb,
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
