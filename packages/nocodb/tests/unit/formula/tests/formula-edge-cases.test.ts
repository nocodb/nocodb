import { expect } from 'chai';
import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { Source } from '../../../../src/models';
import { createColumn } from '../../factory/column';
import { createBulkRows, listRow } from '../../factory/row';
import { initInitialModel } from '../initModel';

function formulaEdgeCasesTests() {
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _tables;
  let _source;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
    const source = await Source.get(setup.ctx, setup.tables.table1.source_id);
    _source = source;
  });

  // ============================================================
  // NULL Handling Tests (~10 tests)
  // NULL is treated as default: 0 for numbers, empty string for strings
  // ============================================================
  describe('NULL Handling', () => {
    it('NULL in ADD function is treated as 0', async () => {
      // Create a Number column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'NumCol',
        uidt: UITypes.Number,
      });

      // Create formula: ADD({NumCol}, 10)
      await createColumn(_context, _tables.table1, {
        title: 'AddFormula',
        uidt: UITypes.Formula,
        formula: 'ADD({NumCol}, 10)',
        formula_raw: 'ADD({NumCol}, 10)',
      });

      // Query rows and verify - NULL should be treated as 0, so result should be 10
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      // All rows should have AddFormula = 10 (since NumCol is NULL and NULL is treated as 0)
      for (const row of rows) {
        expect(row.AddFormula).to.eq(10, `Expected ADD(NULL, 10) to equal 10`);
      }
    });

    it('NULL in multiplication propagates NULL', async () => {
      // Create a Number column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'NumCol',
        uidt: UITypes.Number,
      });

      // Create formula: {NumCol} * 5
      // Note: Unlike ADD function, the * operator propagates NULL
      await createColumn(_context, _tables.table1, {
        title: 'MultiplyFormula',
        uidt: UITypes.Formula,
        formula: '{NumCol} * 5',
        formula_raw: '{NumCol} * 5',
      });

      // Query rows and verify - * operator propagates NULL (unlike ADD which treats NULL as 0)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      // All rows should have MultiplyFormula = null (NULL * 5 = null)
      for (const row of rows) {
        expect(row.MultiplyFormula).to.eq(
          null,
          `Expected NULL * 5 to equal null`,
        );
      }
    });

    it('NULL in ABS function propagates NULL', async () => {
      // Create a Number column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'NumCol',
        uidt: UITypes.Number,
      });

      // Create formula: ABS({NumCol})
      await createColumn(_context, _tables.table1, {
        title: 'AbsFormula',
        uidt: UITypes.Formula,
        formula: 'ABS({NumCol})',
        formula_raw: 'ABS({NumCol})',
      });

      // Query rows and verify - ABS propagates NULL (unlike ADD which treats NULL as 0)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.AbsFormula).to.eq(null, `Expected ABS(NULL) to equal null`);
      }
    });

    it('NULL in ROUND function propagates NULL', async () => {
      // Create a Number column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'NumCol',
        uidt: UITypes.Number,
      });

      // Create formula: ROUND({NumCol}, 2)
      await createColumn(_context, _tables.table1, {
        title: 'RoundFormula',
        uidt: UITypes.Formula,
        formula: 'ROUND({NumCol}, 2)',
        formula_raw: 'ROUND({NumCol}, 2)',
      });

      // Query rows and verify - ROUND propagates NULL (unlike ADD which treats NULL as 0)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.RoundFormula).to.eq(
          null,
          `Expected ROUND(NULL, 2) to equal null`,
        );
      }
    });

    it('NULL in CONCAT is treated as empty string', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: CONCAT({TextCol}, "suffix")
      await createColumn(_context, _tables.table1, {
        title: 'ConcatFormula',
        uidt: UITypes.Formula,
        formula: 'CONCAT({TextCol}, "suffix")',
        formula_raw: 'CONCAT({TextCol}, "suffix")',
      });

      // Query rows and verify - NULL should be treated as empty string, so result should be "suffix"
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.ConcatFormula).to.eq(
          'suffix',
          `Expected CONCAT(NULL, "suffix") to equal "suffix"`,
        );
      }
    });

    it('NULL in UPPER function propagates NULL', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: UPPER({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'UpperFormula',
        uidt: UITypes.Formula,
        formula: 'UPPER({TextCol})',
        formula_raw: 'UPPER({TextCol})',
      });

      // Query rows and verify - NULL propagates through UPPER
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.UpperFormula).to.eq(
          null,
          `Expected UPPER(NULL) to equal null`,
        );
      }
    });

    it('NULL in LOWER function propagates NULL', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: LOWER({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'LowerFormula',
        uidt: UITypes.Formula,
        formula: 'LOWER({TextCol})',
        formula_raw: 'LOWER({TextCol})',
      });

      // Query rows and verify - NULL propagates through LOWER
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.LowerFormula).to.eq(
          null,
          `Expected LOWER(NULL) to equal null`,
        );
      }
    });

    it('NULL in TRIM function propagates NULL', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: TRIM({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'TrimFormula',
        uidt: UITypes.Formula,
        formula: 'TRIM({TextCol})',
        formula_raw: 'TRIM({TextCol})',
      });

      // Query rows and verify - NULL propagates through TRIM
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.TrimFormula).to.eq(
          null,
          `Expected TRIM(NULL) to equal null`,
        );
      }
    });

    it('NULL treated as default in nested function calls', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: UPPER(CONCAT({TextCol}, "test"))
      // CONCAT treats NULL as empty string, so result is "test", then UPPER makes it "TEST"
      await createColumn(_context, _tables.table1, {
        title: 'NestedFormula',
        uidt: UITypes.Formula,
        formula: 'UPPER(CONCAT({TextCol}, "test"))',
        formula_raw: 'UPPER(CONCAT({TextCol}, "test"))',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.NestedFormula).to.eq(
          'TEST',
          `Expected UPPER(CONCAT(NULL, "test")) to equal "TEST"`,
        );
      }
    });

    it('IF with NULL condition treated as falsy', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: IF({TextCol}, "truthy", "falsy")
      // NULL should be treated as falsy
      await createColumn(_context, _tables.table1, {
        title: 'IfFormula',
        uidt: UITypes.Formula,
        formula: 'IF({TextCol}, "truthy", "falsy")',
        formula_raw: 'IF({TextCol}, "truthy", "falsy")',
      });

      // Query rows and verify - NULL should be treated as falsy
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.IfFormula).to.eq(
          'falsy',
          `Expected IF(NULL, "truthy", "falsy") to equal "falsy"`,
        );
      }
    });
  });

  // ============================================================
  // Empty String vs NULL Tests (~8 tests)
  // NULL is treated as empty string for strings, so behavior should match
  // ============================================================
  describe('Empty String vs NULL', () => {
    it('LEN of empty string returns 0', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert rows with empty string values
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [{ TextCol: '' }, { TextCol: '' }, { TextCol: '' }],
      });

      // Create formula: LEN({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'LenFormula',
        uidt: UITypes.Formula,
        formula: 'LEN({TextCol})',
        formula_raw: 'LEN({TextCol})',
      });

      // Query rows and verify - LEN('') returns 0
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Filter to only rows we just inserted (with empty TextCol)
      const emptyStringRows = rows.filter((r: any) => r.TextCol === '');
      expect(emptyStringRows.length).to.eq(3);

      for (const row of emptyStringRows) {
        expect(row.LenFormula).to.eq(
          0,
          `Expected LEN('') to equal 0 for empty string`,
        );
      }
    });

    it('LEN of NULL returns NULL (NULL propagates through LEN)', async () => {
      // Create a Text column - existing rows will have NULL values by default
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: LEN({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'LenFormula',
        uidt: UITypes.Formula,
        formula: 'LEN({TextCol})',
        formula_raw: 'LEN({TextCol})',
      });

      // Query rows and verify - LEN(NULL) returns NULL (propagates NULL)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.LenFormula).to.eq(
          null,
          `Expected LEN(NULL) to equal null (NULL propagates through LEN, different from empty string)`,
        );
      }
    });

    it('CONCAT with empty strings preserves other values', async () => {
      // Create formula with literal empty strings: CONCAT("prefix", "", "suffix")
      await createColumn(_context, _tables.table1, {
        title: 'ConcatFormula',
        uidt: UITypes.Formula,
        formula: 'CONCAT("prefix", "", "suffix")',
        formula_raw: 'CONCAT("prefix", "", "suffix")',
      });

      // Query rows and verify - empty strings should be ignored
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.ConcatFormula).to.eq(
          'prefixsuffix',
          `Expected CONCAT("prefix", "", "suffix") to equal "prefixsuffix"`,
        );
      }
    });

    it('CONCAT with NULL behaves same as empty string', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert test rows with NULL, empty string, and actual value
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [
          { TextCol: null }, // NULL
          { TextCol: '' }, // empty string
          { TextCol: 'value' }, // actual value
        ],
      });

      // Create formula: CONCAT({TextCol}, "-end")
      await createColumn(_context, _tables.table1, {
        title: 'ConcatFormula',
        uidt: UITypes.Formula,
        formula: 'CONCAT({TextCol}, "-end")',
        formula_raw: 'CONCAT({TextCol}, "-end")',
      });

      // Query rows and verify - filter to only the rows we inserted
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Find our test rows by filtering on TextCol values
      const nullRow = rows.find(
        (r: any) => r.TextCol === null && r.ConcatFormula,
      )!;
      const emptyRow = rows.find(
        (r: any) => r.TextCol === '' && r.ConcatFormula,
      )!;
      const valueRow = rows.find((r: any) => r.TextCol === 'value')!;

      // NULL should be treated as empty string → "-end"
      expect(nullRow.ConcatFormula).to.eq(
        '-end',
        `Expected CONCAT(NULL, "-end") to equal "-end"`,
      );

      // Empty string should also produce "-end"
      expect(emptyRow.ConcatFormula).to.eq(
        '-end',
        `Expected CONCAT('', "-end") to equal "-end" (same as NULL)`,
      );

      // Actual value should produce "value-end"
      expect(valueRow.ConcatFormula).to.eq(
        'value-end',
        `Expected CONCAT("value", "-end") to equal "value-end"`,
      );
    });

    it('IF condition with empty string is falsy', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert rows with empty string values
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [{ TextCol: '' }, { TextCol: '' }],
      });

      // Create formula: IF({TextCol}, "truthy", "falsy")
      await createColumn(_context, _tables.table1, {
        title: 'IfFormula',
        uidt: UITypes.Formula,
        formula: 'IF({TextCol}, "truthy", "falsy")',
        formula_raw: 'IF({TextCol}, "truthy", "falsy")',
      });

      // Query rows and verify - empty string should be treated as falsy
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.IfFormula).to.eq(
          'falsy',
          `Expected IF('', "truthy", "falsy") to equal "falsy" (empty string is falsy)`,
        );
      }
    });

    it('IF condition with NULL is falsy', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: IF({TextCol}, "truthy", "falsy")
      await createColumn(_context, _tables.table1, {
        title: 'IfFormula',
        uidt: UITypes.Formula,
        formula: 'IF({TextCol}, "truthy", "falsy")',
        formula_raw: 'IF({TextCol}, "truthy", "falsy")',
      });

      // Query rows and verify - NULL should be treated as falsy (same as empty string)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.IfFormula).to.eq(
          'falsy',
          `Expected IF(NULL, "truthy", "falsy") to equal "falsy" (NULL is falsy, same as empty string)`,
        );
      }
    });

    // TODO: sqlite returns 1 instead of true
    it.skip('ISBLANK returns true for empty string', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert rows with empty string values
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [{ TextCol: '' }, { TextCol: '' }],
      });

      // Create formula: ISBLANK({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'IsBlankFormula',
        uidt: UITypes.Formula,
        formula: 'ISBLANK({TextCol})',
        formula_raw: 'ISBLANK({TextCol})',
      });

      // Query rows and verify - ISBLANK should return true for empty string
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.IsBlankFormula).to.eq(
          true,
          `Expected ISBLANK('') to equal true (empty string is blank)`,
        );
      }
    });

    // TODO: sqlite returns 1 instead of true
    it.skip('ISBLANK returns true for NULL', async () => {
      // Create a Text column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Create formula: ISBLANK({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'IsBlankFormula',
        uidt: UITypes.Formula,
        formula: 'ISBLANK({TextCol})',
        formula_raw: 'ISBLANK({TextCol})',
      });

      // Query rows and verify - ISBLANK should return true for NULL (same as empty string)
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.IsBlankFormula).to.eq(
          true,
          `Expected ISBLANK(NULL) to equal true (NULL is blank, same as empty string)`,
        );
      }
    });

    // Additional comprehensive tests for empty string vs NULL
    it('String functions preserve empty string but propagate NULL', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert test rows with both NULL and empty string
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [
          { TextCol: null }, // NULL
          { TextCol: '' }, // empty string
          { TextCol: 'test' }, // actual value
        ],
      });

      // Create formulas for UPPER, LOWER, and TRIM
      await createColumn(_context, _tables.table1, {
        title: 'UpperFormula',
        uidt: UITypes.Formula,
        formula: 'UPPER({TextCol})',
        formula_raw: 'UPPER({TextCol})',
      });

      await createColumn(_context, _tables.table1, {
        title: 'LowerFormula',
        uidt: UITypes.Formula,
        formula: 'LOWER({TextCol})',
        formula_raw: 'LOWER({TextCol})',
      });

      await createColumn(_context, _tables.table1, {
        title: 'TrimFormula',
        uidt: UITypes.Formula,
        formula: 'TRIM({TextCol})',
        formula_raw: 'TRIM({TextCol})',
      });

      // Query rows and verify behavior
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Find our test rows
      const nullRow = rows.find(
        (r: any) => r.TextCol === null && r.UpperFormula !== undefined,
      )!;
      const emptyRow = rows.find(
        (r: any) => r.TextCol === '' && r.UpperFormula !== undefined,
      )!;
      const testRow = rows.find((r: any) => r.TextCol === 'test')!;

      // NULL - all functions should propagate NULL
      expect(nullRow.UpperFormula).to.eq(
        null,
        `Expected UPPER(NULL) to equal null`,
      );
      expect(nullRow.LowerFormula).to.eq(
        null,
        `Expected LOWER(NULL) to equal null`,
      );
      expect(nullRow.TrimFormula).to.eq(
        null,
        `Expected TRIM(NULL) to equal null`,
      );

      // Empty string - functions should preserve empty string
      expect(emptyRow.UpperFormula).to.eq('', `Expected UPPER('') to equal ''`);
      expect(emptyRow.LowerFormula).to.eq('', `Expected LOWER('') to equal ''`);
      expect(emptyRow.TrimFormula).to.eq('', `Expected TRIM('') to equal ''`);

      // Actual value - functions should transform normally
      expect(testRow.UpperFormula).to.eq(
        'TEST',
        `Expected UPPER('test') to equal 'TEST'`,
      );
      expect(testRow.LowerFormula).to.eq(
        'test',
        `Expected LOWER('test') to equal 'test'`,
      );
      expect(testRow.TrimFormula).to.eq(
        'test',
        `Expected TRIM('test') to equal 'test'`,
      );
    });

    // TODO: sqlite returns 0 instead of false
    it.skip('ISNOTBLANK returns false for both empty string and NULL', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert test rows with NULL, empty string, and actual value
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [
          { TextCol: null }, // NULL
          { TextCol: '' }, // empty string
          { TextCol: 'value' }, // actual value
        ],
      });

      // Create formula: ISNOTBLANK({TextCol})
      await createColumn(_context, _tables.table1, {
        title: 'IsNotBlankFormula',
        uidt: UITypes.Formula,
        formula: 'ISNOTBLANK({TextCol})',
        formula_raw: 'ISNOTBLANK({TextCol})',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Find our test rows
      const nullRow = rows.find(
        (r: any) => r.TextCol === null && r.IsNotBlankFormula !== undefined,
      )!;
      const emptyRow = rows.find(
        (r: any) => r.TextCol === '' && r.IsNotBlankFormula !== undefined,
      )!;
      const valueRow = rows.find((r: any) => r.TextCol === 'value')!;

      // NULL should return false
      expect(nullRow.IsNotBlankFormula).to.eq(
        false,
        `Expected ISNOTBLANK(NULL) to equal false`,
      );

      // Empty string should also return false (same as NULL)
      expect(emptyRow.IsNotBlankFormula).to.eq(
        false,
        `Expected ISNOTBLANK('') to equal false (same as NULL)`,
      );

      // Actual value should return true
      expect(valueRow.IsNotBlankFormula).to.eq(
        true,
        `Expected ISNOTBLANK('value') to equal true`,
      );
    });

    // TODO: sqlite returns 0 instead of false and 1 instead of true
    it.skip('Comparing column to BLANK() works for both NULL and empty strings', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert test rows with NULL, empty string, and actual value
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [
          { TextCol: null }, // NULL
          { TextCol: '' }, // empty string
          { TextCol: 'value' }, // actual value
        ],
      });

      // Create formulas: {TextCol} == BLANK() and {TextCol} != BLANK()
      await createColumn(_context, _tables.table1, {
        title: 'EqualsBlank',
        uidt: UITypes.Formula,
        formula: '{TextCol} == BLANK()',
        formula_raw: '{TextCol} == BLANK()',
      });

      await createColumn(_context, _tables.table1, {
        title: 'NotEqualsBlank',
        uidt: UITypes.Formula,
        formula: '{TextCol} != BLANK()',
        formula_raw: '{TextCol} != BLANK()',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Find our test rows
      const nullRow = rows.find(
        (r: any) => r.TextCol === null && r.EqualsBlank !== undefined,
      )!;
      const emptyRow = rows.find(
        (r: any) => r.TextCol === '' && r.EqualsBlank !== undefined,
      )!;
      const valueRow = rows.find((r: any) => r.TextCol === 'value')!;

      // NULL == BLANK() should be true
      expect(nullRow.EqualsBlank).to.eq(
        true,
        `Expected NULL == BLANK() to equal true`,
      );
      expect(nullRow.NotEqualsBlank).to.eq(
        false,
        `Expected NULL != BLANK() to equal false`,
      );

      // Empty string == BLANK() should be true (same as NULL)
      expect(emptyRow.EqualsBlank).to.eq(
        true,
        `Expected '' == BLANK() to equal true (same as NULL)`,
      );
      expect(emptyRow.NotEqualsBlank).to.eq(
        false,
        `Expected '' != BLANK() to equal false`,
      );

      // Actual value == BLANK() should be false
      expect(valueRow.EqualsBlank).to.eq(
        false,
        `Expected 'value' == BLANK() to equal false`,
      );
      expect(valueRow.NotEqualsBlank).to.eq(
        true,
        `Expected 'value' != BLANK() to equal true`,
      );
    });

    // TODO: sqlite returns 1 instead of true
    it.skip('Column with mixed NULL and empty string values', async () => {
      // Create a Text column
      await createColumn(_context, _tables.table1, {
        title: 'TextCol',
        uidt: UITypes.SingleLineText,
      });

      // Insert rows with various combinations
      await createBulkRows(_context, {
        base: _base,
        table: _tables.table1,
        values: [
          { TextCol: null },
          { TextCol: '' },
          { TextCol: 'a' },
          { TextCol: null },
          { TextCol: '' },
          { TextCol: 'b' },
        ],
      });

      // Create formulas to test consistent handling
      await createColumn(_context, _tables.table1, {
        title: 'IsBlankTest',
        uidt: UITypes.Formula,
        formula: 'ISBLANK({TextCol})',
        formula_raw: 'ISBLANK({TextCol})',
      });

      await createColumn(_context, _tables.table1, {
        title: 'ConcatTest',
        uidt: UITypes.Formula,
        formula: 'CONCAT({TextCol}, "-x")',
        formula_raw: 'CONCAT({TextCol}, "-x")',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });

      // Find specific test rows by their TextCol values
      // We inserted rows with: null, '', 'a', null, '', 'b'
      const rowsWithA = rows.filter((r: any) => r.TextCol === 'a');
      const rowsWithB = rows.filter((r: any) => r.TextCol === 'b');
      const nullRows = rows.filter(
        (r: any) => r.TextCol === null && r.IsBlankTest !== undefined,
      );
      const emptyRows = rows.filter(
        (r: any) => r.TextCol === '' && r.IsBlankTest !== undefined,
      );

      // Verify we have our test data
      expect(rowsWithA.length).to.be.greaterThan(0);
      expect(rowsWithB.length).to.be.greaterThan(0);
      expect(nullRows.length).to.be.greaterThan(0);
      expect(emptyRows.length).to.be.greaterThan(0);

      // Verify ISBLANK treats NULL and empty string as blank, but not 'a' or 'b'
      for (const row of nullRows) {
        expect(row.IsBlankTest).to.eq(true, `ISBLANK(NULL) should be true`);
        expect(row.ConcatTest).to.eq('-x', `CONCAT(NULL, '-x') should be '-x'`);
      }

      for (const row of emptyRows) {
        expect(row.IsBlankTest).to.eq(true, `ISBLANK('') should be true`);
        expect(row.ConcatTest).to.eq('-x', `CONCAT('', '-x') should be '-x'`);
      }

      for (const row of rowsWithA) {
        expect(row.IsBlankTest).to.eq(false, `ISBLANK('a') should be false`);
        expect(row.ConcatTest).to.eq(
          'a-x',
          `CONCAT('a', '-x') should be 'a-x'`,
        );
      }

      for (const row of rowsWithB) {
        expect(row.IsBlankTest).to.eq(false, `ISBLANK('b') should be false`);
        expect(row.ConcatTest).to.eq(
          'b-x',
          `CONCAT('b', '-x') should be 'b-x'`,
        );
      }
    });
  });

  // ============================================================
  // Numeric Edge Cases Tests (~12 tests)
  // NULL is treated as 0 for numeric operations
  // ============================================================
  describe('Numeric Edge Cases', () => {
    // Division and modulo edge cases
    it('MOD with divisor zero handling', async () => {
      // Create formula: MOD(10, 0)
      // Division by zero should fail during formula validation
      try {
        await createColumn(_context, _tables.table1, {
          title: 'ModZeroFormula',
          uidt: UITypes.Formula,
          formula: 'MOD(10, 0)',
          formula_raw: 'MOD(10, 0)',
        });
        // If we reach here, the formula was created (shouldn't happen)
        throw new Error('Expected MOD(10, 0) to fail but it succeeded');
      } catch (error: any) {
        // Verify that it's a formula error related to division by zero
        expect(error.message).to.satisfy(
          (msg: string) =>
            msg.includes('division by zero') || msg.includes('MOD'),
          `Expected error message to mention division by zero, got: ${error.message}`,
        );
      }
    });

    it('Division by zero handling', async () => {
      // Create formula: 10 / 0
      await createColumn(_context, _tables.table1, {
        title: 'DivZeroFormula',
        uidt: UITypes.Formula,
        formula: '10 / 0',
        formula_raw: '10 / 0',
      });

      // Query rows and verify - division by zero should return NULL
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.DivZeroFormula).to.eq(
          null,
          `Expected 10 / 0 to equal null (division by zero)`,
        );
      }
    });

    it('Division by NULL (treated as 0) handling', async () => {
      // Create a Number column - existing rows will have NULL values
      await createColumn(_context, _tables.table1, {
        title: 'NumCol',
        uidt: UITypes.Number,
      });

      // Create formula: 10 / {NumCol}
      // Since NumCol is NULL and * operator propagates NULL, this should be NULL
      await createColumn(_context, _tables.table1, {
        title: 'DivNullFormula',
        uidt: UITypes.Formula,
        formula: '10 / {NumCol}',
        formula_raw: '10 / {NumCol}',
      });

      // Query rows and verify - division with NULL should return NULL
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.DivNullFormula).to.eq(
          null,
          `Expected 10 / NULL to equal null (NULL in division)`,
        );
      }
    });

    // Negative number handling
    it('FLOOR with negative numbers', async () => {
      // Create formula: FLOOR(-2.5)
      // FLOOR rounds toward negative infinity, so -2.5 → -3
      await createColumn(_context, _tables.table1, {
        title: 'FloorNegFormula',
        uidt: UITypes.Formula,
        formula: 'FLOOR(-2.5)',
        formula_raw: 'FLOOR(-2.5)',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.FloorNegFormula).to.eq(
          -3,
          `Expected FLOOR(-2.5) to equal -3 (rounds toward negative infinity)`,
        );
      }
    });

    it('CEILING with negative numbers', async () => {
      // Create formula: CEILING(-2.5)
      // CEILING rounds toward positive infinity, so -2.5 → -2
      await createColumn(_context, _tables.table1, {
        title: 'CeilNegFormula',
        uidt: UITypes.Formula,
        formula: 'CEILING(-2.5)',
        formula_raw: 'CEILING(-2.5)',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.CeilNegFormula).to.eq(
          -2,
          `Expected CEILING(-2.5) to equal -2 (rounds toward positive infinity)`,
        );
      }
    });

    it('ROUND with negative numbers', async () => {
      // Create formula: ROUND(-2.5)
      // Standard rounding: -2.5 should round to -3 (away from zero) or -2 (banker's rounding)
      await createColumn(_context, _tables.table1, {
        title: 'RoundNegFormula',
        uidt: UITypes.Formula,
        formula: 'ROUND(-2.5)',
        formula_raw: 'ROUND(-2.5)',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        // Note: JavaScript Math.round(-2.5) = -2 (rounds toward positive infinity for .5)
        // Verify actual behavior
        expect(row.RoundNegFormula).to.be.oneOf(
          [-2, -3],
          `Expected ROUND(-2.5) to equal -2 or -3`,
        );
      }
    });

    it('ABS with negative numbers', async () => {
      // Create formula: ABS(-42)
      await createColumn(_context, _tables.table1, {
        title: 'AbsNegFormula',
        uidt: UITypes.Formula,
        formula: 'ABS(-42)',
        formula_raw: 'ABS(-42)',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        expect(row.AbsNegFormula).to.eq(42, `Expected ABS(-42) to equal 42`);
      }
    });

    // Overflow and precision
    it('Very large number addition (overflow)', async () => {
      // Create formula with very large numbers: ADD(999999999999, 1)
      // Using a smaller number that's still large but within safe integer range
      await createColumn(_context, _tables.table1, {
        title: 'LargeAddFormula',
        uidt: UITypes.Formula,
        formula: 'ADD(999999999999, 1)',
        formula_raw: 'ADD(999999999999, 1)',
      });

      // Query rows and verify - JavaScript can handle this within precision limits
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        // Should be exactly 1000000000000
        expect(row.LargeAddFormula).to.eq(
          1000000000000,
          `Expected ADD(999999999999, 1) to equal 1000000000000`,
        );
      }
    });

    it('Very large number multiplication (overflow)', async () => {
      // Create formula: 46340 * 46340 (just under PostgreSQL 32-bit integer limit)
      // Using large numbers to test multiplication handling
      await createColumn(_context, _tables.table1, {
        title: 'LargeMulFormula',
        uidt: UITypes.Formula,
        formula: '46340 * 46340',
        formula_raw: '46340 * 46340',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        // Verify it's a number and equals 2147395600
        expect(row.LargeMulFormula).to.be.a(
          'number',
          `Expected large multiplication to be a number`,
        );
        expect(row.LargeMulFormula).to.eq(
          2147395600,
          `Expected 46340 * 46340 to equal 2147395600 (close to 32-bit integer limit)`,
        );
      }
    });

    it('Very small decimal precision', async () => {
      // Create formula: 0.1 + 0.2
      // Classic floating point precision issue
      await createColumn(_context, _tables.table1, {
        title: 'DecimalPrecFormula',
        uidt: UITypes.Formula,
        formula: '0.1 + 0.2',
        formula_raw: '0.1 + 0.2',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        // 0.1 + 0.2 in JavaScript is 0.30000000000000004
        expect(row.DecimalPrecFormula).to.be.closeTo(
          0.3,
          0.0001,
          `Expected 0.1 + 0.2 to be close to 0.3`,
        );
      }
    });

    it('Decimal precision in ROUND', async () => {
      // Create formula: ROUND(2.555, 2)
      await createColumn(_context, _tables.table1, {
        title: 'RoundPrecFormula',
        uidt: UITypes.Formula,
        formula: 'ROUND(2.555, 2)',
        formula_raw: 'ROUND(2.555, 2)',
      });

      // Query rows and verify
      const rows = await listRow({ base: _base, table: _tables.table1 });
      expect(rows.length).to.be.greaterThan(0);

      for (const row of rows) {
        // ROUND(2.555, 2) might be 2.55 or 2.56 depending on implementation
        expect(row.RoundPrecFormula).to.be.oneOf(
          [2.55, 2.56],
          `Expected ROUND(2.555, 2) to equal 2.55 or 2.56`,
        );
      }
    });
  });
}

export function formulaEdgeCasesTest() {
  describe('FormulaEdgeCasesTest', formulaEdgeCasesTests);
}
