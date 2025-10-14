import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import { createColumn } from '../../factory/column';
import { listRow } from '../../factory/row';

function formulaFormulaTests() {
  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables;
  let _view;
  let _baseModelSql;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  // issue #11155
  it('will create a formula referencing formula at table1', async () => {
    const _formula1Column = await createColumn(_context, _tables.table1, {
      title: 'formulaTitle',
      uidt: UITypes.Formula,
      formula: `CONCAT({Title}, '_')`,
      formula_raw: `CONCAT({Title}, '_')`,
    });
    const _formula2Column = await createColumn(_context, _tables.table1, {
      title: 'formulaTitle2',
      uidt: UITypes.Formula,
      formula: `CONCAT({formulaTitle}, '_')`,
      formula_raw: `CONCAT({formulaTitle}, '_')`,
    });
    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows[0].formulaTitle2).to.eq('T1_001__');
  });
}

export function formulaFormulaTest() {
  describe('FormulaFormulaTest', formulaFormulaTests);
}
