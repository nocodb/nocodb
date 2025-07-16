import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel, initQrBarcodeColumns } from '../initModel';
import { createColumn } from '../../factory/column';
import { listRow } from '../../factory/row';

function formulaQrBarcodeTests() {
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
    await initQrBarcodeColumns(setup);
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  it('will create a formula referencing qr_code correctly', async () => {
    const formulaColumn = await createColumn(
      _context,
      _tables.table1,
      {
        title: 'FormulaQrCode',
        uidt: UITypes.Formula,
        formula: '{QR Code}',
        formula_raw: '{QR Code}',
      },
      { throwError: true },
    );
    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows[0].FormulaQrCode).to.eq(rows[0].Title);
  });
  it('will create a formula referencing barcode correctly', async () => {
    const formulaColumn = await createColumn(
      _context,
      _tables.table1,
      {
        title: 'FormulaBarcode',
        uidt: UITypes.Formula,
        formula: '{Barcode}',
        formula_raw: '{Barcode}',
      },
      { throwError: true },
    );
    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows[0].FormulaBarcode).to.eq(rows[0].Title);
  });
}

export function formulaQrBarcodeTest() {
  describe('FormulaQrBarcodeTest', formulaQrBarcodeTests);
}
