import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes, JSEPNode } from './enums';
import {
  extractRollupAggregates,
  getRollupResultUidt,
  hasFreeRollupValues,
  RollupAggregate,
  rollupFormulaKeepsTargetFormat,
  rollupFormulaResultUidt,
} from './rollupFormula';
import type {
  BinaryExpressionNode,
  CallExpressionNode,
  IdentifierNode,
  LiteralNode,
  ParsedFormulaNode,
} from './types';
import UITypes from '../UITypes';
import { UnifiedMetaType } from '~/lib/types';

function callNode(node: ParsedFormulaNode | undefined): CallExpressionNode {
  if (node?.type !== JSEPNode.CALL_EXP) {
    throw new Error(`expected a call, got ${node?.type}`);
  }
  return node;
}

function binaryNode(
  node: ParsedFormulaNode | undefined
): BinaryExpressionNode {
  if (node?.type !== JSEPNode.BINARY_EXP) {
    throw new Error(`expected a binary expression, got ${node?.type}`);
  }
  return node;
}

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

const amount = col('amount', UITypes.Currency, 'decimal');
const name = col('name', UITypes.SingleLineText, 'varchar');
const due = col('due', UITypes.Date, 'date');
const done = col('done', UITypes.Checkbox, 'boolean');

// the linked table holding `values`
const getMeta: UnifiedMetaType.IGetModel = async (_context, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  columns: [amount, name, due, done],
});

const validate = (formula: string, valuesColumn = amount) =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: [],
    clientOrSqlUi: 'pg',
    getMeta,
    rollup: {
      valuesColumn,
      valuesColumns: [amount, name, due, done],
    },
  });

