import {
  ncIsNull,
  ncIsUndefined,
  parseProp,
  RelationTypes,
  UITypes,
} from 'nocodb-sdk';
import type {
  ConditionParser,
  FilterOperationResult,
  FilterOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { Filter, Model } from '~/models';
import { recursiveCTEFromLookupColumn } from '~/helpers/lookupHelpers';

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
  knex,
  alias,
  aliasCount,
  throwErrorIfInvalid,
  parseConditionV2,
}: {
  baseModelSqlv2: IBaseModelSqlV2;
  filter: Filter;
  lookupColumn: Column;
  knex;
  alias: string;
  aliasCount: { count: number };
  throwErrorIfInvalid: boolean;
  parseConditionV2: ConditionParser;
}): Promise<FilterOperationResult> {
  const context = baseModelSqlv2.context;

  const clauses: ((qb: Knex.QueryBuilder) => void)[] = [];
  const rootAppliances: ((qb: Knex.QueryBuilder) => void)[] = [];

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
            const useRecursiveEvaluation = parseProp(
              lookupColumn.meta,
            )?.useRecursiveEvaluation;
            if (useRecursiveEvaluation) {
              rootAppliances.push(
                await recursiveCTEFromLookupColumn({
                  baseModelSqlV2: childBaseModel,
                  lookupColumn,
                  tableAlias: relAlias,
                }),
              );

              clauses.push((qb) => {
                qb.join(
                  knex(`${relAlias} as ${relAlias}`)
                    .where(
                      `${relAlias}.root_id`,
                      '<>',
                      baseModelSqlv2.dbDriver.raw('??.??', [relAlias, 'id']),
                    )
                    .as(relAlias),
                  `${relAlias}.root_id`,
                  `${alias}.${parentColumn.column_name}`,
                );
              });
            } else {
              clauses.push((qb) => {
                qb.join(
                  knex.raw(`?? as ??`, [
                    childBaseModel.getTnPath(childModel.table_name),
                    relAlias,
                  ]),
                  `${alias}.${parentColumn.column_name}`,
                  `${relAlias}.${childColumn.column_name}`,
                );
              });
            }
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            const useRecursiveEvaluation = parseProp(
              lookupColumn.meta,
            )?.useRecursiveEvaluation;
            if (useRecursiveEvaluation) {
              rootAppliances.push(
                await recursiveCTEFromLookupColumn({
                  baseModelSqlV2: childBaseModel,
                  lookupColumn,
                  tableAlias: relAlias,
                }),
              );
              clauses.push((qb) => {
                qb.join(
                  knex.raw(`?? as ??`, [relAlias, relAlias]),
                  `${alias}.${parentColumn.column_name}`,
                  `${relAlias}.root_id`,
                );
              });
            } else {
              clauses.push((qb) => {
                qb.join(
                  knex.raw(`?? as ??`, [
                    parentBaseModel.getTnPath(parentModel.table_name),
                    relAlias,
                  ]),
                  `${alias}.${childColumn.column_name}`,
                  `${relAlias}.${parentColumn.column_name}`,
                );
              });
            }
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

            clauses.push((qb) => {
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
            });
          }
          break;
      }
    }

    if (lookupColumn.uidt === UITypes.Lookup) {
      return nestedConditionJoin({
        baseModelSqlv2,
        filter,
        lookupColumn: await (
          await lookupColumn.getColOptions<LookupColumn>(context)
        ).getLookupColumn(refContext),
        knex,
        alias: relAlias,
        aliasCount,
        throwErrorIfInvalid,
        parseConditionV2,
      });
    } else {
      switch (relationColOptions.type) {
        case RelationTypes.HAS_MANY: {
          const filterOperationResult = await parseConditionV2(
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
          );
          clauses.push(filterOperationResult.clause);
          rootAppliances.push(filterOperationResult.rootApply);
          break;
        }
        case RelationTypes.BELONGS_TO: {
          const filterOperationResult = await parseConditionV2(
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
          );
          clauses.push(filterOperationResult.clause);
          rootAppliances.push(filterOperationResult.rootApply);
          break;
        }
        case 'mm': {
          const filterOperationResult = await parseConditionV2(
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
          );
          clauses.push(filterOperationResult.clause);
          rootAppliances.push(filterOperationResult.rootApply);
          break;
        }
      }
    }
  } else {
    const filterOperationResult = await parseConditionV2(
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
    );
    clauses.push(filterOperationResult.clause);
    rootAppliances.push(filterOperationResult.rootApply);
  }
  return {
    clause: (qb) => {
      for (const each of clauses) {
        each(qb);
      }
    },
    rootApply: (qb) => {
      for (const each of rootAppliances) {
        each?.(qb);
      }
    },
  };
}

export const unsupportedFilter = async (
  _args: {
    sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
    val: any;
  },
  rootArgs: {
    knex: CustomKnex;
    filter: Filter;
    column: Column;
  },
  _options: FilterOptions,
) => {
  throw new Error(
    `Unsupported comparison operator for ${rootArgs.column.uidt}: ${rootArgs.filter.comparison_op}`,
  );
};
