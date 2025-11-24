import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import {
  initFormulaLookupColumns,
  initFormulaRollupColumns,
  initInitialModel,
} from '../initModel';
import { createColumn } from '../../factory/column';
import { chunkListRow, listRow } from '../../factory/row';

function formulaRollupTests() {
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

  it(`will get distinct count from rollup referring to formula`, async () => {
    await initFormulaRollupColumns(_setup);

    const t2Rows = await chunkListRow({
      base: _base,
      table: _tables.table2,
      pks: [1, 2, 3, 4, 5, 6].map((k) => `${k}`),
    });
    expect(t2Rows[0].table1FormulaTitle).to.greaterThan(0);
  });
}

export function formulaRollupTest() {
  describe('FormulaRollupTest', formulaRollupTests);
}
