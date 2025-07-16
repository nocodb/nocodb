import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import { createColumn } from '../../factory/column';
import { listRow } from '../../factory/row';

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

  it('will create a formula referencing table2_table1s correctly', async () => {
    // Create a formula field on table 3 that references table2_table1s
    const formulaColumn = await createColumn(_context, _tables.table3, {
      title: 'FormulaTable2Table1s',
      uidt: UITypes.Formula,
      formula: '{table2_table1s}',
      formula_raw: '{table2_table1s}',
    });

    // Verify the formula column was created successfully
    expect(formulaColumn).to.exist;
    expect(formulaColumn.title).to.equal('FormulaTable2Table1s');
    expect(formulaColumn.uidt).to.equal(UITypes.Formula);

    // Get the data to verify the formula is working correctly
    const rows = await listRow({ base: _base, table: _tables.table3 });

    // Verify that we have data
    expect(rows).to.be.an('array');
    expect(rows.length).to.be.greaterThan(0);

    // Check that the formula column exists in the first row
    const firstRow = rows[0];
    expect(firstRow).to.have.property('FormulaTable2Table1s');

    // The formula should return the table2_table1s lookup column value
    // Since table2_table1s is a lookup column that references T1s (which is a LTAR to table1),
    // the formula should contain the related table1 data
    expect(firstRow.FormulaTable2Table1s).to.exist;
    expect(firstRow.FormulaTable2Table1s).to.eq(
      'T1_001,T1_002,T1_003,T1_004,T1_005,T1_006',
    );
  });

  it('will create a formula referencing table1Name correctly', async () => {
    // Create a formula field on table 2 that references table1Name
    const formulaColumn = await createColumn(_context, _tables.table2, {
      title: 'FormulaTable1Name',
      uidt: UITypes.Formula,
      formula: '{table1Name}',
      formula_raw: '{table1Name}',
    });

    // Verify the formula column was created successfully
    expect(formulaColumn).to.exist;
    expect(formulaColumn.title).to.equal('FormulaTable1Name');
    expect(formulaColumn.uidt).to.equal(UITypes.Formula);

    // Get the data to verify the formula is working correctly
    const rows = await listRow({ base: _base, table: _tables.table2 });

    // Verify that we have data
    expect(rows).to.be.an('array');
    expect(rows.length).to.be.greaterThan(0);

    // Check that the formula column exists in the first row
    const firstRow = rows[0];
    expect(firstRow).to.have.property('FormulaTable1Name');

    // The formula should return the table2_table1s lookup column value
    // Since table2_table1s is a lookup column that references T1s (which is a LTAR to table1),
    // the formula should contain the related table1 data
    expect(firstRow.FormulaTable1Name).to.exist;
    expect(firstRow.FormulaTable1Name).to.eq('T1_001,T1_002,T1_003');
  });

  it('will create an ARRAYSORT formula referencing table1Name correctly 1', async () => {
    // Create a formula field on table 2 that references table1Name
    const formulaColumn = await createColumn(_context, _tables.table2, {
      title: 'FormulaTable1Name',
      uidt: UITypes.Formula,
      formula: 'ARRAYSORT({table1Name}, "desc")',
      formula_raw: "ARRAYSORT({table1Name}, 'desc')",
    });

    // Verify the formula column was created successfully
    expect(formulaColumn).to.exist;
    expect(formulaColumn.title).to.equal('FormulaTable1Name');
    expect(formulaColumn.uidt).to.equal(UITypes.Formula);

    // Get the data to verify the formula is working correctly
    const rows = await listRow({ base: _base, table: _tables.table2 });

    // Verify that we have data
    expect(rows).to.be.an('array');
    expect(rows.length).to.be.greaterThan(0);

    // Check that the formula column exists in the first row
    const firstRow = rows[0];
    expect(firstRow).to.have.property('FormulaTable1Name');

    // The formula should return the table2_table1s lookup column value
    // Since table2_table1s is a lookup column that references T1s (which is a LTAR to table1),
    // the formula should contain the related table1 data
    expect(firstRow.FormulaTable1Name).to.exist;
    expect(JSON.stringify(firstRow.FormulaTable1Name)).to.eq(
      `["T1_003","T1_002","T1_001"]`,
    );
  });

  it('will create an ARRAYSORT formula referencing table2_table1s correctly', async () => {
    // Create a formula field on table 3 that references table2_table1s
    const formulaColumn = await createColumn(_context, _tables.table3, {
      title: 'FormulaTable2Table1s',
      uidt: UITypes.Formula,
      formula: "ARRAYSORT({table2_table1s}, 'desc')",
      formula_raw: "ARRAYSORT({table2_table1s}, 'desc')",
    });

    // Verify the formula column was created successfully
    expect(formulaColumn).to.exist;
    expect(formulaColumn.title).to.equal('FormulaTable2Table1s');
    expect(formulaColumn.uidt).to.equal(UITypes.Formula);

    // Get the data to verify the formula is working correctly
    const rows = await listRow({ base: _base, table: _tables.table3 });

    // Verify that we have data
    expect(rows).to.be.an('array');
    expect(rows.length).to.be.greaterThan(0);

    // Check that the formula column exists in the first row
    const firstRow = rows[0];
    expect(firstRow).to.have.property('FormulaTable2Table1s');

    // The formula should return the table2_table1s lookup column value
    // Since table2_table1s is a lookup column that references T1s (which is a LTAR to table1),
    // the formula should contain the related table1 data
    expect(firstRow.FormulaTable2Table1s).to.exist;
    expect(JSON.stringify(firstRow.FormulaTable2Table1s)).to.eq(
      '["T1_006","T1_005","T1_004","T1_003","T1_002","T1_001"]',
    );
  });
}

export function formulaLookupLtarTest() {
  describe('BaseModelSql', formulaLookupLtarTests);
}
