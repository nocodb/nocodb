import { isBtLikeV2Junction, UITypes } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type {
  FilterOptions,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import type { Column, RollupColumn } from '~/models';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { Filter } from '~/models';

export class RollupGeneralHandler extends ComputedFieldHandler {
  /**
   * Sort by the computed rollup expression. The V2 MO/OO `Links` junction
   * shape is single-record (BT-like) — for those we sort by the linked
   * display value via `generateLookupSelectQuery` so the rendered text
   * orders correctly. All other rollups use the standard rollup builder.
   */
  override async applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options: SortOptions,
  ): Promise<void> {
    const { alias, nulls, baseModel: baseModelSqlv2, context } = options;
    const knex = options.knex as CustomKnex;
    const model = await column.getModel(context);

    if (column.uidt === UITypes.Links && isBtLikeV2Junction(column)) {
      const selectQb = await generateLookupSelectQuery({
        baseModelSqlv2,
        column,
        alias,
        model,
      });
      qb.orderBy(selectQb?.builder, direction, nulls);
      return;
    }

    const builder = (
      await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        columnOptions: (await column.getColOptions(context)) as RollupColumn,
        alias,
      })
    ).builder;
    qb.orderBy(builder, direction, nulls);
  }

  override async filter(
    knex: CustomKnex,
    filter: Filter,
    column: Column,
    options: FilterOptions,
  ) {
    const {
      baseModel: baseModelSqlv2,
      depth: aliasCount,
      conditionParser: parseConditionV2,
      alias,
    } = options;

    const context = baseModelSqlv2.context;

    const builder = (
      await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        alias,
        columnOptions: (await column.getColOptions(context)) as RollupColumn,
      })
    ).builder;
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value: knex.raw('?', [
          // convert value to number for rollup since rollup is always number
          isNaN(+filter.value) ? filter.value : +filter.value,
        ]),
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }
}
