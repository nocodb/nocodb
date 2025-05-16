import { RelationTypes } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { Logger } from '@nestjs/common';
import type { NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Column, LinkToAnotherRecordColumn, LookupColumn } from '~/models';
import type {
  HandlerOptions,
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

export class LookupGeneralHandler extends ComputedFieldHandler {
  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: HandlerOptions,
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
    const lookupColumn = await colOptions.getLookupColumn(context);
    const alias = getAlias(aliasCount);
    let qb;
    {
      const childColumn = await relationColumnOptions.getChildColumn(context);
      const parentColumn = await relationColumnOptions.getParentColumn(context);
      const childModel = await childColumn.getModel(context);
      await childModel.getColumns(context);
      const parentModel = await parentColumn.getModel(context);
      await parentModel.getColumns(context);

      let relationType = relationColumnOptions.type;

      if (relationType === RelationTypes.ONE_TO_ONE) {
        relationType = relationColumn.meta?.bt
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      }

      if (relationType === RelationTypes.HAS_MANY) {
        qb = knex(
          knex.raw(`?? as ??`, [
            baseModelSqlv2.getTnPath(childModel.table_name),
            alias,
          ]),
        );

        qb.select(`${alias}.${childColumn.column_name}`);

        await nestedConditionJoin({
          baseModelSqlv2,
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
            baseModelSqlv2.getTnPath(parentModel.table_name),
            alias,
          ]),
        );
        qb.select(`${alias}.${parentColumn.column_name}`);

        await nestedConditionJoin({
          baseModelSqlv2,
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
        const mmModel = await relationColumnOptions.getMMModel(context);
        const mmParentColumn = await relationColumnOptions.getMMParentColumn(
          context,
        );
        const mmChildColumn = await relationColumnOptions.getMMChildColumn(
          context,
        );

        const childAlias = `__nc${aliasCount.count++}`;

        qb = knex(
          knex.raw(`?? as ??`, [
            baseModelSqlv2.getTnPath(mmModel.table_name),
            alias,
          ]),
        )
          .select(`${alias}.${mmChildColumn.column_name}`)
          .join(
            knex.raw(`?? as ??`, [
              baseModelSqlv2.getTnPath(parentModel.table_name),
              childAlias,
            ]),
            `${alias}.${mmParentColumn.column_name}`,
            `${childAlias}.${parentColumn.column_name}`,
          );

        await nestedConditionJoin({
          baseModelSqlv2,
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
