import { validateFormulaAndExtractTreeWithType } from './validate-extract-tree';
import UITypes from '../UITypes';
import type { UnifiedMetaType } from '~/lib/types';

// Review of 1283f328ba8: the scalar-then-per-value retry in validateAndExtract.

const num: UnifiedMetaType.IColumn = {
  id: 'num',
  title: 'num',
  uidt: UITypes.Number,
  dt: 'bigint',
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  fk_model_id: 'child',
};

const getMeta: UnifiedMetaType.IGetModel = async (_context, { id }) => ({
  id,
  title: id,
  base_id: 'base1',
  fk_workspace_id: 'ws1',
  columns: [num],
});

const validate = (formula: string) =>
  validateFormulaAndExtractTreeWithType({
    formula,
    columns: [],
    clientOrSqlUi: 'pg',
    getMeta,
    trackPosition: true,
    rollup: { valuesColumn: num, valuesColumns: [num] },
  });

const nest = (depth: number, wrap: (inner: string) => string, leaf: string) => {
  let formula = leaf;
  for (let i = 0; i < depth; i++) formula = wrap(formula);
  return formula;
};

describe('rollup formula review 2: aggregate reading retry', () => {
  // Each COUNTALL / MAX level retries: the scalar MAX fails on the
  // two-value-set AND only after validating the whole inner level, and the
  // per-value reading splits MAX(inner, AND(...)) and validates the inner
  // level again from scratch. Two full passes per level: 2^depth.
  // depth 12 ≈ 3 s, 14 ≈ 9 s (~620 chars), 20 ≈ minutes of a blocked loop.
  it('validates a 14-level nested formula in linear time', async () => {
    const formula = nest(
      14,
      (inner) => `COUNTALL(MAX(${inner}, AND(values = 1, values = 2)))`,
      '1'
    );
    expect(formula.length).toBeLessThan(700);
    const started = Date.now();
    await validate(formula);
    expect(Date.now() - started).toBeLessThan(1000);
  }, 120000);

  it('guard: a 30-level nested aggregate without the retry stays fast', async () => {
    const started = Date.now();
    await validate(nest(30, (inner) => `MIN(MAX(${inner}, 1), 2)`, 'values'));
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
