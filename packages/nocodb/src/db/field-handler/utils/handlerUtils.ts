import { ncIsNull, ncIsUndefined, RelationTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import { Filter, Model } from '~/models';

export function ncIsStringHasValue(val: string | undefined | null) {
  return val !== '' && !ncIsUndefined(val) && !ncIsNull(val);
}

export const negatedMapping = {
  nlike: { comparison_op: 'like' },
  neq: { comparison_op: 'eq' },
  blank: { comparison_op: 'notblank' },
  notchecked: { comparison_op: 'checked' },
};

export function getAlias(aliasCount: { count: number }) {
  return `__nc${aliasCount.count++}`;
}

export async function nestedConditionJoin({
  baseModelSqlv2,
  filter,
  lookupColumn,
  qb,
  knex,
  alias,
  aliasCount,
  throwErrorIfInvalid,
  parseConditionV2,
}: {
  baseModelSqlv2: IBaseModelSqlV2;
  filter: Filter;
  lookupColumn: Column;
  qb: Knex.QueryBuilder;
  knex;
  alias: string;
  aliasCount: { count: number };
  throwErrorIfInvalid: boolean;
  parseConditionV2;
}) {
  const context = baseModelSqlv2.context;

  if (
    lookupColumn.uidt === UITypes.Lookup ||
    lookupColumn.uidt === UITypes.LinkToAnotherRecord
  ) {
    const relationColumn =
      lookupColumn.uidt === UITypes.Lookup
        ? await (
            await lookupColumn.getColOptions<LookupColumn>(context)
          ).getRelationColumn(context)
        : lookupColumn;
    const relationColOptions =
      await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
    const relAlias = `__nc${aliasCount.count++}`;

    const { parentContext, childContext, mmContext, refContext } =
      await relationColOptions.getParentChildContext(context);

    const childColumn = await relationColOptions.getChildColumn(childContext);
    const parentColumn = await relationColOptions.getParentColumn(
      parentContext,
    );
    const childModel = await childColumn.getModel(childContext);
    await childModel.getColumns(childContext);
    const parentModel = await parentColumn.getModel(parentContext);
    await parentModel.getColumns(parentContext);

    const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
      model: parentModel,
      dbDriver: baseModelSqlv2.dbDriver,
    });
    const childBaseModel = await Model.getBaseModelSQL(childContext, {
      model: childModel,
      dbDriver: baseModelSqlv2.dbDriver,
    });

    {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            qb.join(
              knex.raw(`?? as ??`, [
                childBaseModel.getTnPath(childModel.table_name),
                relAlias,
              ]),
              `${alias}.${parentColumn.column_name}`,
              `${relAlias}.${childColumn.column_name}`,
            );
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            qb.join(
              knex.raw(`?? as ??`, [
                parentBaseModel.getTnPath(parentModel.table_name),
                relAlias,
              ]),
              `${alias}.${childColumn.column_name}`,
              `${relAlias}.${parentColumn.column_name}`,
            );
          }
          break;
        case 'mm':
          {
            const mmModel = await relationColOptions.getMMModel(mmContext);
            const mmParentColumn = await relationColOptions.getMMParentColumn(
              mmContext,
            );
            const mmChildColumn = await relationColOptions.getMMChildColumn(
              mmContext,
            );

            const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
              model: mmModel,
              dbDriver: baseModelSqlv2.dbDriver,
            });

            const assocAlias = `__nc${aliasCount.count++}`;

            qb.join(
              knex.raw(`?? as ??`, [
                mmBaseModel.getTnPath(mmModel.table_name),
                assocAlias,
              ]),
              `${assocAlias}.${mmChildColumn.column_name}`,
              `${alias}.${childColumn.column_name}`,
            ).join(
              knex.raw(`?? as ??`, [
                parentBaseModel.getTnPath(parentModel.table_name),
                relAlias,
              ]),
              `${relAlias}.${parentColumn.column_name}`,
              `${assocAlias}.${mmParentColumn.column_name}`,
            );
          }
          break;
      }
    }

    if (lookupColumn.uidt === UITypes.Lookup) {
      await nestedConditionJoin({
        baseModelSqlv2,
        filter,
        lookupColumn: await (
          await lookupColumn.getColOptions<LookupColumn>(context)
        ).getLookupColumn(refContext),
        qb,
        knex,
        alias: relAlias,
        aliasCount,
        throwErrorIfInvalid,
        parseConditionV2,
      });
    } else {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            (
              await parseConditionV2(
                childBaseModel,
                new Filter({
                  ...filter,
                  fk_model_id: childModel.id,
                  fk_column_id: childModel.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            (
              await parseConditionV2(
                parentBaseModel,
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel?.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
        case 'mm':
          {
            (
              await parseConditionV2(
                parentBaseModel,
                new Filter({
                  ...filter,
                  fk_model_id: parentModel.id,
                  fk_column_id: parentModel.displayValue?.id,
                }),
                aliasCount,
                relAlias,
                undefined,
                throwErrorIfInvalid,
              )
            )(qb);
          }
          break;
      }
    }
  } else {
    (
      await parseConditionV2(
        baseModelSqlv2,
        new Filter({
          ...filter,
          fk_model_id: (await lookupColumn.getModel(context)).id,
          fk_column_id: lookupColumn?.id,
        }),
        aliasCount,
        alias,
        undefined,
        throwErrorIfInvalid,
      )
    )(qb);
  }
}
