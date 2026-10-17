import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { FormulaDataTypes, JSEPNode } from './enums';
import {
  extractRollupAggregates,
  hasFreeRollupValues,
  RollupAggregate,
  rollupFormulaKeepsTargetFormat,
  rollupFormulaResultUidt,
} from './rollupFormula';
import { formulaJsep } from './jsepInstances';
import type { CallExpressionNode, ParsedFormulaNode } from './types';
import UITypes from '../UITypes';
import { UnifiedMetaType } from '~/lib/types';

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

const validate = (formula: string, valuesColumn = amount) =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: [],
    clientOrSqlUi: 'pg',
    getMeta: async () => undefined as any,
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
    const tree = (await validate('AVG(values)')) as CallExpressionNode;
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
    const tree = (await validate(
      'SUM(IF(values > 10, values, 0))'
    )) as CallExpressionNode;
    expect(tree.rollupAggregate).toBe(RollupAggregate.SUM);
    expect(tree.arguments[0].type).toBe(JSEPNode.CALL_EXP);

    const upper = await validate('ARRAYJOIN(UPPER(values))', name);
    expect(upper.dataType).toBe(FormulaDataTypes.STRING);
  });

  it('treats MIN as a plain function when it has no free values', async () => {
    const tree = (await validate(
      'MIN(SUM(values), 100)'
    )) as CallExpressionNode;
    expect(tree.rollupAggregate).toBeUndefined();
    expect((tree.arguments[0] as CallExpressionNode).rollupAggregate).toBe(
      RollupAggregate.SUM
    );
  });

  it('chains modifiers inside an aggregate', async () => {
    const tree = (await validate(
      'ARRAYJOIN(ARRAYSLICE(ARRAYUNIQUE(ARRAYCOMPACT(values)), 1, -2), " | ")',
      name
    )) as CallExpressionNode;
    const slice = tree.arguments[0] as CallExpressionNode;
    expect(slice.rollupModifier).toBe('ARRAYSLICE');
    expect((slice.arguments[0] as CallExpressionNode).rollupModifier).toBe(
      'ARRAYUNIQUE'
    );
  });

  it('wraps a bare value set in ARRAYJOIN', async () => {
    const bare = (await validate('values', name)) as CallExpressionNode;
    expect(bare.rollupAggregate).toBe(RollupAggregate.ARRAYJOIN);

    const unique = (await validate(
      'ARRAYUNIQUE(values)',
      name
    )) as CallExpressionNode;
    expect(unique.rollupAggregate).toBe(RollupAggregate.ARRAYJOIN);
    expect((unique.arguments[0] as CallExpressionNode).rollupModifier).toBe(
      'ARRAYUNIQUE'
    );
  });

  it('reads values outside an aggregate as joined text, as Airtable does', async () => {
    const tree = (await validate('"Total: " & values')) as any;
    expect(tree.dataType).toBe(FormulaDataTypes.STRING);
    expect(tree.right.rollupAggregate).toBe(RollupAggregate.CONCATENATE);

    const len = (await validate('LEN(ARRAYUNIQUE(values))', name)) as any;
    expect(len.arguments[0].rollupAggregate).toBe(RollupAggregate.CONCATENATE);
  });

  it('splits variadic aggregates', async () => {
    const sum = (await validate('SUM(values, 10)')) as CallExpressionNode;
    expect(sum.callee.name).toBe('ADD');
    expect((sum.arguments[0] as CallExpressionNode).rollupAggregate).toBe(
      RollupAggregate.SUM
    );
    const max = (await validate('MAX(0, values)')) as CallExpressionNode;
    expect(max.rollupAggregate).toBeUndefined();
    expect((max.arguments[1] as CallExpressionNode).rollupAggregate).toBe(
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
});

describe('rollup formula helpers', () => {
  const parse = (f: string) => formulaJsep(f) as unknown as ParsedFormulaNode;

  it('finds free values', () => {
    expect(hasFreeRollupValues(parse('values * 2'))).toBe(true);
    expect(hasFreeRollupValues(parse('SUM(values) * 2'))).toBe(false);
    expect(hasFreeRollupValues(parse('ARRAYUNIQUE(values)'))).toBe(true);
  });

  it('resolves the display type', async () => {
    expect(rollupFormulaResultUidt(await validate('COUNT(values)'))).toBe(
      UITypes.Number
    );
    expect(rollupFormulaResultUidt(await validate('SUM(values) / 2'))).toBe(
      UITypes.Decimal
    );
    // a bare MIN/MAX of a date-only field stays a date; other date results are datetimes
    expect(rollupFormulaResultUidt(await validate('MAX(values)', due))).toBe(
      UITypes.Date
    );
    expect(
      rollupFormulaResultUidt(
        await validate('DATEADD(MAX(values), 1, "day")', due)
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
});
