import fs from 'node:fs';
import path from 'node:path';
import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import { MAX_ROLLUP_AGGREGATES } from './rollupFormula';
import { FormulaError } from './error';
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

const getMeta: UnifiedMetaType.IGetModel = async (_context, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  columns: [amount, name, due],
});

const validate = (
  formula: string,
  valuesColumn: UnifiedMetaType.IColumn = amount
) =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: [],
    clientOrSqlUi: 'pg',
    getMeta,
    trackPosition: true,
    rollup: { valuesColumn, valuesColumns: [amount, name, due] },
  });

const caught = async (promise: Promise<unknown>): Promise<FormulaError> => {
  try {
    await promise;
  } catch (e) {
    if (e instanceof FormulaError) return e;
    throw e;
  }
  throw new Error('expected a FormulaError');
};

const enFormulaMessages: Record<string, string> = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../../nc-gui/lang/en.json'),
    'utf8'
  )
).msg.formula;

// the subset of vue-i18n named interpolation the messages use
const interpolate = (message: string, params: Record<string, unknown>) =>
  message.replace(/\{(\w+)\}/g, (_, param: string) => {
    expect(params).toHaveProperty(param);
    return String(params[param]);
  });

describe('rollup formula error messages', () => {
  const cases: [string, UnifiedMetaType.IColumn, string][] = [
    ['AVERAGE(values, 1)', amount, 'rollupAverageValuesOnly'],
    ['MAX(values, values)', amount, 'rollupAggregateValuesOnce'],
    ['COUNTA(values, 1 + 1)', amount, 'rollupCountLiteralItems'],
    ['SUM(SUM(values))', amount, 'rollupNestedAggregate'],
    [
      'ARRAYJOIN(UPPER(ARRAYUNIQUE(values)))',
      name,
      'rollupModifierFirstArgument',
    ],
    ['ARRAYJOIN(ARRAYUNIQUE(values, 1))', name, 'rollupExactArguments'],
    ['SUM()', amount, 'rollupAggregateRequiresValues'],
    ['DATEADD(SUM(values), 1, "day")', amount, 'firstArgumentMustBeDate'],
    [
      `SUM(${'('.repeat(20000)}values${')'.repeat(20000)})`,
      amount,
      'formulaTooComplex',
    ],
    ['ARRAYJOIN(values, ",", "x")', name, 'rollupArgumentsRange'],
    ['ARRAYJOIN(values, 1)', name, 'rollupArrayJoinSeparator'],
    ['ARRAYJOIN(ARRAYSLICE(values, "a"))', name, 'rollupArraySliceBounds'],
    ['SUM(values)', due, 'rollupNumericValuesRequired'],
    ['SUM({foo})', amount, 'rollupOnlyValuesReference'],
    ['MIN(values) > 1', due, 'rollupDateNumberComparison'],
    ['SUM(values - 1)', due, 'rollupOperatorNumericDate'],
    ['SUM(values * 2)', name, 'rollupOperatorNumericText'],
    ['1 + 1', amount, 'rollupMustAggregate'],
    [
      Array(MAX_ROLLUP_AGGREGATES + 1)
        .fill('SUM(values)')
        .join(' + '),
      amount,
      'rollupMaxAggregates',
    ],
  ];

  it.each(
    cases.map(
      ([formula, valuesColumn, key]) => [key, formula, valuesColumn] as const
    )
  )('%s', async (key, formula, valuesColumn) => {
    const error = await caught(validate(formula, valuesColumn));
    expect(error.extra.key).toBe(`msg.formula.${key}`);
    expect(enFormulaMessages[key]).toBeDefined();
    // en.json renders the same text the SDK throws
    expect(interpolate(enFormulaMessages[key], error.extra)).toBe(
      error.message
    );
  });
});

describe('rollup formula error positions', () => {
  const marked = async (
    formula: string,
    valuesColumn: UnifiedMetaType.IColumn
  ) => {
    const { position } = (await caught(validate(formula, valuesColumn))).extra;
    return formula.slice(position.column, position.column + position.length);
  };

  it('covers the braces of a {values} reference', async () => {
    expect(await marked('SUM({values} * 2)', name)).toBe('{values}');
    expect(await marked('SUM(values * 2)', name)).toBe('values');
  });

  it('covers the braces of a {Field} reference', async () => {
    expect(await marked('SUM({foo})', amount)).toBe('{foo}');
    expect(await marked('SUM(foo)', amount)).toBe('foo');
  });

  it('covers the braces of an ordinary formula {Field} reference', async () => {
    const error = await caught(
      validateFormulaAndExtractTreeWithType({
        formula: 'CONCAT({name}, {missing})',
        columns: [name],
        clientOrSqlUi: 'pg',
        getMeta,
        trackPosition: true,
      })
    );
    const { column, length } = error.extra.position;
    expect('CONCAT({name}, {missing})'.slice(column, column + length)).toBe(
      '{missing}'
    );
  });
});