describe('rollup formula validation', () => {
  it('types each aggregate', async () => {
    const cases: [string, UnifiedMetaType.IColumn, FormulaDataTypes][] = [
      ['SUM(values)', amount, FormulaDataTypes.NUMERIC],
      ['AVG(values)', amount, FormulaDataTypes.NUMERIC],
      ['MIN(values)', due, FormulaDataTypes.DATE],
      // Airtable: numbers only, so text gives 0
      ['MAX(values)', name, FormulaDataTypes.NUMERIC],
      ['MAX(VALUE(values))', name, FormulaDataTypes.NUMERIC],
      ['COUNTALL(values)', name, FormulaDataTypes.NUMERIC],
      ['AND(values)', done, FormulaDataTypes.BOOLEAN],
      ['OR(values > 10)', amount, FormulaDataTypes.BOOLEAN],
      ['ARRAYJOIN(values, "; ")', name, FormulaDataTypes.STRING],
      ['CONCATENATE(values)', name, FormulaDataTypes.STRING],
    ];
    for (const [formula, valuesColumn, dataType] of cases) {
      const tree = await validate(formula, valuesColumn);
      expect(tree.dataType).toBe(dataType);
    }
  });

  it('marks aggregates with their canonical name', async () => {
    const tree = callNode(await validate('AVG(values)'));
    expect(tree.rollupAggregate).toBe(RollupAggregate.AVERAGE);
  });

  it('types scalar expressions around aggregates', async () => {
    const tree = await validate('ROUND(SUM(values) * 1.1, 2)');
    expect(tree.dataType).toBe(FormulaDataTypes.NUMERIC);
    expect(extractRollupAggregates(tree)).toHaveLength(1);

    const range = await validate('MAX(values) - MIN(values)');
    expect(extractRollupAggregates(range)).toHaveLength(2);
  });

  it('allows per-value expressions inside an aggregate', async () => {
    const tree = callNode(await validate('SUM(IF(values > 10, values, 0))'));
    expect(tree.rollupAggregate).toBe(RollupAggregate.SUM);
    expect(tree.arguments[0].type).toBe(JSEPNode.CALL_EXP);

    const upper = await validate('ARRAYJOIN(UPPER(values))', name);
    expect(upper.dataType).toBe(FormulaDataTypes.STRING);
  });

  it('treats MIN as a plain function when it has no free values', async () => {
    const tree = callNode(await validate('MIN(SUM(values), 100)'));
    expect(tree.rollupAggregate).toBeUndefined();
    expect(callNode(tree.arguments[0]).rollupAggregate).toBe(
      RollupAggregate.SUM
    );
  });

  it('chains modifiers inside an aggregate', async () => {
    const tree = callNode(
      await validate(
        'ARRAYJOIN(ARRAYSLICE(ARRAYUNIQUE(ARRAYCOMPACT(values)), 1, -2), " | ")',
        name
      )
    );
    const slice = callNode(tree.arguments[0]);
    expect(slice.rollupModifier).toBe('ARRAYSLICE');
    expect(callNode(slice.arguments[0]).rollupModifier).toBe(
      'ARRAYUNIQUE'
    );
  });

  it('wraps a bare value set in ARRAYJOIN', async () => {
    const bare = callNode(await validate('values', name));
    expect(bare.rollupAggregate).toBe(RollupAggregate.ARRAYJOIN);

    const unique = callNode(await validate('ARRAYUNIQUE(values)', name));
    expect(unique.rollupAggregate).toBe(RollupAggregate.ARRAYJOIN);
    expect(callNode(unique.arguments[0]).rollupModifier).toBe(
      'ARRAYUNIQUE'
    );
  });

  it('reads values outside an aggregate as joined text, as Airtable does', async () => {
    const tree = binaryNode(await validate('"Total: " & values'));
    expect(tree.dataType).toBe(FormulaDataTypes.STRING);
    expect(callNode(tree.right).rollupAggregate).toBe(
      RollupAggregate.CONCATENATE
    );

    const len = callNode(await validate('LEN(ARRAYUNIQUE(values))', name));
    expect(callNode(len.arguments[0]).rollupAggregate).toBe(
      RollupAggregate.CONCATENATE
    );
  });

  it('splits variadic aggregates', async () => {
    const sum = callNode(await validate('SUM(values, 10)'));
    expect(sum.callee.name).toBe('ADD');
    expect(callNode(sum.arguments[0]).rollupAggregate).toBe(
      RollupAggregate.SUM
    );
    const max = callNode(await validate('MAX(0, values)'));
    expect(max.rollupAggregate).toBeUndefined();
    expect(callNode(max.arguments[1]).rollupAggregate).toBe(
      RollupAggregate.MAX
    );
  });

  it('rejects invalid formulas', async () => {
    const invalid: [string, UnifiedMetaType.IColumn?][] = [
      ['1 + 2'],
      ['SUM(values + COUNT(values))'],
      ['SUM(values)', name],
      ['AVERAGE(values, 1)'],
      ['SUM(values, values)'],
      ['ARRAYJOIN(values, {amount})'],
      ['ARRAYJOIN(ARRAYSLICE(values, "a"))'],
      ['SUM({amount})'],
    ];
    for (const [formula, valuesColumn] of invalid) {
      await expect(validate(formula, valuesColumn)).rejects.toThrow();
    }
  });

  it('rejects arithmetic the database would refuse, with a position', async () => {
    const time = col('time', UITypes.Time, 'time');
    for (const [formula, valuesColumn] of [
      ['SUM(values * 2)', name],
      ['SUM(values - 1)', due],
      ['MAX(values) * 2', time],
    ] as const) {
      await expect(
        validateFormulaAndExtractTreeWithType({
          formula,
          columns: [],
          clientOrSqlUi: 'pg',
          getMeta,
          trackPosition: true,
          rollup: { valuesColumn, valuesColumns: [valuesColumn] },
        })
      ).rejects.toMatchObject({
        message: expect.stringMatching(/operator requires numeric values/),
        extra: { position: expect.anything() },
      });
    }
  });

  it('keeps numeric arithmetic and negation', async () => {
    for (const formula of [
      'SUM(-values)',
      'SUM(ABS(-values))',
      'SUM(values * 2)',
      'SUM(values) / COUNTA(values)',
    ]) {
      expect((await validate(formula)).dataType).toBe(FormulaDataTypes.NUMERIC);
    }
    const range = await validate('MAX(values) - MIN(values)', due);
    expect(range.dataType).toBe(FormulaDataTypes.NUMERIC);
    const length = await validate('MIN(values) * 2', name);
    expect(length.dataType).toBe(FormulaDataTypes.NUMERIC);
  });

  it('rejects what the database cannot evaluate over the values type', async () => {
    const json = col('meta', UITypes.JSON, 'jsonb');
    const at = col('at', UITypes.DateTime, 'timestamp');
    for (const [formula, valuesColumn] of [
      ['SUM(values)', json],
      ['SUM(values * 2)', json],
      ['MAX(values) > 1', due],
      ['OR(values > 1)', at],
      ['SUM(IF(values > 1, 1, 0))', at],
      ['MAX(DATEADD(values, 1, "day"))', amount],
      ['MAX(DATEADD(values, 1, "day"))', done],
    ] as const) {
      await expect(validate(formula, valuesColumn)).rejects.toThrow();
    }
    // still valid
    for (const [formula, valuesColumn] of [
      ['ARRAYJOIN(values)', json],
      ['MAX(values) > "2024-01-01"', due],
      ['MAX(DATEADD(values, 1, "day"))', due],
      ['OR(values > 10)', amount],
    ] as const) {
      await expect(validate(formula, valuesColumn)).resolves.toBeDefined();
    }
  });

  it('names the argument an aggregate is missing', async () => {
    await expect(validate('SUM(foo)')).rejects.toThrow(/foo/);
    await expect(validate('SUM(1)')).rejects.toThrow(/must take `values`/);
    await expect(validate('SUM(SUM(values))')).rejects.toThrow(
      /inside another aggregate/
    );
  });
});

