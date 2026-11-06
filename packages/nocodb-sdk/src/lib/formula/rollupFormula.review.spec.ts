import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { JSEPNode } from './enums';
import UITypes from '../UITypes';
import { getRollupResultUidt } from './rollupFormula';
import type { ParsedFormulaNode } from './types';
import type { UnifiedMetaType } from '~/lib/types';

// Review of the per-value scope rule (scalar AND / OR / XOR / MIN / MAX / CONCAT
// inside an aggregate's argument).

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
const name = col('name', UITypes.SingleLineText, 'varchar');
const all = [num, name];

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

// AGG:X = aggregates over values, MOD:X = value-set modifier, X = scalar call
const shape = (node: ParsedFormulaNode): string => {
  switch (node?.type) {
    case JSEPNode.CALL_EXP: {
      const tag = node.rollupAggregate
        ? 'AGG:'
        : node.rollupModifier
        ? 'MOD:'
        : '';
      return `${tag}${node.callee.name.toUpperCase()}(${(node.arguments ?? [])
        .map(shape)
        .join(', ')})`;
    }
    case JSEPNode.BINARY_EXP:
      return `(${shape(node.left)} ${node.operator} ${shape(node.right)})`;
    case JSEPNode.UNARY_EXP:
      return `${node.operator}${shape(node.argument)}`;
    case JSEPNode.IDENTIFIER:
      return node.name;
    case JSEPNode.LITERAL:
      return String(node.raw ?? node.value);
    default:
      return String(node?.type);
  }
};

describe('rollup formula review: per-value scope', () => {
  // The extra arguments of a variadic SUM / CONCATENATE are split out to the
  // outer scope (SUM(values, x) → ADD(SUM(values), x)), where MAX(values)
  // aggregates. splitVariadicAggregate reads them per-value instead, so they
  // count as a second value set. Valid before f12822a98f0.
  it('splits SUM / CONCATENATE with another aggregate as an extra argument', async () => {
    expect(shape(await validate('SUM(values, MAX(values))'))).toBe(
      'ADD(AGG:SUM(values), AGG:MAX(values))'
    );
    expect(shape(await validate('SUM(values * 2, MIN(values))'))).toBe(
      'ADD(AGG:SUM((values * 2)), AGG:MIN(values))'
    );
    expect(
      shape(await validate('CONCATENATE(values, "-", MAX(values))', name))
    ).toBe('CONCAT(AGG:CONCATENATE(values), "-", AGG:MAX(values))');
  });

  // CONCAT is the same aggregate as CONCATENATE, and accepts this formula
  it('treats CONCAT and CONCATENATE alike', async () => {
    await expect(
      validate('CONCAT(values, MAX(values))', name)
    ).resolves.toBeDefined();
    await expect(
      validate('CONCATENATE(values, MAX(values))', name)
    ).resolves.toBeDefined();
  });

  // COUNTA / COUNT / COUNTALL / AVG / ARRAYUNIQUE are scalar formula functions
  // too. Before f12822a98f0 (and in Airtable) COUNTA(MAX(values)) is the scalar
  // COUNTA of one aggregate — 1. It now aggregates MAX(values) per value: the
  // number of values. A saved formula changes meaning once re-validated.
  it('keeps a scalar count / average of an aggregate', async () => {
    const cases = [
      ['COUNTA(MAX(values))', 'COUNTA(AGG:MAX(values))'],
      ['COUNT(MIN(values))', 'COUNT(AGG:MIN(values))'],
      ['COUNTALL(MAX(values))', 'COUNTALL(AGG:MAX(values))'],
      ['AVG(MAX(values))', 'AVG(AGG:MAX(values))'],
      ['AVG(MAX(values), 10)', 'AVG(AGG:MAX(values), 10)'],
    ] as const;
    const actual: string[] = [];
    for (const [formula] of cases) {
      actual.push(
        `${formula} => ${await validate(formula).then(
          shape,
          (e: Error) => e.message
        )}`
      );
    }
    expect(actual).toEqual(cases.map(([f, expected]) => `${f} => ${expected}`));
  });

  // the scalar reading is invalid (OR aggregates twice), so COUNTALL aggregates per value
  it('falls back to per value when the scalar reading is invalid', async () => {
    expect(
      shape(
        await validate('COUNTALL(IF(OR(values = 1, values = 2), 1, BLANK()))')
      )
    ).toBe('AGG:COUNTALL(IF(OR((values == 1), (values == 2)), 1, BLANK()))');
    expect(shape(await validate('SUM(MAX(values, 0), 10)'))).toBe(
      'ADD(AGG:SUM(MAX(values, 0)), 10)'
    );
    expect(
      shape(await validate('ARRAYJOIN(CONCATENATE(values, "!"))', name))
    ).toBe('AGG:ARRAYJOIN(CONCAT(values, "!"))');
  });

  // guard: a per-value scalar MAX inside SUM still works
  it('reads MAX inside a per-value IF as the scalar function', async () => {
    expect(
      shape(await validate('SUM(IF(values > 0, MAX(values, 0), 0))'))
    ).toBe('AGG:SUM(IF((values > 0), MAX(values, 0), 0))');
  });
});

describe('rollup formula review: date-only results', () => {
  const due = col('due', UITypes.Date, 'date');
  const resultUidt = async (formula: string) =>
    getRollupResultUidt({
      uidt: UITypes.Rollup,
      colOptions: {
        rollup_function: 'formula',
        parsed_tree: await validateFormulaAndExtractTreeWithType({
          formula,
          columns: [],
          clientOrSqlUi: 'pg',
          getMeta: async (_context, { id }) => ({
            id,
            title: id,
            base_id: 'base1',
            fk_workspace_id: 'ws1',
            columns: [due],
          }),
          rollup: { valuesColumn: due, valuesColumns: [due] },
        }),
      },
    });

  // a date-only value chosen by IF is still date-only; as DateTime it renders
  // through the viewer's timezone and shifts a day west of UTC
  it('keeps a Date for IF over date-only aggregates', async () => {
    expect(await resultUidt('DATEADD(MAX(values), 1, "day")')).toBe(
      UITypes.Date
    );
    expect(
      await resultUidt('IF(COUNTALL(values) > 1, MAX(values), MIN(values))')
    ).toBe(UITypes.Date);
    expect(
      await resultUidt(
        'SWITCH(COUNTALL(values), 1, MIN(values), 2, MAX(values), BLANK())'
      )
    ).toBe(UITypes.Date);
    expect(
      await resultUidt('IF(COUNTALL(values) > 1, MAX(values), NOW())')
    ).toBe(UITypes.DateTime);
  });
});
