import 'mocha';
import { initInitialModel } from '../initModel';

function formulaLookupLtarTests() {
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
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  it.only('will serve as placeholder', () => {
    console.log(_tables)
  });
}

export function formulaLookupLtarTest() {
  describe('BaseModelSql', formulaLookupLtarTests);
}
