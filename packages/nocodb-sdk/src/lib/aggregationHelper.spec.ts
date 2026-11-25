import {
  CommonAggregations,
  DateAggregations,
  formatAggregation,
  getColumnAggregations,
  isDateValuedAggregation,
  isFieldFormattedAggregation,
  NumericalAggregations,
} from './aggregationHelper';
import { getColumnDisplayTimezone } from './dateTimeHelper';
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

describe('isFieldFormattedAggregation', () => {
  it('is true for a numeric function on a number-formatted field', () => {
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Decimal },
        NumericalAggregations.Sum
      )
    ).toBe(true);
  });

  it('is false for a count on a number-formatted field', () => {
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Number },
        CommonAggregations.CountFilled
      )
    ).toBe(false);
  });

  it('is false for a numeric function on Links or Rating', () => {
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Links },
        NumericalAggregations.Sum
      )
    ).toBe(false);
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Rating },
        NumericalAggregations.Max
      )
    ).toBe(false);
  });

  it('follows a formula display type', () => {
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Formula },
        NumericalAggregations.Sum
      )
    ).toBe(false);
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Formula, meta: { display_type: UITypes.Currency } },
        NumericalAggregations.Sum
      )
    ).toBe(true);
  });

  it('is false for min/max on a date rollup (they run as earliest/latest)', () => {
    expect(
      isFieldFormattedAggregation(
        { uidt: UITypes.Rollup, colOptions: { result_uidt: UITypes.Date } },
        NumericalAggregations.Min
      )
    ).toBe(false);
  });
});

describe('formatAggregation latest date', () => {
  const col = {
    uidt: UITypes.DateTime,
    meta: { date_format: 'YYYY-MM-DD', time_format: 'HH:mm' },
  };
  const latest = (value: string, timezone?: string) =>
    formatAggregation(DateAggregations.LatestDate, value, col, undefined, {
      timezone,
    });

  it('formats in the given timezone', () => {
    expect(latest('2026-03-10T22:30:00.000Z', 'Asia/Kolkata')).toBe(
      '2026-03-11 04:00'
    );
  });

  it('reads an offset-less DB value as UTC', () => {
    expect(latest('2026-03-10 22:30:00', 'Asia/Kolkata')).toBe(
      '2026-03-11 04:00'
    );
    expect(latest('2026-03-10 22:30:00+00', 'America/New_York')).toBe(
      '2026-03-10 18:30'
    );
  });
});

describe('formatAggregation date and month range', () => {
  const col = { uidt: UITypes.Date };
  const range = (value: unknown) =>
    formatAggregation(DateAggregations.DateRange, value, col);
  const months = (value: unknown) =>
    formatAggregation(DateAggregations.MonthRange, value, col);

  it('uses the singular unit for a range of one', () => {
    expect(range(1)).toBe('1 day');
    expect(months(1)).toBe('1 month');
    // a numeric database result can arrive as a string
    expect(months('1')).toBe('1 month');
  });

  it('keeps the plural unit for every other range', () => {
    expect(range(0)).toBe('0 days');
    expect(range(30)).toBe('30 days');
    expect(months(0)).toBe('0 months');
    expect(months('12')).toBe('12 months');
  });

  it('shows an empty range as zero', () => {
    expect(range(null)).toBe('0 days');
    expect(months(undefined)).toBe('0 months');
  });
});

describe('getColumnDisplayTimezone', () => {
  it("uses a DateTime column's timezone", () => {
    expect(
      getColumnDisplayTimezone({
        uidt: UITypes.DateTime,
        meta: { timezone: 'Asia/Kolkata' },
      })
    ).toBe('Asia/Kolkata');
  });

  it('needs display timezone on for a DateTime formula, like the grid', () => {
    const formula = (isDisplayTimezone: boolean) => ({
      uidt: UITypes.Formula,
      meta: {
        display_type: UITypes.DateTime,
        display_column_meta: {
          meta: { timezone: 'Asia/Kolkata', isDisplayTimezone },
        },
      },
    });
    expect(getColumnDisplayTimezone(formula(false))).toBeUndefined();
    expect(getColumnDisplayTimezone(formula(true))).toBe('Asia/Kolkata');
  });
});
