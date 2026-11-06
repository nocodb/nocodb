import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes } from './enums';
import {
  ColumnHelper,
  getRollupFormulaDisplayColumn,
} from '~/lib/columnHelper';
import UITypes from '../UITypes';
import type { ColumnType } from '~/lib/Api';
import type { ParsedFormulaNode } from './types';
import type { UnifiedMetaType } from '~/lib/types';

// Rollup-formula analogues of past Formula-field bugs: parsing, validation, display.

const col = (
  id: string,
  uidt: UITypes,
  dt: string
): UnifiedMetaType.IColumn => ({
  id,
  title: id,
  uidt,
  dt,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  fk_model_id: 'child',
});

const num = col('num', UITypes.Number, 'bigint');
const dec = col('dec', UITypes.Decimal, 'decimal');
const due = col('due', UITypes.Date, 'date');
const name = col('name', UITypes.SingleLineText, 'varchar');
const all = [num, dec, due, name];

const getMeta: UnifiedMetaType.IGetModel = async (_context, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  columns: all,
});

const validate = (formula: string, valuesColumn = num) =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: [],
    clientOrSqlUi: 'pg',
    getMeta,
    trackPosition: true,
    rollup: { valuesColumn, valuesColumns: all },
  });

// the text the grid / copy / export show for a rollup formula cell
const plain = (
  value: unknown,
  parsedTree: ParsedFormulaNode,
  meta: Record<string, unknown> = {}
) => {
  const rollup: ColumnType = {
    id: 'r1',
    uidt: UITypes.Rollup,
    meta,
    colOptions: { rollup_function: 'formula', parsed_tree: parsedTree },
  };
  return ColumnHelper.parsePlainCellValue(value, {
    col: rollup,
    meta: { title: 'T', columns: [] },
    metas: {},
  });
};

describe('rollup formula history: parsing', () => {
  // jsepCurlyHook, case-insensitive callees, jsepEqualsHook, string escapes
  it('accepts the syntax variants plain formulas accept', async () => {
    for (const [formula, target, dataType] of [
      ['SUM({values})', num, FormulaDataTypes.NUMERIC],
      ['round(sum(values) * 1.1, 1)', num, FormulaDataTypes.NUMERIC],
      ['SUM(\n\tvalues\n)  ', num, FormulaDataTypes.NUMERIC],
      ['OR(values = "a")', name, FormulaDataTypes.BOOLEAN],
      ['SUM(values) != 10', num, FormulaDataTypes.COND_EXP],
      ['1e3 * SUM(values)', num, FormulaDataTypes.NUMERIC],
      ['ARRAYJOIN(values, "\\"")', name, FormulaDataTypes.STRING],
      ["ARRAYJOIN(values, '{x}')", name, FormulaDataTypes.STRING],
      ['ARRAYJOIN(values, " 🚀 ")', name, FormulaDataTypes.STRING],
    ] as const) {
      expect((await validate(formula, target)).dataType).toBe(dataType);
    }
  });
});

describe('rollup formula history: validation', () => {
  // AND / OR / MAX / CONCAT are scalar functions too; inside an aggregate's
  // per-value expression they have no value set to aggregate
  it('accepts scalar AND / OR / MAX / CONCAT in a per-value expression', async () => {
    for (const [formula, target] of [
      ['SUM(IF(AND(values > 1, values < 4), 1, 0))', num],
      ['COUNTALL(IF(OR(values = 1, values = 2), 1, BLANK()))', num],
      ['SUM(MAX(values, 0))', num],
      ['ARRAYJOIN(CONCAT(values, "!"))', name],
    ] as const) {
      await expect(validate(formula, target)).resolves.toBeDefined();
    }
  });
});

describe('rollup formula history: display', () => {
  // The date-only MIN/MAX special case does not reach a date expression over
  // them: it renders as a date-time and shifts a day west of UTC. The text
  // check needs a negative offset to fail: run with TZ=America/New_York.
  it('keeps the day of a date computed from a date field in any timezone', async () => {
    const tree = await validate('DATEADD(MAX(values), 1, "day")', due);
    expect(
      getRollupFormulaDisplayColumn({
        id: 'r1',
        uidt: UITypes.Rollup,
        meta: {},
        colOptions: { rollup_function: 'formula', parsed_tree: tree },
      }).uidt
    ).toBe(UITypes.Date);
    // as the API returns it (date-time rewrite of a pg timestamp)
    expect(plain('2024-03-11 00:00:00+00:00', tree)).toMatch(/^2024-03-11/);
  });

  // e2112eb17e3 / 4068ea494d2: pg IEEE values show as the Formula cell shows them
  it('shows a non-finite numeric result as Infinity / NaN', async () => {
    const tree = await validate('ROUND(SUM(values), 2)', dec);
    expect(plain('Infinity', tree)).toBe('Infinity');
    expect(plain('NaN', tree)).toBe('NaN');
  });

  it('does not round away the places a formula asked for', async () => {
    const tree = await validate('ROUND(AVERAGE(values), 3)');
    expect(plain(3.333, tree)).toBe('3.333');
    // a precision set on the field wins
    expect(plain(3.333, tree, { precision: 1 })).toBe('3.3');
    // whole-number arithmetic over counts stays whole
    expect(plain(6, await validate('COUNTALL(values) * 2'))).toBe('6');
    expect(plain(4, await validate('ROUND(AVERAGE(values))'))).toBe('4');
  });

  it('shows an errored cell as ERR! and a negative zero as 0', async () => {
    const tree = await validate('ROUND(SUM(values), 2)', dec);
    expect(plain('_____NC_ERROR_____', tree)).toBe('ERR!');
    expect(plain(-0, tree)).toBe('0.00');
  });
});
