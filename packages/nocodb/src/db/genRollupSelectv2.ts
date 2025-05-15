import { NcDataErrorCodes, RelationTypes, UITypes } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from './IBaseModelSqlV2';
import type { Knex } from 'knex';
import type {
  ButtonColumn,
  FormulaColumn,
  LinksColumn,
  LinkToAnotherRecordColumn,
  RollupColumn,
} from '~/models';
import type { XKnex } from '~/db/CustomKnex';
import { RelationManager } from '~/db/relation-manager';
import { Model } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';

export default async function ({
  baseModelSqlv2,
  knex,
  alias,
  columnOptions,
}: {
  baseModelSqlv2: IBaseModelSqlV2;
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

  const applyFunction = async (qb: any) => {
    let selectColumnName = knex.raw('??.??', [
      refTableAlias,
      rollupColumn.column_name,
    ]);
    if (rollupColumn.uidt === UITypes.Formula) {
      const formulOption = await rollupColumn.getColOptions<
        FormulaColumn | ButtonColumn
      >(context);

      const formulaQb = await formulaQueryBuilderv2({
        baseModel: baseModelSqlv2,
        tree: formulOption.formula,
        model: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentModel
          : childModel,
        column: rollupColumn,
        aliasToColumn: {},
        tableAlias: refTableAlias,
        validateFormula: false,
        parsedTree: formulOption.getParsedTree(),
        baseUsers: undefined,
      });

      selectColumnName = knex.raw(formulaQb.builder).wrap('(', ')');
    } else if (
      [
        UITypes.CreatedTime,
        UITypes.CreatedBy,
        UITypes.LastModifiedTime,
        UITypes.LastModifiedBy,
      ].includes(rollupColumn.uidt)
    ) {
      // since all field are virtual field,
      // we use formula to generate query that can represent the column
      // to prevent duplicate logic
      const formulaQb = await formulaQueryBuilderv2({
        baseModel: baseModelSqlv2,
        tree: '{{' + rollupColumn.id + '}}',
        model: RelationManager.isRelationReversed(
          relationColumn,
          relationColumnOption,
        )
          ? parentModel
          : childModel,
        column: rollupColumn,
        tableAlias: refTableAlias,
        parsedTree: {
          type: 'Identifier',
          name: rollupColumn.id,
          raw: '{{' + rollupColumn.id + '}}',
          dataType: [UITypes.CreatedTime, UITypes.LastModifiedTime].includes(
            rollupColumn.uidt,
          )
            ? 'date'
            : 'string',
        },
      });

      selectColumnName = knex.raw(formulaQb.builder).wrap('(', ')');
    }

    // if postgres and rollup function is sum/sumDistinct/avgDistinct/avg, then cast the column to integer when type is boolean
    if (
      baseModelSqlv2.isPg &&
      ['sum', 'sumDistinct', 'avgDistinct', 'avg'].includes(
        columnOptions.rollup_function,
      ) &&
      ['bool', 'boolean'].includes(rollupColumn.dt)
    ) {
      qb[columnOptions.rollup_function as string]?.(
        knex.raw('??::integer', [selectColumnName]),
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
          knex[columnOptions.rollup_function as string]?.(selectColumnName),
        ]),
      );
    } else {
      qb[columnOptions.rollup_function as string]?.(selectColumnName);
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
      await applyFunction(queryBuilder);

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

      await applyFunction(qb);
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

      await applyFunction(qb);

      return {
        builder: qb,
      };
    }

    default:
      throw Error(`Unsupported relation type '${relationColumnOption.type}'`);
  }
}
