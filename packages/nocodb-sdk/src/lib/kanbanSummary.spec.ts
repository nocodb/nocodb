import {
  getKanbanSummaryColor,
  getKanbanSummaryFunctions,
  isKanbanSummaryFnValid,
  isKanbanSummaryFnSafeWhenHidden,
  KANBAN_SUMMARY_COUNT,
  kanbanSummaryFromView,
  kanbanSummarySupportsColors,
  kanbanSummaryToView,
} from './kanbanSummary';
import UITypes from './UITypes';

describe('isKanbanSummaryFnValid', () => {
  it('accepts count with or without a field', () => {
    expect(isKanbanSummaryFnValid(KANBAN_SUMMARY_COUNT)).toBe(true);
    expect(
      isKanbanSummaryFnValid(KANBAN_SUMMARY_COUNT, { uidt: UITypes.Number })
    ).toBe(true);
  });

  it('accepts numeric functions only on numeric fields', () => {
    expect(isKanbanSummaryFnValid('sum', { uidt: UITypes.Number })).toBe(true);
    expect(isKanbanSummaryFnValid('sum', { uidt: UITypes.Currency })).toBe(
      true
    );
    expect(
      isKanbanSummaryFnValid('sum', { uidt: UITypes.SingleLineText })
    ).toBe(false);
  });

  it('rejects a missing function or field', () => {
    expect(isKanbanSummaryFnValid(null, { uidt: UITypes.Number })).toBe(false);
    expect(isKanbanSummaryFnValid('sum', undefined)).toBe(false);
  });

  it('never offers None', () => {
    expect(getKanbanSummaryFunctions({ uidt: UITypes.Number })).not.toContain(
      'none'
    );
  });
});

describe('kanbanSummarySupportsColors', () => {
  it('allows colours for count and numeric results', () => {
    expect(kanbanSummarySupportsColors(KANBAN_SUMMARY_COUNT)).toBe(true);
    expect(kanbanSummarySupportsColors('sum', { uidt: UITypes.Number })).toBe(
      true
    );
  });

  it('refuses colours for a date-valued result', () => {
    expect(
      kanbanSummarySupportsColors('earliest_date', { uidt: UITypes.Date })
    ).toBe(false);
  });
});

describe('getKanbanSummaryColor', () => {
  const colors = {
    rules: [
      {
        id: 'a',
        color: 'green',
        conditions: [{ op: 'gte' as const, value: 100 }],
      },
      {
        id: 'b',
        color: 'yellow',
        conditions: [{ op: 'gt' as const, value: 10 }],
      },
    ],
    default_color: 'gray',
  };

  it('returns the first matching rule', () => {
    expect(getKanbanSummaryColor(150, colors)).toBe('green');
    expect(getKanbanSummaryColor(100, colors)).toBe('green');
    expect(getKanbanSummaryColor(50, colors)).toBe('yellow');
  });

  it('falls back to the default colour', () => {
    expect(getKanbanSummaryColor(5, colors)).toBe('gray');
    expect(getKanbanSummaryColor(null, colors)).toBe('gray');
  });

  it('reads numeric strings the database returns', () => {
    expect(getKanbanSummaryColor('120.5', colors)).toBe('green');
  });

  it('skips rules with no value or no conditions', () => {
    expect(
      getKanbanSummaryColor(1, {
        rules: [
          { id: 'x', color: 'red', conditions: [{ op: 'eq', value: null }] },
        ],
      })
    ).toBe(null);
    expect(
      getKanbanSummaryColor(1, {
        rules: [{ id: 'y', color: 'red', conditions: [] }],
      })
    ).toBe(null);
  });

  it('requires every condition of a rule to match', () => {
    const between = {
      rules: [
        {
          id: 'mid',
          color: 'yellow',
          conditions: [
            { op: 'gte' as const, value: 10 },
            { op: 'lt' as const, value: 100 },
          ],
        },
      ],
    };
    expect(getKanbanSummaryColor(50, between)).toBe('yellow');
    expect(getKanbanSummaryColor(150, between)).toBe(null);
    expect(getKanbanSummaryColor(5, between)).toBe(null);
  });

  it('handles every operator', () => {
    const rule = (op: any) => ({
      rules: [{ id: 'r', color: 'red', conditions: [{ op, value: 10 }] }],
    });
    expect(getKanbanSummaryColor(10, rule('eq'))).toBe('red');
    expect(getKanbanSummaryColor(11, rule('neq'))).toBe('red');
    expect(getKanbanSummaryColor(9, rule('lt'))).toBe('red');
    expect(getKanbanSummaryColor(10, rule('lte'))).toBe('red');
    expect(getKanbanSummaryColor(10, rule('lt'))).toBe(null);
  });

  it('returns null without colours', () => {
    expect(getKanbanSummaryColor(10, null)).toBe(null);
  });
});

