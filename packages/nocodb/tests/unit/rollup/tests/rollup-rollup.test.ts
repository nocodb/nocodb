import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel, initRollupColumns } from '../initModel';
import { createColumn, createRollupColumn } from '../../factory/column';
import { listRow } from '../../factory/row';
import { Model } from '../../../../src/models';

function rollupRollupTests() {
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
    await initRollupColumns(setup);
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  it(`will create rollup on rollup column`, async () => {
    const T2T1TitleSum = await createRollupColumn(
      _context,
      {
        base: _base,
        title: 'T2T1TitleSum',
        rollupFunction: 'sum',
        table: _tables.table3,
        relatedTableName: _tables.table2.table_name,
        relatedTableColumnTitle: 'T1TitleCount',
      },
      {
        throwError: true,
      },
    );
    expect(typeof T2T1TitleSum).to.eq(`object`);
    const rows = await listRow({ base: _base, table: _tables.table3 });
    expect(rows[0].T2T1TitleSum).to.greaterThan(0);
  });
}

export function rollupRollupTest() {
  describe('RollupRollupTest', rollupRollupTests);
}
