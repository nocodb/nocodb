import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel, initRollupColumns } from '../initModel';
import {
  createColumn,
  createRollupColumn,
  updateColumn2,
} from '../../factory/column';
import { listRow } from '../../factory/row';
import { Model } from '../../../../src/models';

function rollupErrorTests() {
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

  it(`will create a circular referenced rollup with rollup`, async () => {
    const table1Model = await Model.get(_ctx, _tables.table1.id);
    const table2Model = await Model.get(_ctx, _tables.table2.id);
    const T1TitleCountColumn = (await table2Model.getColumns(_ctx)).find(
      (col) => col.title === 'T1TitleCount',
    );
    const T1sColumn = (await table2Model.getColumns(_ctx)).find(
      (col) => col.title === 'T1s',
    );
    const T2sColumn = (await table1Model.getColumns(_ctx)).find(
      (col) => col.title === 'T2s',
    );
    const T2TitleCount = await createRollupColumn(
      _context,
      {
        base: _base,
        title: 'T2TitleCount',
        rollupFunction: 'count',
        table: _tables.table1,
        relatedTableName: _tables.table2.table_name,
        relatedTableColumnTitle: T1TitleCountColumn.title,
        ltarColumnId: T2sColumn.id,
      },
      {
        throwError: true,
      },
    );

    const updateRes = await updateColumn2(_context, {
      columnId: T1TitleCountColumn.id,
      baseId: _base.id,
      attr: {
        title: T1TitleCountColumn.title,
        options: {
          related_field_id: T1sColumn.id,
          related_table_rollup_field_id: T2TitleCount.id,
          rollup_function: 'count',
        },
      },
    });
    expect(updateRes.status).to.eq(400);
    expect(updateRes.body.error).to.eq('FORMULA_CIRCULAR_REF_ERROR');
  });
}

export function rollupErrorTest() {
  describe('RollupErrorTest', rollupErrorTests);
}
