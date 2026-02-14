import 'mocha';
import { expect } from 'chai';

import { UITypes } from 'nocodb-sdk';
import { createColumn } from '../factory/column';
import { listRow } from '../factory/row';
import { initCrossBaseModel } from './init';
import type { ICrossBaseTestContext } from './init';

/**
 * Creates a lookup column for cross-base links
 */
async function createCrossBaseLookupColumn(
  context: ICrossBaseTestContext['context'],
  {
    table,
    title,
    relationColumnId,
    lookupColumnId,
  }: {
    table: any;
    title: string;
    relationColumnId: string;
    lookupColumnId: string;
  },
) {
  const lookupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Lookup,
    fk_relation_column_id: relationColumnId,
    fk_lookup_column_id: lookupColumnId,
    table_name: table.table_name,
    column_name: title,
  });

  return lookupColumn;
}

/**
 * Creates a rollup column for cross-base links
 */
async function createCrossBaseRollupColumn(
  context: ICrossBaseTestContext['context'],
  {
    table,
    title,
    relationColumnId,
    rollupColumnId,
    rollupFunction,
  }: {
    table: any;
    title: string;
    relationColumnId: string;
    rollupColumnId: string;
    rollupFunction: string;
  },
) {
  const rollupColumn = await createColumn(context, table, {
    title: title,
    uidt: UITypes.Rollup,
    fk_relation_column_id: relationColumnId,
    fk_rollup_column_id: rollupColumnId,
    rollup_function: rollupFunction,
    table_name: table.table_name,
    column_name: title,
  });

  return rollupColumn;
}

function crossBaseFormulaTests() {
  let _context: ICrossBaseTestContext['context'];
  let _bases: ICrossBaseTestContext['bases'];
  let _tables: ICrossBaseTestContext['tables'];
  let _crossLinks: ICrossBaseTestContext['crossLinks'];
  let _contexts: ICrossBaseTestContext['contexts'];

  beforeEach(async function () {
    const setup = await initCrossBaseModel();
    _context = setup.context;
    _bases = setup.bases;
    _tables = setup.tables;
    _crossLinks = setup.crossLinks;
    _contexts = setup.contexts;
  });

  describe('Formula with Cross-Base Lookup', () => {
    it('should create formula referencing cross-base lookup', async () => {
      // First create a lookup column
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      await createCrossBaseLookupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseLookup',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        lookupColumnId: titleColumn.id,
      });

      // Create formula referencing the lookup
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'FormulaOnLookup',
        uidt: UITypes.Formula,
        formula: 'CONCAT({CrossBaseLookup}, " - computed")',
        formula_raw: 'CONCAT({CrossBaseLookup}, " - computed")',
      });

      expect(formulaCol).to.exist;
      expect(formulaCol.title).to.equal('FormulaOnLookup');

      // Get rows and verify formula values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.FormulaOnLookup).to.exist;
      expect(row1.FormulaOnLookup).to.include(' - computed');
    });

    it('should create formula with CONCAT on cross-base lookup', async () => {
      // Create lookup column
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      await createCrossBaseLookupColumn(_context, {
        table: _tables.t1_base1,
        title: 'LookupForConcat',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        lookupColumnId: titleColumn.id,
      });

      // Create formula with CONCAT
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'ConcatFormula',
        uidt: UITypes.Formula,
        formula: 'CONCAT("Links: ", {LookupForConcat})',
        formula_raw: 'CONCAT("Links: ", {LookupForConcat})',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.ConcatFormula).to.include('Links: ');
    });
  });

  describe('Formula with Cross-Base Rollup', () => {
    it('should create formula with arithmetic on cross-base rollup', async () => {
      // Create rollup column counting linked records
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'LinkCount',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        rollupColumnId: titleColumn.id,
        rollupFunction: 'count',
      });

      // Create formula doubling the count
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'DoubledCount',
        uidt: UITypes.Formula,
        formula: '{LinkCount} * 2',
        formula_raw: '{LinkCount} * 2',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1 has 3 links, so doubled should be 6
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.DoubledCount)).to.equal(6);

      // Row 2 has 2 links, so doubled should be 4
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.DoubledCount)).to.equal(4);
    });

    it('should create formula with SUM rollup from cross-base', async () => {
      // Get Amount column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      // Create rollup summing Amount
      await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'TotalAmount',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'sum',
      });

      // Create formula adding 100 to the sum
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'AmountPlus100',
        uidt: UITypes.Formula,
        formula: '{TotalAmount} + 100',
        formula_raw: '{TotalAmount} + 100',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1: sum(10, 20) = 30, plus 100 = 130
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.AmountPlus100)).to.equal(130);

      // Row 2: sum(20, 30, 40) = 90, plus 100 = 190
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.AmountPlus100)).to.equal(190);
    });

    it('should create formula with IF condition on cross-base rollup', async () => {
      // Create rollup column
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CountForIF',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        rollupColumnId: titleColumn.id,
        rollupFunction: 'count',
      });

      // Create formula with IF condition
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'HasManyLinks',
        uidt: UITypes.Formula,
        formula: 'IF({CountForIF} > 2, "Many", "Few")',
        formula_raw: 'IF({CountForIF} > 2, "Many", "Few")',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1 has 3 links (> 2) -> "Many"
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.HasManyLinks).to.equal('Many');

      // Row 2 has 2 links (not > 2) -> "Few"
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(row2.HasManyLinks).to.equal('Few');

      // Row 3 has 1 link (not > 2) -> "Few"
      const row3 = rows.find((r: any) => r.Id === 3);
      expect(row3.HasManyLinks).to.equal('Few');
    });
  });

  describe('Combined Formula with Lookup and Rollup', () => {
    it('should create formula combining local column and cross-base rollup', async () => {
      // Create rollup column
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'SumForCombined',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'sum',
      });

      // Create formula combining Title and rollup
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'CombinedFormula',
        uidt: UITypes.Formula,
        formula: 'CONCAT({Title}, " - Total: ", {SumForCombined})',
        formula_raw: 'CONCAT({Title}, " - Total: ", {SumForCombined})',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1: "B1T1_001 - Total: 30"
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.CombinedFormula).to.include('B1T1_001');
      expect(row1.CombinedFormula).to.include('Total:');
    });
  });

  describe('Formula Edge Cases', () => {
    it('should handle formula on unlinked rows', async () => {
      // Create rollup column
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CountForEdge',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        rollupColumnId: titleColumn.id,
        rollupFunction: 'count',
      });

      // Create formula
      const formulaCol = await createColumn(_context, _tables.t1_base1, {
        title: 'EdgeFormula',
        uidt: UITypes.Formula,
        formula: '{CountForEdge} + 1',
        formula_raw: '{CountForEdge} + 1',
      });

      expect(formulaCol).to.exist;

      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 10 has no links, count should be 0, formula should be 1
      const row10 = rows.find((r: any) => r.Id === 10);
      expect(Number(row10.EdgeFormula)).to.equal(1);
    });
  });
}

export function crossBaseFormulaTest() {
  describe('CrossBaseFormulaTest', crossBaseFormulaTests);
}
