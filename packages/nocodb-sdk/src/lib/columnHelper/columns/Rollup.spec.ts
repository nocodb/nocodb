import {
  formatAggregation,
  NumericalAggregations,
} from '~/lib/aggregationHelper';
import { ColumnHelper } from '~/lib/columnHelper';
import UITypes from '~/lib/UITypes';
import {
  ColumnType,
  LinkToAnotherRecordType,
  RollupType,
  TableType,
} from '~/lib/Api';

// NOTE: these tests exercise the rollup formatting path through `ColumnHelper`
// and `formatAggregation` (the grid-footer entry point) rather than importing
// `RollupHelper` directly. Importing `./Rollup` first would start a circular
// import (Rollup -> column-helper -> columns barrel -> Rollup) and leave the
// helper registry's Rollup entry undefined, which is a test-only artifact.

describe('RollupHelper currency formatting', () => {
  const makeCurrencyChild = (): ColumnType =>
    ({
      id: 'child_amount',
      uidt: UITypes.Currency,
      meta: { currency_locale: 'en-US', currency_code: 'USD' },
    } as ColumnType);

  // Builds params for a SUM rollup of a Currency child column, either same-base
  // or cross-base (related table lives in a different base, keyed by its own base).
  const buildParams = ({ crossBase }: { crossBase: boolean }) => {
    const currencyChild = makeCurrencyChild();
    const rollupColumn = {
      id: 'rollup1',
      uidt: UITypes.Rollup,
      meta: {},
      colOptions: {
        fk_relation_column_id: 'rel_col1',
        fk_rollup_column_id: 'child_amount',
        rollup_function: 'sum',
      } as RollupType,
    } as ColumnType;

    const relationColumn = {
      id: 'rel_col1',
      uidt: UITypes.LinkToAnotherRecord,
      colOptions: {
        type: 'hm',
        fk_related_model_id: 'related_table_id',
        ...(crossBase ? { fk_related_base_id: 'base2' } : {}),
      } as LinkToAnotherRecordType,
    } as ColumnType;

    const meta = {
      id: 'table1',
      base_id: 'base1',
      columns: [rollupColumn, relationColumn],
    } as TableType;

    const relatedBaseId = crossBase ? 'base2' : 'base1';
    const relatedMeta = {
      id: 'related_table_id',
      base_id: relatedBaseId,
      columns: [currencyChild],
    } as TableType;

    return {
      col: rollupColumn,
      meta,
      // The related table is only present under its OWN base composite key.
      metas: { [`${relatedBaseId}:related_table_id`]: relatedMeta },
    } as any;
  };

  describe('parsePlainCellValue', () => {
    it('formats a same-base currency rollup as currency', () => {
      const params = buildParams({ crossBase: false });

      const expected = ColumnHelper.parseValue(1300.49, {
        ...params,
        col: makeCurrencyChild(),
      });

      expect(
        ColumnHelper.parsePlainCellValue(1300.49, {
          ...params,
          isAggregation: true,
        })
      ).toBe(expected);
    });

    it('formats a cross-base currency rollup as currency (resolves child via fk_related_base_id)', () => {
      const params = buildParams({ crossBase: true });

      const expected = ColumnHelper.parseValue(1300.49, {
        ...params,
        col: makeCurrencyChild(),
      });

      // Regression guard: a cross-base rollup previously dropped the currency
      // format in aggregations because the child column was resolved using the
      // rollup table's base_id instead of the relation's fk_related_base_id.
      expect(
        ColumnHelper.parsePlainCellValue(1300.49, {
          ...params,
          isAggregation: true,
        })
      ).toBe(expected);
    });
  });

  describe('formatAggregation (grid footer)', () => {
    it('formats the Sum aggregation of a same-base currency rollup as currency', () => {
      const params = buildParams({ crossBase: false });

      const result = formatAggregation(
        NumericalAggregations.Sum,
        1300.49,
        params.col,
        params
      );

      expect(result).toBe('$1,300.49');
    });

    it('formats the Sum aggregation of a cross-base currency rollup as currency', () => {
      const params = buildParams({ crossBase: true });

      const result = formatAggregation(
        NumericalAggregations.Sum,
        1300.49,
        params.col,
        params
      );

      expect(result).toContain('$');
      expect(result).toBe('$1,300.49');
    });
  });
});
