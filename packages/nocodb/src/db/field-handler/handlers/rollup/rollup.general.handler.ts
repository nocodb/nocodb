import { getRollupResultUidt, isBtLikeV2Junction, UITypes } from 'nocodb-sdk';
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

    const rollupOptions = await column.getColOptions<RollupColumn>();
    const builder = (
      await genRollupSelectv2({
        baseModelSqlv2,
        knex,
        alias,
        columnOptions: rollupOptions,
      })
    ).builder;

    // a rollup with a resolved result type filters as that type
    const resultUidt = getRollupResultUidt({
      uidt: column.uidt,
      colOptions: rollupOptions,
    });
    if (resultUidt) {
      // parenthesised: `IS NULL` and friends splice a bare query builder unwrapped
      const expression = knex.raw('(?)', [builder]);
      if (
        [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.Checkbox,
          UITypes.Number,
          UITypes.Decimal,
        ].includes(resultUidt)
      ) {
        // a computed expression has no column affinity: SQLite compares a
        // number with the text '10' as text, so numeric values go in as numbers
        const isNumeric = [UITypes.Number, UITypes.Decimal].includes(
          resultUidt,
        );
        const value =
          isNumeric &&
          typeof filter.value === 'string' &&
          filter.value.trim() !== '' &&
          !isNaN(+filter.value)
            ? +filter.value
            : filter.value;
        return options.fieldHandler.applyFilter(
          value === filter.value
            ? filter
            : new Filter({ ...filter, value } as Partial<Filter>),
          setModelContext(
            new Column({ ...column, uidt: resultUidt } as ColumnType),
            column.context,
          ),
          { ...options, customWhereClause: expression as any },
        );
      }
      if (resultUidt === UITypes.SingleLineText) {
        return parseConditionV2(
          baseModelSqlv2,
          new Filter({
            ...filter,
            // an empty like/nlike matches on '' (a NULL pattern matches nothing)
            value: knex.raw('?', [
              filter.value ??
                (['like', 'nlike'].includes(filter.comparison_op) ? '' : null),
            ]),
          } as any),
          aliasCount,
          alias,
          expression as any,
        );
      }
    }

    // a plain numeric rollup: these ops build SQL the generic path can't take
    // a subquery for (pg: syntax error on neq, type mismatch on blank)
    if (
      column.uidt === UITypes.Rollup &&
      !['min', 'max'].includes(rollupOptions.rollup_function) &&
      ['neq', 'not', 'blank', 'notblank', 'empty', 'notempty'].includes(
        filter.comparison_op,
      )
    ) {
      const value =
        typeof filter.value === 'string' &&
        filter.value.trim() !== '' &&
        !isNaN(+filter.value)
          ? +filter.value
          : filter.value;
      return options.fieldHandler.applyFilter(
        new Filter({ ...filter, value } as Partial<Filter>),
        setModelContext(
          new Column({ ...column, uidt: UITypes.Decimal } as ColumnType),
          column.context,
        ),
        { ...options, customWhereClause: knex.raw('(?)', [builder]) as any },
      );
    }

    return parseConditionV2(
      baseModelSqlv2,
      new Filter({
        ...filter,
        value: knex.raw('?', [
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
    const resultUidt = getRollupResultUidt({
      uidt: column.uidt,
      colOptions: await column.getColOptions<RollupColumn>(),
    });
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
