// test for generateLinkRequest method on src/db/links/requestHandler.ts
import 'mocha';
import { initInitialModel } from '../initModel';

function linksGenerateLinkRequestTests() {
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
}

export function linksGenerateLinkRequestTest() {
  describe('LinksGenerateLinkRequestTest', linksGenerateLinkRequestTests);
}
