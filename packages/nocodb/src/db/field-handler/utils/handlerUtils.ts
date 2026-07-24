import {
  isMMOrMMLike,
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
import type { ClientType } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import type CustomKnex from '~/db/CustomKnex';
import { Filter, Model } from '~/models';
import { recursiveCTEFromLookupColumn } from '~/helpers/lookupHelpers';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/ncError';
import { getDisplayValueOfRefTable } from '~/db/generateLookupSelectQuery';
import { DBQueryClient } from '~/dbQueryClient';
import {
  buildNestedLookupLevelLimit,
  loadLookupSortAndLimit,
} from '~/db/lookupSortLimit';

export function ncIsStringHasValue(val: string | undefined | null) {
  return val !== '' && !ncIsUndefined(val) && !ncIsNull(val);
}

/**
 * Detect a knex raw / ref value. Dynamic (field-to-field) filters set
 * `filter.value` to a `knex.ref()` / `knex.raw()` column reference instead of
 * a scalar literal. Such objects carry `isRawInstance === true`.
 */
export function ncIsKnexRawOrRef(val: any): val is Knex.Raw {
  return (
    !!val && typeof val === 'object' && (val as any).isRawInstance === true
  );
}

/**
 * Build a `%value%` LIKE pattern where `value` is a column reference
 * (knex raw / ref) rather than a scalar literal.
 *
 * The wildcards must be concatenated in SQL — dialect specific — so the
 * reference stays a reference. Interpolating it in JS (`` `%${ref}%` ``)
 * stringifies the reference into a literal, which never matches.
 */
export function ncLikePatternForRef(knex: CustomKnex, ref: Knex.Raw): Knex.Raw {
  const client = knex.clientType();
  if (client === 'mysql' || client === 'mysql2' || client === 'vitess') {
    return knex.raw("CONCAT('%', ?, '%')", [ref]);
  }
  if (client === 'mssql') {
    return knex.raw("('%' + ? + '%')", [ref]);
  }
  // pg, sqlite3, oracledb, databricks and default support `||` concatenation
  return knex.raw("('%' || ? || '%')", [ref]);
}

export const negatedMapping = {
  nlike: { comparison_op: 'like' },
  neq: { comparison_op: 'eq' },
  blank: { comparison_op: 'notblank' },
  notchecked: { comparison_op: 'checked' },
  nanyof: { comparison_op: 'anyof' },
  nallof: { comparison_op: 'allof' },
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

  const dbQueryClient = DBQueryClient.get(
    baseModelSqlv2.dbDriver.clientType() as ClientType,
  );

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
      const relationType = isMMOrMMLike(relationColumn)
        ? 'mm'
        : relationColOptions.type;
      switch (relationType) {
        case RelationTypes.HAS_MANY:
          {
            const useRecursiveEvaluation = parseProp(
              lookupColumn.meta,
            )?.useRecursiveEvaluation;
            // TODO: [recursive lookup]
            // eslint-disable-next-line no-constant-condition
            if (false && useRecursiveEvaluation) {
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
              const hmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
                childBaseModel,
                relAlias,
              );
              clauses.push((qb) => {
                qb.join(
                  dbQueryClient.tableAlias(
                    knex,
                    childBaseModel.getTnPath(childModel.table_name),
                    relAlias,
                  ),
                  `${alias}.${parentColumn.column_name}`,
                  `${relAlias}.${childColumn.column_name}`,
                );
                if (hmSoftDeleteFilter) {
                  qb.where(hmSoftDeleteFilter);
                }
              });
            }
          }
          break;
        case RelationTypes.BELONGS_TO:
          {
            const useRecursiveEvaluation = parseProp(
              lookupColumn.meta,
            )?.useRecursiveEvaluation;
            // TODO: [recursive lookup]
            // eslint-disable-next-line no-constant-condition
            if (false && useRecursiveEvaluation) {
              rootAppliances.push(
                await recursiveCTEFromLookupColumn({
                  baseModelSqlV2: childBaseModel,
                  lookupColumn,
                  tableAlias: relAlias,
                }),
              );
              clauses.push((qb) => {
                qb.join(
                  dbQueryClient.tableAlias(knex, relAlias, relAlias),
                  `${alias}.${parentColumn.column_name}`,
                  `${relAlias}.root_id`,
                );
              });
            } else {
              const btSoftDeleteFilter = await getAliasedSoftDeleteFilter(
                parentBaseModel,
                relAlias,
              );
              clauses.push((qb) => {
                qb.join(
                  dbQueryClient.tableAlias(
                    knex,
                    parentBaseModel.getTnPath(parentModel.table_name),
                    relAlias,
                  ),
                  `${alias}.${childColumn.column_name}`,
                  `${relAlias}.${parentColumn.column_name}`,
                );
                if (btSoftDeleteFilter) {
                  qb.where(btSoftDeleteFilter);
                }
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

            const mmSoftDeleteFilter = await getAliasedSoftDeleteFilter(
              parentBaseModel,
              relAlias,
            );
            clauses.push((qb) => {
              qb.join(
                dbQueryClient.tableAlias(
                  knex,
                  mmBaseModel.getTnPath(mmModel.table_name),
                  assocAlias,
                ),
                `${assocAlias}.${mmChildColumn.column_name}`,
                `${alias}.${childColumn.column_name}`,
              ).join(
                dbQueryClient.tableAlias(
                  knex,
                  parentBaseModel.getTnPath(parentModel.table_name),
                  relAlias,
                ),
                `${relAlias}.${parentColumn.column_name}`,
                `${assocAlias}.${mmParentColumn.column_name}`,
              );
              if (mmSoftDeleteFilter) {
                qb.where(mmSoftDeleteFilter);
              }
            });
          }
          break;
      }

      // Per-lookup Limit — INNER level (PG): restrict this nested level's joined
      // rows to the top-N per the previous level's row, matching the display /
      // formula builders so all three consumers show the same set. Only BT and
      // HM nested levels are limited (the display builder does not limit nested
      // MM levels); the config comes from THIS level's lookup column. Applied as
      // a deferred clause because `qb` isn't available until the clauses run.
      if (
        baseModelSqlv2.isPg &&
        lookupColumn.uidt === UITypes.Lookup &&
        (relationType === RelationTypes.HAS_MANY ||
          relationType === RelationTypes.BELONGS_TO)
      ) {
        const cfg = await loadLookupSortAndLimit(context, lookupColumn);
        if (cfg.hasConfig && cfg.limitVal > 0) {
          const isHm = relationType === RelationTypes.HAS_MANY;
          const applier = await buildNestedLookupLevelLimit({
            nestedAlias: relAlias,
            nestedRefBaseModel: isHm ? childBaseModel : parentBaseModel,
            corrColName: isHm
              ? childColumn.column_name
              : parentColumn.column_name,
            prevAlias: alias,
            prevCorrColName: isHm
              ? parentColumn.column_name
              : childColumn.column_name,
            sorts: cfg.sorts,
            limitVal: cfg.limitVal,
            takeLast: cfg.takeLast,
          });
          if (applier) clauses.push(applier);
        }
      }
    }

    if (lookupColumn.uidt === UITypes.Lookup) {
      const filterOperationResult = await nestedConditionJoin({
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
      clauses.push(filterOperationResult.clause);
      rootAppliances.push(filterOperationResult.rootApply);
    } else {
      const relationType = isMMOrMMLike(relationColumn)
        ? 'mm'
        : relationColOptions.type;
      // Resolve display column once — honors per-LTAR fk_display_value_column_id override
      const displayCol = await getDisplayValueOfRefTable(
        context,
        relationColumn,
      );
      switch (relationType) {
        case RelationTypes.HAS_MANY: {
          const filterOperationResult = await parseConditionV2(
            childBaseModel,
            new Filter({
              ...filter,
              fk_model_id: childModel.id,
              fk_column_id: displayCol?.id,
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
              fk_column_id: displayCol?.id,
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
              fk_column_id: displayCol?.id,
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
    sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
    val: any;
  },
  rootArgs: {
    knex: CustomKnex;
    filter: Filter;
    column: Column;
  },
  _options: FilterOptions,
): Promise<never> => {
  return NcError._.unsupportedFilterOperation(rootArgs?.filter?.comparison_op);
};