describe('rollup formula helpers', () => {
  const values: IdentifierNode = {
    type: JSEPNode.IDENTIFIER,
    name: 'values',
    raw: 'values',
  };
  const two: LiteralNode = { type: JSEPNode.LITERAL, value: 2, raw: '2' };
  const call = (name: string, ...args: ParsedFormulaNode[]) =>
    ({
      type: JSEPNode.CALL_EXP,
      callee: { type: JSEPNode.IDENTIFIER, name },
      arguments: args,
    } satisfies CallExpressionNode);
  const times = (left: ParsedFormulaNode, right: ParsedFormulaNode) =>
    ({
      type: JSEPNode.BINARY_EXP,
      operator: '*',
      left,
      right,
    } satisfies BinaryExpressionNode);

  it('finds free values', () => {
    expect(hasFreeRollupValues(times(values, two))).toBe(true);
    expect(hasFreeRollupValues(times(call('SUM', values), two))).toBe(false);
    expect(hasFreeRollupValues(call('ARRAYUNIQUE', values))).toBe(true);
  });

  it('resolves the display type', async () => {
    expect(rollupFormulaResultUidt(await validate('COUNT(values)'))).toBe(
      UITypes.Number
    );
    expect(rollupFormulaResultUidt(await validate('SUM(values) / 2'))).toBe(
      UITypes.Decimal
    );
    // MIN/MAX of a date-only field, moved by whole days, stays a date;
    // other date results are datetimes
    expect(rollupFormulaResultUidt(await validate('MAX(values)', due))).toBe(
      UITypes.Date
    );
    expect(
      rollupFormulaResultUidt(
        await validate('DATEADD(MAX(values), 1, "day")', due)
      )
    ).toBe(UITypes.Date);
    expect(
      rollupFormulaResultUidt(
        await validate('DATEADD(MAX(values), 1, "hour")', due)
      )
    ).toBe(UITypes.DateTime);
    expect(
      rollupFormulaResultUidt(
        await validate('DATEADD(MAX(values), 1.5, "day")', due)
      )
    ).toBe(UITypes.DateTime);
    expect(rollupFormulaResultUidt(await validate('AND(values)', done))).toBe(
      UITypes.Checkbox
    );
    expect(rollupFormulaKeepsTargetFormat(await validate('SUM(values)'))).toBe(
      true
    );
    expect(
      rollupFormulaKeepsTargetFormat(await validate('SUM(values * 2)'))
    ).toBe(false);
  });

  it('keeps whole-number sums whole', async () => {
    const qty = col('qty', UITypes.Number, 'int');
    expect(rollupFormulaResultUidt(await validate('SUM(values)', qty))).toBe(
      UITypes.Number
    );
    expect(
      rollupFormulaResultUidt(await validate('AVERAGE(values)', qty))
    ).toBe(UITypes.Decimal);
    expect(rollupFormulaResultUidt(await validate('SUM(values)'))).toBe(
      UITypes.Decimal
    );
  });

  it('resolves a rollup result type: formula, then date min/max, then number', async () => {
    const rollup = (colOptions: Record<string, unknown>) =>
      getRollupResultUidt({ uidt: UITypes.Rollup, colOptions });

    // a formula takes its formula's type, even over a stale result_uidt
    expect(
      rollup({
        rollup_function: 'formula',
        parsed_tree: await validate('AND(values)', done),
        result_uidt: UITypes.Date,
      })
    ).toBe(UITypes.Checkbox);
    expect(
      rollup({
        rollup_function: 'formula',
        parsed_tree: await validate('MAX(values)', due),
      })
    ).toBe(UITypes.Date);
    // min/max over a date field takes the date type resolved on read
    expect(rollup({ rollup_function: 'max', result_uidt: UITypes.Date })).toBe(
      UITypes.Date
    );
    expect(
      rollup({ rollup_function: 'min', result_uidt: UITypes.DateTime })
    ).toBe(UITypes.DateTime);
    // anything else is a number: no type of its own
    expect(rollup({ rollup_function: 'max' })).toBeUndefined();
    expect(rollup({ rollup_function: 'sum' })).toBeUndefined();
    expect(
      getRollupResultUidt({
        uidt: UITypes.Formula,
        colOptions: { rollup_function: 'formula' },
      })
    ).toBeUndefined();
  });
});
