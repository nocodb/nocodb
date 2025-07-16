import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import { createColumn } from '../../factory/column';

function formulaErrorTests() {
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

  // issue #6075
  it('will create a formula referencing formula at table1', async () => {
    try {
      await createColumn(_context, _tables.table1, {
        title: 'formulaTitle',
        uidt: UITypes.Formula,
        formula: `SUBSTR({Title}, 0, -1)`,
        formula_raw: `SUBSTR({Title}, 0, -1)`,
      });
    } catch (ex) {
      expect(ex.message).to.satisfy((msg) =>
        msg.startsWith('Negative substring length not allowed'),
      );
    }
  });
}

export function formulaErrorTest() {
  describe('FormulaErrorTest', formulaErrorTests);
}
