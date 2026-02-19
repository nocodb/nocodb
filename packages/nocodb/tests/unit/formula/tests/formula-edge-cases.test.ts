import { expect } from 'chai';
import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { Source } from '../../../../src/models';
import { createColumn } from '../../factory/column';
import { listRow } from '../../factory/row';
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
  describe.skip('Empty String vs NULL', () => {
    it('LEN of empty string returns 0', async () => {
      // TODO: Implement test
      // 1. Create Text column with empty string values
      // 2. Create formula: LEN({TextCol})
      // 3. Verify LEN('') returns 0
    });

    it('LEN of NULL returns 0 (NULL treated as empty string)', async () => {
      // TODO: Implement test
      // 1. Create Text column with NULL values
      // 2. Create formula: LEN({TextCol})
      // 3. Verify LEN(NULL) returns 0 (NULL treated as empty string)
    });

    it('CONCAT with empty strings preserves other values', async () => {
      // TODO: Implement test
      // 1. Create formula: CONCAT("prefix", "", "suffix")
      // 2. Verify result is "prefixsuffix"
    });

    it('CONCAT with NULL behaves same as empty string', async () => {
      // TODO: Implement test
      // 1. Create Text column with both NULL and empty string values
      // 2. Create formula: CONCAT({TextCol}, "-end")
      // 3. Verify NULL and empty string produce same result: "-end"
    });

    it('IF condition with empty string is falsy', async () => {
      // TODO: Implement test
      // 1. Create Text column with empty string
      // 2. Create formula: IF({TextCol}, "truthy", "falsy")
      // 3. Verify empty string is treated as falsy
    });

    it('IF condition with NULL is falsy (treated as empty string)', async () => {
      // TODO: Implement test
      // 1. Create column with NULL value
      // 2. Create formula: IF({Col}, "truthy", "falsy")
      // 3. Verify NULL is treated as falsy (empty string)
    });

    it('BLANK function returns true for empty string', async () => {
      // TODO: Implement test
      // 1. Create Text column with empty string
      // 2. Create formula: BLANK({TextCol})
      // 3. Verify BLANK returns true for empty string
    });

    it('BLANK function returns true for NULL', async () => {
      // TODO: Implement test
      // 1. Create column with NULL value
      // 2. Create formula: BLANK({Col})
      // 3. Verify BLANK returns true for NULL (treated as empty string)
    });
  });

  // ============================================================
  // Numeric Edge Cases Tests (~12 tests)
  // NULL is treated as 0 for numeric operations
  // ============================================================
  describe.skip('Numeric Edge Cases', () => {
    // Division and modulo edge cases
    it('MOD with divisor zero handling', async () => {
      // TODO: Implement test
      // 1. Create formula: MOD(10, 0)
      // 2. Verify error handling or NULL/Infinity result
      // Note: NULL divisor would also trigger this (NULL treated as 0)
    });

    it('Division by zero handling', async () => {
      // TODO: Implement test
      // 1. Create formula: 10 / 0
      // 2. Verify error handling or NULL/Infinity result
      // Note: NULL divisor would also trigger this (NULL treated as 0)
    });

    it('Division by NULL (treated as 0) handling', async () => {
      // TODO: Implement test
      // 1. Create Number column with NULL values
      // 2. Create formula: 10 / {NumberCol}
      // 3. Verify division by NULL (treated as 0) behavior
    });

    // Negative number handling
    it('FLOOR with negative numbers', async () => {
      // TODO: Implement test
      // 1. Create formula: FLOOR(-2.5)
      // 2. Verify result is -3 (rounds toward negative infinity)
    });

    it('CEILING with negative numbers', async () => {
      // TODO: Implement test
      // 1. Create formula: CEILING(-2.5)
      // 2. Verify result is -2 (rounds toward positive infinity)
    });

    it('ROUND with negative numbers', async () => {
      // TODO: Implement test
      // 1. Create formula: ROUND(-2.5)
      // 2. Verify correct rounding behavior for negative numbers
    });

    it('ABS with negative numbers', async () => {
      // TODO: Implement test
      // 1. Create formula: ABS(-42)
      // 2. Verify result is 42
    });

    // Overflow and precision
    it('Very large number addition (overflow)', async () => {
      // TODO: Implement test
      // 1. Create formula with very large numbers: ADD(9999999999999999, 1)
      // 2. Verify behavior (precision loss or error)
    });

    it('Very large number multiplication (overflow)', async () => {
      // TODO: Implement test
      // 1. Create formula: MULTIPLY(9999999999999, 9999999999999)
      // 2. Verify behavior for potential overflow
    });

    it('Very small decimal precision', async () => {
      // TODO: Implement test
      // 1. Create formula: 0.1 + 0.2
      // 2. Verify precision handling (floating point issues)
    });

    it('Decimal precision in ROUND', async () => {
      // TODO: Implement test
      // 1. Create formula: ROUND(2.555, 2)
      // 2. Verify correct rounding with decimal precision
    });

    // Special values
    it('Formula result with Infinity', async () => {
      // TODO: Implement test
      // 1. Create formula that could produce Infinity
      // 2. Verify how Infinity is handled/displayed
    });

    it('Formula handling of NaN scenarios', async () => {
      // TODO: Implement test
      // 1. Create formula that could produce NaN (e.g., 0/0)
      // 2. Verify how NaN is handled
    });
  });
}

export function formulaEdgeCasesTest() {
  describe('FormulaEdgeCasesTest', formulaEdgeCasesTests);
}
