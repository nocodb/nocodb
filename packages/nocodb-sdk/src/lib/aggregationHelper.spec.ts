import {
  DateAggregations,
  getColumnAggregations,
  isDateValuedAggregation,
  NumericalAggregations,
} from './aggregationHelper';
import { FormulaDataTypes } from './formula/enums';
import UITypes from './UITypes';

describe('getColumnAggregations', () => {
  it('offers date aggregations, not numeric ones, for a date rollup', () => {
    const aggs = getColumnAggregations({
      uidt: UITypes.Rollup,
      colOptions: { result_uidt: UITypes.Date },
    });

    expect(aggs).toContain(DateAggregations.LatestDate);
    expect(aggs).not.toContain(NumericalAggregations.Sum);
  });

  it('offers numeric aggregations for a numeric rollup', () => {
    const aggs = getColumnAggregations({
      uidt: UITypes.Rollup,
      colOptions: {},
    });

    expect(aggs).toContain(NumericalAggregations.Sum);
    expect(aggs).not.toContain(DateAggregations.LatestDate);
  });

  it('reads a formula result type from its parsed tree', () => {
    const aggs = getColumnAggregations({
      uidt: UITypes.Formula,
      colOptions: { parsed_tree: { dataType: FormulaDataTypes.NUMERIC } },
    });

    expect(aggs).toContain(NumericalAggregations.Sum);
  });
});

describe('isDateValuedAggregation', () => {
  const dateRollup = {
    uidt: UITypes.Rollup,
    colOptions: { result_uidt: UITypes.Date },
  };

  it('flags earliest/latest and a legacy max on a date rollup', () => {
    expect(isDateValuedAggregation(dateRollup, 'latest_date')).toBe(true);
    expect(isDateValuedAggregation(dateRollup, 'max')).toBe(true);
  });

  it('leaves numeric results alone', () => {
    expect(isDateValuedAggregation(dateRollup, 'date_range')).toBe(false);
    expect(
      isDateValuedAggregation({ uidt: UITypes.Number, colOptions: {} }, 'max')
    ).toBe(false);
  });
});
