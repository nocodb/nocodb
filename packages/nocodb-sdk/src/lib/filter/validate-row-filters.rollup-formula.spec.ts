import { validateRowFilters } from './validate-row-filters';
import UITypes from '../UITypes';
import { FormulaDataTypes } from '../formula/enums';
import { ColumnType, FilterType } from '~/lib/Api';

// Row colouring evaluates these conditions in the browser on raw cell values,
// whose shape differs by database (pg booleans vs 1/0, decimals as strings).
const rollup = (
  dataType: FormulaDataTypes,
  extra: Record<string, unknown> = {}
): ColumnType => ({
  id: 'r1',
  title: 'R',
  uidt: UITypes.Rollup,
  colOptions: {
    rollup_function: 'formula',
    parsed_tree: { type: 'CallExpression', dataType, ...extra },
  },
});

type Op = FilterType['comparison_op'];

const matches = (
  column: ColumnType,
  value: unknown,
  filter: FilterType,
  client = 'pg'
) =>
  validateRowFilters({
    filters: [{ fk_column_id: 'r1', logical_op: 'and', ...filter }],
    data: { R: value },
    columns: [column],
    client,
    metas: {},
    options: { timezone: 'UTC' },
  });

describe('row colouring on formula rollups', () => {
  const numeric = rollup(FormulaDataTypes.NUMERIC);
  const bool = rollup(FormulaDataTypes.BOOLEAN);
  const text = rollup(FormulaDataTypes.STRING);
  const date = rollup(FormulaDataTypes.DATE);

  it.each<[unknown, Op, string | undefined, boolean]>([
    ['60.50', 'eq', '60.5', true],
    [60.5, 'eq', '60.5', true],
    ['60.50', 'neq', '60.5', false],
    ['60.50', 'gt', '10', true],
    ['60.50', 'lte', '60.5', true],
    ['0.00', 'eq', '0', true],
    [null, 'blank', undefined, true],
    ['0.00', 'notblank', undefined, true],
  ])('numeric %p %s %p → %p', (value, op, filterValue, expected) => {
    expect(
      matches(numeric, value, { comparison_op: op, value: filterValue })
    ).toBe(expected);
  });

  it.each<[unknown, Op, boolean]>([
    [true, 'checked', true],
    [false, 'checked', false],
    [1, 'checked', true],
    [0, 'checked', false],
    ['1', 'checked', true],
    ['0', 'checked', false],
    [false, 'notchecked', true],
    [0, 'notchecked', true],
    ['0', 'notchecked', true],
    [null, 'notchecked', true],
  ])('checkbox %p %s → %p', (value, op, expected) => {
    expect(matches(bool, value, { comparison_op: op })).toBe(expected);
  });

  it.each<[unknown, Op, string | undefined, boolean]>([
    ['A, B', 'like', 'b', true],
    ['A, B', 'eq', 'A, B', true],
    ['A, B', 'nlike', 'z', true],
    [null, 'blank', undefined, true],
    ['', 'blank', undefined, true],
  ])('text %p %s %p → %p', (value, op, filterValue, expected) => {
    expect(
      matches(text, value, { comparison_op: op, value: filterValue })
    ).toBe(expected);
  });

  it.each<[unknown, Op, string, boolean]>([
    ['2024-01-05', 'eq', '2024-01-05', true],
    ['2024-01-05T00:00:00.000Z', 'eq', '2024-01-05', true],
    ['2024-01-05 10:00:00+00:00', 'gt', '2024-01-01', true],
    ['2024-01-05', 'lt', '2024-01-01', false],
  ])('date %p %s %p → %p', (value, op, filterValue, expected) => {
    expect(
      matches(date, value, {
        comparison_op: op,
        comparison_sub_op: 'exactDate',
        value: filterValue,
      })
    ).toBe(expected);
  });

  it('treats a whole-number result as a number', () => {
    const count = rollup(FormulaDataTypes.NUMERIC, {
      rollupAggregate: 'COUNTALL',
    });
    expect(matches(count, '3', { comparison_op: 'eq', value: '3' })).toBe(true);
    expect(matches(count, 3, { comparison_op: 'gte', value: '2' })).toBe(true);
  });
});
