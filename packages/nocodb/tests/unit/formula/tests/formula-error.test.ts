import { expect } from 'chai';
import 'mocha';
import { ClientType, UITypes } from 'nocodb-sdk';
import { Source } from '../../../../src/models';
import { createColumn, updateColumn2 } from '../../factory/column';
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
      msg.startsWith(
        `Detected circular ref for column '${formulaTitleColumn.id}'`,
      ),
    );
  });
}

export function formulaErrorTest() {
  describe('FormulaErrorTest', formulaErrorTests);
}
