import { expect } from 'chai';
import 'mocha';
import { ClientType } from 'nocodb-sdk';
import { initInitialModel } from '../initModel';
import type { Knex } from 'knex';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { PGDBQueryClient } from '~/dbQueryClient/pg';

function pgMassUpdateTest() {
  let _setup;
  let _context;
  let _ctx: {
    workspace_id: string;
    base_id: string;
  };
  let _base;
  let _source;
  let _knex: any;
  let testTableName: string;

  beforeEach(async () => {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    const source = (await _base.getSources())[0];
    _source = source;
    _knex = await NcConnectionMgrv2.get(source);

    // Create a test table for mass update operations
    testTableName = 'test_mass_update_' + Date.now();

    if (_source!.type === ClientType.PG) {
      await _knex.schema.createTable(
        testTableName,
        (table: Knex.TableBuilder) => {
          table.integer('id').primary();
          table.string('base_id');
          table.string('title');
          table.boolean('show');
          table.integer('order');
        },
      );
    }
  });

  afterEach(async () => {
    // Clean up test table
    if (_source!.type === ClientType.PG && testTableName) {
      // await _knex.schema.dropTableIfExists(testTableName);
    }
  });

  it('should perform basic mass update with all columns', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      { id: 1, base_id: 'base1', title: 'Title 1', show: true, order: 1 },
      { id: 2, base_id: 'base1', title: 'Title 2', show: false, order: 2 },
      { id: 3, base_id: 'base1', title: 'Title 3', show: true, order: 3 },
    ]);

    // Perform mass update
    const updateData = [
      {
        id: 1,
        base_id: 'base1',
        title: 'Updated Title 1',
        show: false,
        order: 10,
      },
      {
        id: 2,
        base_id: 'base1',
        title: 'Updated Title 2',
        show: true,
        order: 20,
      },
      {
        id: 3,
        base_id: 'base1',
        title: 'Updated Title 3',
        show: false,
        order: 30,
      },
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    // Verify updates
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(3);
    expect(results[0].title).to.eq('Updated Title 1');
    expect(results[0].show).to.eq(false);
    expect(results[0].order).to.eq(10);
    expect(results[1].title).to.eq('Updated Title 2');
    expect(results[1].show).to.eq(true);
    expect(results[1].order).to.eq(20);
    expect(results[2].title).to.eq('Updated Title 3');
    expect(results[2].show).to.eq(false);
    expect(results[2].order).to.eq(30);
  });

  it('should handle partial updates (undefined values preserved)', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      {
        id: 1,
        base_id: 'base1',
        title: 'Original Title 1',
        show: true,
        order: 1,
      },
      {
        id: 2,
        base_id: 'base1',
        title: 'Original Title 2',
        show: false,
        order: 2,
      },
    ]);

    // Update only title, leave show and order undefined (should preserve existing values)
    const updateData = [
      { id: 1, base_id: 'base1', title: 'New Title 1' },
      { id: 2, base_id: 'base1', order: 99 },
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    // Verify partial updates
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(2);

    // Row 1: title updated, show and order preserved
    expect(results[0].title).to.eq('New Title 1');
    expect(results[0].show).to.eq(true); // Preserved
    expect(results[0].order).to.eq(1); // Preserved

    // Row 2: order updated, title and show preserved
    expect(results[1].title).to.eq('Original Title 2'); // Preserved
    expect(results[1].show).to.eq(false); // Preserved
    expect(results[1].order).to.eq(99);
  });

  it('should handle empty data array gracefully', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      { id: 1, base_id: 'base1', title: 'Title 1', show: true, order: 1 },
    ]);

    // Call massUpdate with empty array
    const result = await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: [],
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    expect(result).to.eq(null);

    // Verify data unchanged
    const results = await _knex(testTableName);
    expect(results.length).to.eq(1);
    expect(results[0].title).to.eq('Title 1');
  });

  it('should skip rows with missing primary key values', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      { id: 1, base_id: 'base1', title: 'Title 1', show: true, order: 1 },
      { id: 2, base_id: 'base1', title: 'Title 2', show: false, order: 2 },
      { id: 3, base_id: 'base1', title: 'Title 3', show: true, order: 3 },
    ]);

    // Try to update, but include rows with missing PKs (should be skipped)
    const updateData = [
      { id: 1, base_id: 'base1', title: 'Updated Title 1', show: false },
      { id: null, base_id: 'base1', title: 'Should be skipped', show: true }, // Missing id
      { id: 2, base_id: null, title: 'Also skipped', show: false }, // Missing base_id
      { id: 3, base_id: 'base1', title: 'Updated Title 3', show: false },
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    // Verify only valid rows were updated
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(3);
    expect(results[0].title).to.eq('Updated Title 1');
    expect(results[1].title).to.eq('Title 2'); // Unchanged (PK was null)
    expect(results[2].title).to.eq('Updated Title 3');
  });

  it('should handle single primary key column', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      { id: 1, base_id: 'base1', title: 'Title 1', show: true, order: 1 },
      { id: 2, base_id: 'base1', title: 'Title 2', show: false, order: 2 },
    ]);

    // Update using only 'id' as primary key
    const updateData = [
      { id: 1, title: 'Single PK Update 1', show: false },
      { id: 2, title: 'Single PK Update 2', show: true },
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show'],
      primaryKeyColumns: ['id'], // Single PK
    });

    // Verify updates
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(2);
    expect(results[0].title).to.eq('Single PK Update 1');
    expect(results[0].show).to.eq(false);
    expect(results[1].title).to.eq('Single PK Update 2');
    expect(results[1].show).to.eq(true);
  });

  it('should handle large dataset efficiently', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert 100 rows
    const initialData = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      base_id: 'base1',
      title: `Title ${i + 1}`,
      show: i % 2 === 0,
      order: i + 1,
    }));

    await _knex(testTableName).insert(initialData);

    // Update all 100 rows
    const updateData = initialData.map((row, i) => ({
      id: row.id,
      base_id: row.base_id,
      title: `Updated ${i + 1}`,
      show: i % 3 === 0,
      order: (i + 1) * 10,
    }));

    const startTime = Date.now();
    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });
    const duration = Date.now() - startTime;

    // Verify updates
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(100);
    expect(results[0].title).to.eq('Updated 1');
    expect(results[0].order).to.eq(10);
    expect(results[49].title).to.eq('Updated 50');
    expect(results[49].order).to.eq(500);
    expect(results[99].title).to.eq('Updated 100');
    expect(results[99].order).to.eq(1000);

    // Performance check - should be faster than individual updates
    // (100 updates should complete in reasonable time, typically < 1000ms)
    expect(duration).to.be.lessThan(5000);
  });

  it('should handle rows with all undefined update columns', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      {
        id: 1,
        base_id: 'base1',
        title: 'Original Title 1',
        show: true,
        order: 1,
      },
      {
        id: 2,
        base_id: 'base1',
        title: 'Original Title 2',
        show: false,
        order: 2,
      },
    ]);

    // Update with all columns undefined (should preserve all values)
    const updateData = [
      { id: 1, base_id: 'base1' }, // All update columns undefined
      { id: 2, base_id: 'base1', title: 'Updated Title 2' }, // Partial update
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    // Verify
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(2);

    // Row 1: All original values preserved
    expect(results[0].title).to.eq('Original Title 1');
    expect(results[0].show).to.eq(true);
    expect(results[0].order).to.eq(1);

    // Row 2: Only title updated
    expect(results[1].title).to.eq('Updated Title 2');
    expect(results[1].show).to.eq(false);
    expect(results[1].order).to.eq(2);
  });

  it('should handle mixed scenarios (full, partial, skipped)', async () => {
    if (_source!.type !== ClientType.PG) {
      return;
    }

    // Insert initial data
    await _knex(testTableName).insert([
      { id: 1, base_id: 'base1', title: 'Title 1', show: true, order: 1 },
      { id: 2, base_id: 'base1', title: 'Title 2', show: false, order: 2 },
      { id: 3, base_id: 'base1', title: 'Title 3', show: true, order: 3 },
      { id: 4, base_id: 'base1', title: 'Title 4', show: false, order: 4 },
    ]);

    // Mixed update scenarios
    const updateData = [
      {
        id: 1,
        base_id: 'base1',
        title: 'Full Update',
        show: false,
        order: 100,
      }, // Full update
      { id: 2, base_id: 'base1', title: 'Partial Update' }, // Partial (show, order undefined)
      { id: null, base_id: 'base1', title: 'Skipped' }, // Skipped (missing PK)
      { id: 4, base_id: 'base1' }, // All update columns undefined
    ];

    await new PGDBQueryClient().massUpdate({
      knex: _knex,
      tableName: testTableName,
      data: updateData,
      updatingColumns: ['title', 'show', 'order'],
      primaryKeyColumns: ['id', 'base_id'],
    });

    // Verify results
    const results = await _knex(testTableName).orderBy('id');
    expect(results.length).to.eq(4);

    // Row 1: Full update
    expect(results[0].title).to.eq('Full Update');
    expect(results[0].show).to.eq(false);
    expect(results[0].order).to.eq(100);

    // Row 2: Partial update
    expect(results[1].title).to.eq('Partial Update');
    expect(results[1].show).to.eq(false); // Preserved
    expect(results[1].order).to.eq(2); // Preserved

    // Row 3: Unchanged (skipped in update)
    expect(results[2].title).to.eq('Title 3');
    expect(results[2].show).to.eq(true);
    expect(results[2].order).to.eq(3);

    // Row 4: All preserved
    expect(results[3].title).to.eq('Title 4');
    expect(results[3].show).to.eq(false);
    expect(results[3].order).to.eq(4);
  });
}

export function pgMassUpdateTests() {
  describe('PGMassUpdateTest', pgMassUpdateTest);
}
