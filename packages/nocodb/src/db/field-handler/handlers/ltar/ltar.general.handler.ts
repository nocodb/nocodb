import { RelationTypes } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Column, LinkToAnotherRecordColumn } from '~/models';
import type { FilterOptions } from '~/db/field-handler/field-handler.interface';
import type { Knex } from '~/db/CustomKnex';
import {
  getAlias,
  negatedMapping,
} from '~/db/field-handler/utils/handlerUtils';
import { Filter, Model } from '~/models';
import { GenericFieldHandler } from '~/db/field-handler/handlers/generic';

export class LtarGeneralHandler extends GenericFieldHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const {
      context,
      alias,
      baseModel: baseModelSqlv2,
      depth: aliasCount,
      throwErrorIfInvalid,
      conditionParser: parseConditionV2,
    } = options;
    const colOptions = (await column.getColOptions(
      context,
    )) as LinkToAnotherRecordColumn;
    let rootApply: ((qb: Knex.QueryBuilder) => void) | undefined = undefined;

    const { parentContext, childContext, mmContext } =
      await colOptions.getParentChildContext(context, column);

    const childColumn = await colOptions.getChildColumn(context);
    const parentColumn = await colOptions.getParentColumn(context);
    const childModel = await childColumn.getModel(childContext);
    await childModel.getColumns(childContext);
    const parentModel = await parentColumn.getModel(parentContext);
    await parentModel.getColumns(parentContext);

    let relationType = colOptions.type;

    if (relationType === RelationTypes.ONE_TO_ONE) {
      relationType = column.meta?.bt
        ? RelationTypes.BELONGS_TO
        : RelationTypes.HAS_MANY;
    }

    if (relationType === RelationTypes.HAS_MANY) {
      const childTableAlias = getAlias(aliasCount);

      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: childModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      // Knex's TypeScript definitions do not correctly infer knex.raw() or knex.ref()
      // as valid column references. This causes type errors when used in query builders
      // like `whereIn()`, `where()`, and `select()`. Casting to `any` ensures proper
      // SQL generation while avoiding TypeScript issues.
      const childColumnRef = knex.raw('??.??', [
        childTableAlias,
        childColumn.column_name,
      ]) as any;
      const parentColumnRef = knex.raw('??.??', [
        alias || baseModelSqlv2.getTnPath(parentModel.table_name),
        parentColumn.column_name,
      ]) as any;

      if (
        ['blank', 'notblank', 'checked', 'notchecked'].includes(
          filter.comparison_op,
        )
      ) {
        const selectHmCount = knex(
          childBaseModel.getTnPath(childModel.table_name, childTableAlias),
        )
          .count(childColumn.column_name)
          .whereRaw('?? = ??', [childColumnRef, parentColumnRef]);

        return {
          rootApply,
          clause: (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectHmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectHmCount);
            }
          },
        };
      }
      const selectQb = knex(
        childBaseModel.getTnPath(childModel.table_name, childTableAlias),
      ).select(childColumnRef);
      const parseOperationResult = await parseConditionV2(
        childBaseModel,
        new Filter({
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
          fk_model_id: childModel.id,
          fk_column_id: childModel?.displayValue?.id,
        }),
        aliasCount,
        childTableAlias,
        undefined,
        throwErrorIfInvalid,
      );
      parseOperationResult.clause(selectQb);
      rootApply = (qb: Knex.QueryBuilder) => {
        parseOperationResult.rootApply(qb);
      };

      return {
        rootApply,
        clause: (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.whereNotIn(parentColumnRef, selectQb);
          else qbP.whereIn(parentColumnRef, selectQb);
        },
      };
    } else if (relationType === RelationTypes.BELONGS_TO) {
      const parentTableAlias = getAlias(aliasCount);
      const childTableAlias =
        alias || baseModelSqlv2.getTnPath(childModel.table_name);

      const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
        model: parentModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      // Knex's TypeScript definitions do not correctly infer knex.raw() or knex.ref()
      // as valid column references. This causes type errors when used in query builders
      // like `whereIn()`, `where()`, and `select()`. Casting to `any` ensures proper
      // SQL generation while avoiding TypeScript issues.
      const parentColumnRef = knex.raw('??.??', [
        parentTableAlias,
        parentColumn.column_name,
      ]) as any;
      const childColumnRef = knex.raw('??.??', [
        childTableAlias,
        childColumn.column_name,
      ]) as any;
      if (
        ['blank', 'notblank', 'checked', 'notchecked'].includes(
          filter.comparison_op,
        )
      ) {
        // handle self reference
        if (parentModel.id === childModel.id) {
          if (filter.comparison_op === 'blank') {
            return {
              rootApply,
              clause: (qb) => {
                qb.whereNull(childColumnRef);
              },
            };
          } else {
            return {
              rootApply,
              clause: (qb) => {
                qb.whereNotNull(childColumnRef);
              },
            };
          }
        }

        const selectBtCount = knex(
          parentBaseModel.getTnPath(parentModel.table_name, parentTableAlias),
        )
          .count(parentColumnRef)
          .where(parentColumnRef, childColumnRef);

        return {
          rootApply,
          clause: (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectBtCount);
            } else {
              qb.whereNot(knex.raw('0'), selectBtCount);
            }
          },
        };
      }

      const selectQb = knex(
        parentBaseModel.getTnPath(parentModel.table_name, parentTableAlias),
      ).select(parentColumn.column_name);

      const parseOperationResult = await parseConditionV2(
        parentBaseModel,
        new Filter({
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
          fk_model_id: parentModel.id,
          fk_column_id: parentModel?.displayValue?.id,
        }),
        aliasCount,
        parentTableAlias,
        undefined,
        throwErrorIfInvalid,
      );
      parseOperationResult.clause(selectQb);

      rootApply = (qb: Knex.QueryBuilder) => {
        parseOperationResult.rootApply(qb);
      };

      return {
        rootApply,
        clause: (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping) {
            qbP.where((qb) =>
              qb
                .whereNotIn(childColumnRef, selectQb)
                .orWhereNull(childColumnRef),
            );
          } else qbP.whereIn(childColumnRef, selectQb);
        },
      };
    } else if (relationType === RelationTypes.MANY_TO_MANY) {
      const childTableAliasOrRef =
        alias || baseModelSqlv2.getTnPath(childModel.table_name);
      const parentTableAlias = getAlias(aliasCount);
      const mmTableAlias = getAlias(aliasCount);

      const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
        model: parentModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      const mmModel = await colOptions.getMMModel(context);
      const mmParentColumn = await colOptions.getMMParentColumn(context);
      const mmChildColumn = await colOptions.getMMChildColumn(context);

      const assocBaseModel = await Model.getBaseModelSQL(mmContext, {
        model: mmModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      // Knex's TypeScript definitions do not correctly infer knex.raw() or knex.ref()
      // as valid column references. This causes type errors when used in query builders
      // like `whereIn()`, `where()`, and `select()`. Casting to `any` ensures proper
      // SQL generation while avoiding TypeScript issues.
      const childColumnRef = knex.raw('??.??', [
        childTableAliasOrRef,
        childColumn.column_name,
      ]) as any;
      const parentColumnRef = knex.raw('??.??', [
        parentTableAlias,
        parentColumn.column_name,
      ]) as any;
      const mmParentColumnRef = knex.raw('??.??', [
        mmTableAlias,
        mmParentColumn.column_name,
      ]) as any;
      const mmChildColumnRef = knex.raw('??.??', [
        mmTableAlias,
        mmChildColumn.column_name,
      ]) as any;
      if (
        ['blank', 'notblank', 'checked', 'notchecked'].includes(
          filter.comparison_op,
        )
      ) {
        // handle self reference
        if (mmModel.id === childModel.id) {
          if (filter.comparison_op === 'blank') {
            return {
              rootApply,
              clause: (qb) => {
                qb.whereNull(childColumnRef);
              },
            };
          } else {
            return {
              rootApply,
              clause: (qb) => {
                qb.whereNotNull(childColumnRef);
              },
            };
          }
        }

        const selectMmCount = knex(
          assocBaseModel.getTnPath(mmModel.table_name, mmTableAlias),
        )
          .count(mmChildColumnRef)
          .where(mmChildColumnRef, childColumnRef);

        return {
          rootApply,
          clause: (qb) => {
            if (filter.comparison_op === 'blank') {
              qb.where(knex.raw('0'), selectMmCount);
            } else {
              qb.whereNot(knex.raw('0'), selectMmCount);
            }
          },
        };
      }

      const selectQb = knex(
        assocBaseModel.getTnPath(mmModel.table_name, mmTableAlias),
      )
        .select(mmChildColumnRef)
        .join(
          parentBaseModel.getTnPath(parentModel.table_name, parentTableAlias),
          mmParentColumnRef,
          parentColumnRef,
        );

      const parseOperationResult = await parseConditionV2(
        parentBaseModel,
        new Filter({
          ...filter,
          ...(filter.comparison_op in negatedMapping
            ? negatedMapping[filter.comparison_op]
            : {}),
          fk_model_id: parentModel.id,
          fk_column_id: parentModel?.displayValue?.id,
        }),
        aliasCount,
        parentTableAlias,
        undefined,
        throwErrorIfInvalid,
      );
      parseOperationResult.clause(selectQb);

      rootApply = (qb: Knex.QueryBuilder) => {
        parseOperationResult.rootApply(qb);
      };

      return {
        rootApply,
        clause: (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.where((qb) =>
              qb
                .whereNotIn(childColumnRef, selectQb)
                .orWhereNull(childColumnRef),
            );
          else qbP.whereIn(childColumnRef, selectQb);
        },
      };
    }

    return {
      rootApply,
      clause: (_qb) => {},
    };
  }
}
