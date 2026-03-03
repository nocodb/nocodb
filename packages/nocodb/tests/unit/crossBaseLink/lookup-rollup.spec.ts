import 'mocha';
import { expect } from 'chai';
import request from 'supertest';

import { UITypes } from 'nocodb-sdk';
import { createColumn } from '../factory/column';
import { listRow } from '../factory/row';
import { initCrossBaseModel } from './init';
import type { ICrossBaseTestContext } from './init';

/**
 * Creates a lookup column for cross-base links
 * Unlike the standard createLookupColumn, this handles cross-base relationships
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

/**
 * Helper function to fetch rows via API (to ensure fresh column data)
 */
async function fetchRowsViaApi(
  context: ICrossBaseTestContext['context'],
  base: ICrossBaseTestContext['bases']['base1'],
  table: ICrossBaseTestContext['tables']['t1_base1'],
) {
  const response = await request(context.app)
    .get(`/api/v1/db/data/noco/${base.id}/${table.id}`)
    .set('xc-auth', context.token);

  expect(response.status).to.equal(200);
  return response.body.list;
}

function crossBaseLookupRollupTests() {
  let _setup: ICrossBaseTestContext;
  let _context: ICrossBaseTestContext['context'];
  let _bases: ICrossBaseTestContext['bases'];
  let _tables: ICrossBaseTestContext['tables'];
  let _crossLinks: ICrossBaseTestContext['crossLinks'];
  let _contexts: ICrossBaseTestContext['contexts'];

  beforeEach(async function () {
    const setup = await initCrossBaseModel();
    _setup = setup;
    _context = setup.context;
    _bases = setup.bases;
    _tables = setup.tables;
    _crossLinks = setup.crossLinks;
    _contexts = setup.contexts;
  });

  describe('Cross-Base Lookup', () => {
    it('should lookup Title from cross-base linked table via HM', async () => {
      // Get the Title column from base2.table1
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      // Create lookup column on base1.table1 looking up Title via HM link
      const lookupCol = await createCrossBaseLookupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseLookupHM',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        lookupColumnId: titleColumn.id,
      });

      expect(lookupCol).to.exist;
      expect(lookupCol.title).to.equal('CrossBaseLookupHM');

      // Get rows via API to ensure fresh column data
      const rows = await fetchRowsViaApi(
        _context,
        _bases.base1,
        _tables.t1_base1,
      );

      // Row 1 is linked to B2T1_001, B2T1_002, B2T1_003
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.CrossBaseLookupHM).to.exist;

      // Lookup should return array of values or comma-separated string
      const lookupValue = row1.CrossBaseLookupHM;
      if (Array.isArray(lookupValue)) {
        expect(lookupValue).to.include('B2T1_001');
        expect(lookupValue).to.include('B2T1_002');
        expect(lookupValue).to.include('B2T1_003');
      } else {
        expect(lookupValue).to.include('B2T1_001');
      }
    });

    it('should lookup Title from cross-base linked table via MM', async () => {
      // Get the Title column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table2Columns.find(
        (col) => col.title === 'Title',
      );

      // Create lookup column on base1.table1 looking up Title via MM link
      const lookupCol = await createCrossBaseLookupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseLookupMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        lookupColumnId: titleColumn.id,
      });

      expect(lookupCol).to.exist;

      // Get rows via API to ensure fresh column data
      const rows = await fetchRowsViaApi(
        _context,
        _bases.base1,
        _tables.t1_base1,
      );

      // Row 1 is linked to B2T2_001, B2T2_002
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.CrossBaseLookupMM).to.exist;
    });

    it('should lookup Title from cross-base linked table via OO', async () => {
      // Get the Title column from base2.table1
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      // Create lookup column on base1.table2 looking up Title via OO link
      const lookupCol = await createCrossBaseLookupColumn(_context, {
        table: _tables.t2_base1,
        title: 'CrossBaseLookupOO',
        relationColumnId: _crossLinks.b1t2_OO_b2t1.id,
        lookupColumnId: titleColumn.id,
      });

      expect(lookupCol).to.exist;

      // Get rows via API to ensure fresh column data
      const rows = await fetchRowsViaApi(
        _context,
        _bases.base1,
        _tables.t2_base1,
      );

      // Row 1 is linked to B2T1_007
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(row1.CrossBaseLookupOO).to.exist;

      // OO lookup should return single value
      const lookupValue = row1.CrossBaseLookupOO;
      if (Array.isArray(lookupValue)) {
        expect(lookupValue[0]).to.equal('B2T1_007');
      } else {
        expect(lookupValue).to.equal('B2T1_007');
      }
    });
  });

  describe('Cross-Base Rollup', () => {
    it('should count cross-base linked records via HM', async () => {
      // Get the Title column from base2.table1 (for count)
      const base2Table1Columns = await _tables.t1_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table1Columns.find(
        (col) => col.title === 'Title',
      );

      // Create rollup column counting linked records
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseCountHM',
        relationColumnId: _crossLinks.b1t1_HM_b2t1.id,
        rollupColumnId: titleColumn.id,
        rollupFunction: 'count',
      });

      expect(rollupCol).to.exist;
      expect(rollupCol.title).to.equal('CrossBaseCountHM');

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1 is linked to 3 records, Row 2 to 2, Row 3 to 1
      const row1 = rows.find((r: any) => r.Id === 1);
      const row2 = rows.find((r: any) => r.Id === 2);
      const row3 = rows.find((r: any) => r.Id === 3);

      expect(Number(row1.CrossBaseCountHM)).to.equal(3);
      expect(Number(row2.CrossBaseCountHM)).to.equal(2);
      expect(Number(row3.CrossBaseCountHM)).to.equal(1);
    });

    it('should count cross-base linked records via MM', async () => {
      // Get the Title column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const titleColumn = base2Table2Columns.find(
        (col) => col.title === 'Title',
      );

      // Create rollup column counting linked records
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseCountMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: titleColumn.id,
        rollupFunction: 'count',
      });

      expect(rollupCol).to.exist;

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1 is linked to 2 records, Row 2 to 3
      const row1 = rows.find((r: any) => r.Id === 1);
      const row2 = rows.find((r: any) => r.Id === 2);

      expect(Number(row1.CrossBaseCountMM)).to.equal(2);
      expect(Number(row2.CrossBaseCountMM)).to.equal(3);
    });

    it('should sum values from cross-base linked table', async () => {
      // Get the Amount column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      // Create rollup column summing Amount values
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseSumMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'sum',
      });

      expect(rollupCol).to.exist;

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1 is linked to B2T2_001 (Amount=10), B2T2_002 (Amount=20)
      // Sum should be 30
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.CrossBaseSumMM)).to.equal(30);

      // Row 2 is linked to B2T2_002 (20), B2T2_003 (30), B2T2_004 (40)
      // Sum should be 90
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.CrossBaseSumMM)).to.equal(90);
    });

    it('should calculate average from cross-base linked table', async () => {
      // Get the Amount column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      // Create rollup column averaging Amount values
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseAvgMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'avg',
      });

      expect(rollupCol).to.exist;

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1: avg(10, 20) = 15
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.CrossBaseAvgMM)).to.equal(15);

      // Row 2: avg(20, 30, 40) = 30
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.CrossBaseAvgMM)).to.equal(30);
    });

    it('should find min value from cross-base linked table', async () => {
      // Get the Amount column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      // Create rollup column finding min Amount value
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseMinMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'min',
      });

      expect(rollupCol).to.exist;

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1: min(10, 20) = 10
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.CrossBaseMinMM)).to.equal(10);

      // Row 2: min(20, 30, 40) = 20
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.CrossBaseMinMM)).to.equal(20);
    });

    it('should find max value from cross-base linked table', async () => {
      // Get the Amount column from base2.table2
      const base2Table2Columns = await _tables.t2_base2.getColumns(
        _contexts.ctx2,
      );
      const amountColumn = base2Table2Columns.find(
        (col) => col.title === 'Amount',
      );

      // Create rollup column finding max Amount value
      const rollupCol = await createCrossBaseRollupColumn(_context, {
        table: _tables.t1_base1,
        title: 'CrossBaseMaxMM',
        relationColumnId: _crossLinks.b1t1_MM_b2t2.id,
        rollupColumnId: amountColumn.id,
        rollupFunction: 'max',
      });

      expect(rollupCol).to.exist;

      // Get rows and verify rollup values
      const rows = await listRow({
        base: _bases.base1,
        table: _tables.t1_base1,
      });

      // Row 1: max(10, 20) = 20
      const row1 = rows.find((r: any) => r.Id === 1);
      expect(Number(row1.CrossBaseMaxMM)).to.equal(20);

      // Row 2: max(20, 30, 40) = 40
      const row2 = rows.find((r: any) => r.Id === 2);
      expect(Number(row2.CrossBaseMaxMM)).to.equal(40);
    });
  });
}

export function crossBaseLookupRollupTest() {
  describe('CrossBaseLookupRollupTest', crossBaseLookupRollupTests);
}
