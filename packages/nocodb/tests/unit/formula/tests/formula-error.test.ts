import { expect } from 'chai';
import 'mocha';
import { ClientType, UITypes } from 'nocodb-sdk';
import { Model, Source } from '../../../../src/models';
import {
  createColumn,
  createColumn2,
  updateColumn2,
} from '../../factory/column';
import { initInitialModel } from '../initModel';

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
  let _source;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
    const source = await Source.get(setup.ctx, setup.tables.table1.source_id);
    _source = source;
  });

  // issue #6075
  it('will create a formula with invalid substring parameter', async () => {
    // skip if not pg
    if (_source.type !== ClientType.PG) {
      return;
    }
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

  it('will create a circular referenced formula', async () => {
    const formulaTitleColumn = await createColumn(_context, _tables.table1, {
      title: 'formulaTitle',
      uidt: UITypes.Formula,
      formula: `{Title}`,
      formula_raw: `{Title}`,
    });
    await createColumn(_context, _tables.table1, {
      title: 'formulaTitle2',
      uidt: UITypes.Formula,
      formula: `{formulaTitle}`,
      formula_raw: `{formulaTitle}`,
    });

    const resp = await updateColumn2(_context, {
      columnId: formulaTitleColumn.id,
      baseId: _ctx.base_id,
      attr: {
        title: 'formulaTitle',
        options: {
          formula: `{formulaTitle2}`,
        },
      },
    });
    expect(resp.status).to.eq(400);
    expect(resp.body.error).to.eq('FORMULA_CIRCULAR_REF_ERROR');
    expect(resp.body.message).to.satisfy((msg) =>
      msg.startsWith(`Detected circular ref for column `),
    );
  });

  it('will create a circular referenced formula with lookup', async () => {
    const table1Model = await Model.get(_ctx, _tables.table1.id);

    const Table1SelfList_TitlesColumn = (
      await table1Model.getColumns(_ctx)
    ).find((col) => col.title === 'Table1SelfList_Titles');

    const t1_HM_t1_Ltar = (await table1Model.getColumns(_ctx)).find(
      (col) => col.title === 'Table1SelfList',
    );

    const formulaSelfListLookupColumn = await createColumn(
      _context,
      _tables.table1,
      {
        title: 'formulaSelfListLookup',
        uidt: UITypes.Formula,
        formula: `{Table1SelfList_Titles}`,
        formula_raw: `{Table1SelfList_Titles}`,
      },
    );

    await updateColumn2(_context, {
      columnId: Table1SelfList_TitlesColumn.id,
      baseId: _ctx.base_id,
      attr: {
        title: 'Table1SelfList_Titles',
        options: {
          related_field_id: t1_HM_t1_Ltar.id,
          related_table_lookup_field_id: formulaSelfListLookupColumn.id,
        },
      },
    });

    const resp = await updateColumn2(_context, {
      columnId: formulaSelfListLookupColumn.id,
      baseId: _ctx.base_id,
      attr: {
        title: 'formulaTitle',
        options: {
          formula: `{Table1SelfList_Titles}`,
        },
      },
    });
    expect(resp.status).to.eq(400);
    expect(resp.body.error).to.eq('FORMULA_CIRCULAR_REF_ERROR');
    expect(resp.body.message).to.satisfy((msg) =>
      msg.startsWith(`Detected circular ref for column `),
    );
  });

  it('will create a circular referenced formula with rollup', async () => {
    const table1Model = await Model.get(_ctx, _tables.table1.id);

    const formulaSelfListRollupColumn = await createColumn(
      _context,
      _tables.table1,
      {
        title: 'formulaSelfListRollup',
        uidt: UITypes.Formula,
        formula: `{Title}`,
        formula_raw: `{Title}`,
      },
    );

    const t1_HM_t1_Ltar = (await table1Model.getColumns(_ctx)).find(
      (col) => col.title === 'Table1SelfList',
    );
    await createColumn2({
      context: _context,
      ctx: _ctx,
      table: _tables.table1,
      columnAttr: {
        title: 'rollupSelfList',
        type: UITypes.Rollup,
        options: {
          related_field_id: t1_HM_t1_Ltar.id,
          related_table_rollup_field_id: formulaSelfListRollupColumn.id,
          rollup_function: 'max',
        },
      },
    });

    const resp = await updateColumn2(_context, {
      columnId: formulaSelfListRollupColumn.id,
      baseId: _ctx.base_id,
      attr: {
        title: 'formulaSelfListRollup',
        options: {
          formula: '{rollupSelfList}',
        },
      },
    });

    expect(resp.status).to.eq(400);
    expect(resp.body.error).to.eq('FORMULA_CIRCULAR_REF_ERROR');
    expect(resp.body.message).to.satisfy((msg) =>
      msg.startsWith(`Detected circular ref for column `),
    );
  });
}

export function formulaErrorTest() {
  describe('FormulaErrorTest', formulaErrorTests);
}
