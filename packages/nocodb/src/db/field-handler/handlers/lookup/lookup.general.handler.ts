import { RelationTypes } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import type {
  FilterOptions,
  IFieldHandler,
} from '~/db/field-handler/field-handler.interface';
import type { Knex } from '~/db/CustomKnex';
import type { Filter } from '~/models';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import {
  getAlias,
  negatedMapping,
  nestedConditionJoin,
} from '~/db/field-handler/utils/handlerUtils';
import { Model } from '~/models';

export class LookupGeneralHandler extends ComputedFieldHandler {
  /**
   * Applies a filter condition for lookup columns based on the relation type.
   * It constructs a subquery to find related records that match the filter criteria
   * and then uses this subquery to filter the main query.
   *
   * @param knex - The Knex instance.
   * @param filter - The filter object containing comparison operator and value.
   * @param column - The lookup column being filtered.
   * @param options - Additional options including base model, alias count, error handling, and condition parser.
   * @returns A function that applies the filter condition to a query builder.
   */
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const {
      baseModel: baseModelSqlv2,
      depth: aliasCount,
      throwErrorIfInvalid,
      conditionParser: parseConditionV2,
    } = options;

    const context = baseModelSqlv2.context;

    const colOptions = await column.getColOptions<LookupColumn>(context);
    const relationColumn = await colOptions.getRelationColumn(context);
    const relationColumnOptions =
      await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
    // const relationModel = await relationColumn.getModel();
    const { refContext, parentContext, childContext, mmContext } =
      await relationColumnOptions.getParentChildContext(context);
    const lookupColumn = await colOptions.getLookupColumn(refContext);
    const alias = getAlias(aliasCount);
    let qb;
    {
      const childColumn = await relationColumnOptions.getChildColumn(
        childContext,
      );
      const parentColumn = await relationColumnOptions.getParentColumn(
        parentContext,
      );
      const childModel = await childColumn.getModel(childContext);
      await childModel.getColumns(childContext);
      const parentModel = await parentColumn.getModel(parentContext);
      await parentModel.getColumns(parentContext);

      const childBaseModel = await Model.getBaseModelSQL(childContext, {
        model: childModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      const parentBaseModel = await Model.getBaseModelSQL(parentContext, {
        model: parentModel,
        dbDriver: baseModelSqlv2.dbDriver,
      });

      let relationType = relationColumnOptions.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = relationColumn.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }

      if (relationType === RelationTypes.HAS_MANY) {
        qb = knex(
          knex.raw(`?? as ??`, [
            childBaseModel.getTnPath(childModel.table_name),
            alias,
          ]),
        );

        qb.select(`${alias}.${childColumn.column_name}`);

        await nestedConditionJoin({
          baseModelSqlv2: childBaseModel,
          filter: {
            ...filter,
            ...(filter.comparison_op in negatedMapping
              ? negatedMapping[filter.comparison_op]
              : {}),
          },
          lookupColumn,
          qb,
          knex,
          alias,
          aliasCount,
          throwErrorIfInvalid,
          parseConditionV2,
        });

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.whereNotIn(parentColumn.column_name, qb);
          else qbP.whereIn(parentColumn.column_name, qb);
        };
      } else if (relationType === RelationTypes.BELONGS_TO) {
        qb = knex(
          knex.raw(`?? as ??`, [
            parentBaseModel.getTnPath(parentModel.table_name),
            alias,
          ]),
        );
        qb.select(`${alias}.${parentColumn.column_name}`);

        await nestedConditionJoin({
          baseModelSqlv2: parentBaseModel,
          filter: {
            ...filter,
            ...(filter.comparison_op in negatedMapping
              ? negatedMapping[filter.comparison_op]
              : {}),
          },
          lookupColumn,
          qb,
          knex,
          alias,
          aliasCount,
          throwErrorIfInvalid,
          parseConditionV2,
        });

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.where((qb1) =>
              qb1
                .whereNotIn(childColumn.column_name, qb)
                .orWhereNull(childColumn.column_name),
            );
          else qbP.whereIn(childColumn.column_name, qb);
        };
      } else if (relationType === RelationTypes.MANY_TO_MANY) {
        const mmModel = await relationColumnOptions.getMMModel(mmContext);
        const mmParentColumn = await relationColumnOptions.getMMParentColumn(
          mmContext,
        );
        const mmChildColumn = await relationColumnOptions.getMMChildColumn(
          mmContext,
        );

        const mmBaseModel = await Model.getBaseModelSQL(mmContext, {
          model: mmModel,
          dbDriver: baseModelSqlv2.dbDriver,
        });

        const childAlias = `__nc${aliasCount.count++}`;

        qb = knex(
          knex.raw(`?? as ??`, [
            mmBaseModel.getTnPath(mmModel.table_name),
            alias,
          ]),
        )
          .select(`${alias}.${mmChildColumn.column_name}`)
          .join(
            knex.raw(`?? as ??`, [
              parentBaseModel.getTnPath(parentModel.table_name),
              childAlias,
            ]),
            `${alias}.${mmParentColumn.column_name}`,
            `${childAlias}.${parentColumn.column_name}`,
          );

        await nestedConditionJoin({
          baseModelSqlv2: parentBaseModel,
          filter: {
            ...filter,
            ...(filter.comparison_op in negatedMapping
              ? negatedMapping[filter.comparison_op]
              : {}),
          },
          lookupColumn,
          qb,
          knex,
          alias: childAlias,
          aliasCount,
          throwErrorIfInvalid,
          parseConditionV2,
        });

        return (qbP: Knex.QueryBuilder) => {
          if (filter.comparison_op in negatedMapping)
            qbP.where((qb1) =>
              qb1
                .whereNotIn(childColumn.column_name, qb)
                .orWhereNull(childColumn.column_name),
            );
          else qbP.whereIn(childColumn.column_name, qb);
        };
      }
    }
  }

  override async parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
      fieldHandler?: IFieldHandler;
    };
  }): Promise<{ value: any }> {
    // const lookupNestedCol = await params.baseModel.getNestedColumn(
    //   params.column,
    // );
    // if (lookupNestedCol) {
    //   return await params.options.fieldHandler.parseDbValue({
    //     ...params,
    //     value:
    //       params.row[lookupNestedCol.id] ??
    //       params.row[lookupNestedCol.column_name] ??
    //       params.row[lookupNestedCol.title],
    //     column: lookupNestedCol,
    //   });
    // }
    return {
      value: params.value,
    };
  }
}
