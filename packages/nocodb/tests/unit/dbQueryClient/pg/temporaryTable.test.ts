import { expect } from 'chai';
import 'mocha';
import { initInitialModel } from '../initModel';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { PGDBQueryClient } from '~/dbQueryClient/pg';

function pgTemporaryTableTest() {
  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _source;
  let _knex: any;

  beforeEach(async () => {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    const source = (await _base.getSources())[0];
    _source = source;
    _knex = await NcConnectionMgrv2.get(source);
  });

  it(`will generate a temporary table`, async () => {
    const data = [
      { id: 1, foo: 'foo1', bar: 'bar1' },
      { id: 2, foo: 'foo2', bar: 'bar2' },
      { id: 3, foo: 'foo3', bar: 'bar3' },
      { id: 4, foo: 'foo4', bar: 'bar4' },
      { id: 5, foo: 'foo5', bar: 'bar5' },
    ];
    const fields = ['id', 'foo', 'bar'];

    let query = new PGDBQueryClient().temporaryTable({
      knex: _knex,
      alias: '_tbl1',
      data,
      fields,
    });

    query = query.where('_tbl1.id', '>', 3);
    const result = await query;
    expect(result.length).to.eq(2);
    expect(Object.keys(result[0]).join(',')).to.eq(fields.join(','));
  });
}

export function pgTemporaryTableTests() {
  describe('PGTemporaryTableTest', pgTemporaryTableTest);
}
