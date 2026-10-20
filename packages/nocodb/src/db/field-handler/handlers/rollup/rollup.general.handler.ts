import { isBtLikeV2Junction, UITypes } from 'nocodb-sdk';
import { ComputedFieldHandler } from '../computed';
import type { ColumnType } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type {
  FilterOptions,
  FilterVerificationResult,
  SortOptions,
} from '~/db/field-handler/field-handler.interface';
import type { RollupColumn } from '~/models';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';
import { Column, Filter } from '~/models';
import { setModelContext } from '~/helpers/modelContext';

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
    const { alias, nulls, baseModel: baseModelSqlv2 } = options;
    const knex = options.knex as CustomKnex;
    const model = await column.getModel();

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
        columnOptions: (await column.getColOptions()) as RollupColumn,
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

    const columnOptions = (await column.getColOptions()) as RollupColumn;
    const builder = (
      await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        alias,
        columnOptions,
      })
    ).builder;
    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        // a date result keeps its value for the date handler to parse
        value: columnOptions?.result_uidt
          ? filter.value
          : filter.comparison_op === 'in'
          ? // numbers, not strings: SQLite never matches a count/sum to '2'
            (Array.isArray(filter.value)
              ? filter.value
              : `${filter.value ?? ''}`.split(',')
            ).map((v) => (v !== '' && !isNaN(+v) ? +v : v))
          : knex.raw('?', [
              // convert value to number for a numeric rollup
              isNaN(+filter.value) ? filter.value : +filter.value,
            ]),
      } as any),
      aliasCount,
      alias,
      builder,
    );
  }

  override async verifyFilter(
    filter: Filter,
    column: Column,
    options: FilterOptions = {},
  ): Promise<FilterVerificationResult> {
    const resultUidt = (await column.getColOptions<RollupColumn>())
      ?.result_uidt;
    if (!resultUidt || !options.fieldHandler) {
      return super.verifyFilter(filter, column);
    }
    return options.fieldHandler.verifyFilter(
      filter,
      setModelContext(
        new Column({ ...column, uidt: resultUidt } as ColumnType),
        column.context,
      ),
      options,
    );
  }
}
