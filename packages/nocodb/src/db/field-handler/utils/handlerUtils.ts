import { ncIsNull, ncIsUndefined, RelationTypes, UITypes } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import { Filter } from '~/models';

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

    const childColumn = await relationColOptions.getChildColumn(context);
    const parentColumn = await relationColOptions.getParentColumn(context);
    const childModel = await childColumn.getModel(context);
    await childModel.getColumns(context);
    const parentModel = await parentColumn.getModel(context);
    await parentModel.getColumns(context);
    {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY:
          {
            qb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(childModel.table_name),
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
                baseModelSqlv2.getTnPath(parentModel.table_name),
                relAlias,
              ]),
              `${alias}.${childColumn.column_name}`,
              `${relAlias}.${parentColumn.column_name}`,
            );
          }
          break;
        case 'mm':
          {
            const mmModel = await relationColOptions.getMMModel(context);
            const mmParentColumn = await relationColOptions.getMMParentColumn(
              context,
            );
            const mmChildColumn = await relationColOptions.getMMChildColumn(
              context,
            );

            const assocAlias = `__nc${aliasCount.count++}`;

            qb.join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(mmModel.table_name),
                assocAlias,
              ]),
              `${assocAlias}.${mmChildColumn.column_name}`,
              `${alias}.${childColumn.column_name}`,
            ).join(
              knex.raw(`?? as ??`, [
                baseModelSqlv2.getTnPath(parentModel.table_name),
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
        ).getLookupColumn(context),
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
                baseModelSqlv2,
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
                baseModelSqlv2,
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
                baseModelSqlv2,
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