describe('kanbanSummaryToView / kanbanSummaryFromView', () => {
  it('round-trips a summary through the view columns', () => {
    const summary = {
      fn: 'sum',
      fk_column_id: 'cl_1',
      label: { mode: 'custom' as const, text: 'Pipeline' },
      colors: { rules: [], default_color: 'red' },
    };
    const row = kanbanSummaryToView(summary);
    expect(row.summary_fn).toBe('sum');
    expect(typeof row.summary_label).toBe('string');
    expect(kanbanSummaryFromView(row)).toEqual(summary);
  });

  it('clears all four columns when unset', () => {
    expect(kanbanSummaryToView(null)).toEqual({
      summary_fn: null,
      fk_summary_col_id: null,
      summary_label: null,
      summary_colors: null,
    });
    expect(kanbanSummaryFromView({ summary_fn: null })).toBe(null);
  });

  it('drops the field for count', () => {
    const row = kanbanSummaryToView({
      fn: KANBAN_SUMMARY_COUNT,
      fk_column_id: 'cl_1',
    });
    expect(row.fk_summary_col_id).toBe(null);
    expect(
      kanbanSummaryFromView({ summary_fn: 'count', fk_summary_col_id: 'cl_1' })
        ?.fk_column_id
    ).toBe(null);
  });

  it('drops empty colours', () => {
    expect(
      kanbanSummaryToView({
        fn: 'sum',
        fk_column_id: 'c',
        colors: { rules: [] },
      }).summary_colors
    ).toBe(null);
  });

  it('reads already-parsed JSON objects', () => {
    expect(
      kanbanSummaryFromView({
        summary_fn: 'sum',
        fk_summary_col_id: 'c',
        summary_label: { mode: 'none' },
      })?.label
    ).toEqual({ mode: 'none' });
  });

  it('drops a malformed label and colours', () => {
    const summary = kanbanSummaryFromView({
      summary_fn: 'sum',
      fk_summary_col_id: 'c',
      summary_label: JSON.stringify({ mode: 'bogus', text: 'x' }),
      summary_colors: JSON.stringify({ rules: 'nope' }),
    });
    expect(summary?.label).toBe(null);
    expect(summary?.colors).toBe(null);
  });

  it('keeps only the documented colour shape', () => {
    const summary = kanbanSummaryFromView({
      summary_fn: 'sum',
      fk_summary_col_id: 'c',
      summary_label: { mode: 'custom', text: 'a'.repeat(5000) },
      summary_colors: {
        rules: [
          'junk',
          {
            id: 1,
            color: 'red',
            conditions: [
              { op: 'gt', value: 5 },
              { op: 'drop', value: 1 },
              { op: 'lt', value: '3' },
            ],
          },
        ],
        default_color: 7,
      },
    });
    expect(summary?.label?.text).toHaveLength(255);
    expect(summary?.colors).toEqual({
      rules: [
        {
          id: '1',
          color: 'red',
          conditions: [
            { op: 'gt', value: 5 },
            { op: 'lt', value: null },
          ],
        },
      ],
      default_color: null,
    });
  });
});

describe('isKanbanSummaryFnSafeWhenHidden', () => {
  it('allows functions that combine many records', () => {
    for (const fn of [
      'sum',
      'avg',
      'std_dev',
      'count',
      'count_filled',
      'percent_empty',
      'checked',
      'attachment_size',
    ]) {
      expect(isKanbanSummaryFnSafeWhenHidden(fn)).toBe(true);
    }
  });

  it('refuses functions that return one record value', () => {
    for (const fn of [
      'min',
      'max',
      'median',
      'range',
      'earliest_date',
      'latest_date',
      'date_range',
      'month_range',
      'none',
      'some_future_aggregation',
    ]) {
      expect(isKanbanSummaryFnSafeWhenHidden(fn)).toBe(false);
    }
    expect(isKanbanSummaryFnSafeWhenHidden(null)).toBe(false);
  });
});
