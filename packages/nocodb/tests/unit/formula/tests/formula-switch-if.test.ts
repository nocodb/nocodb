import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel } from '../initModel';
import { createColumn, createRollupColumn } from '../../factory/column';
import { listRow } from '../../factory/row';
import { isEE } from '../../utils/helpers';
import { Model } from '../../../../src/models';

/**
 * Story: Warehouse Inventory Management System
 *
 * A logistics company tracks inventory across warehouses using NocoDB.
 *
 * Data model (mapped to the shared initModel fixture):
 *   - Products   (Table1) — individual SKUs (T1_001 ... T1_040)
 *   - Warehouses (Table2) — storage locations (T2_001 ... T2_040)
 *   - Regions    (Table3) — geographic areas (T3_001 ... T3_040)
 *   - Suppliers  (Table4) — supplier companies (T4_000 ... T4_004, repeating)
 *
 * Relationships:
 *   Warehouse  HM -> Products   via "T1s"      (each warehouse stocks products)
 *   Warehouse  MM -> Products   via "T1_MMs"   (shared products across warehouses)
 *   Region     HM -> Warehouses via "T2s"      (each region has warehouses)
 *   Region     HM -> Suppliers  via "T4s"      (each region has suppliers)
 *   Region     OO -> Product    via "T1_OO"    (each region has a flagship product)
 *
 * Pre-seeded links:
 *   Warehouse 1 stocks products 1, 2, 3   (count = 3)
 *   Warehouse 2 stocks products 4, 5, 6   (count = 3)
 *   Warehouse 3 stocks product  7          (count = 1)
 *   Region 1 contains warehouses 1, 2
 *   Region 2 contains warehouse  3
 *   Region 1 has 20 suppliers
 *   Region 1 flagship = Product 1, Region 2 = Product 2, Region 3 = Product 3
 *   Warehouse 1 shares products 1, 2 across network (MM)
 *
 * Lookups:
 *   "table1Name"      on Warehouse -> Product names via T1s (HM)
 *   "table2_table1s"  on Region    -> Products through Warehouses (nested)
 *
 * The dashboard team builds formula columns to classify and label rows.
 * These tests verify that SWITCH and IF handle:
 *   1. Multi-value fields (HM / MM / OO Links, Lookups) — scalar aggregation
 *   2. Type mismatches between switch value and WHEN literals
 *   3. Rollup of Formula child columns — type resolution
 *   4. BLANK() WHEN clauses mixed with regular WHENs
 *   5. Nested / composed formulas (SWITCH inside IF, SWITCH inside CONCAT)
 */

function formulaSwitchIfTests() {
  let _context;
  let _ctx: { workspace_id: string; base_id: string };
  let _base;
  let _tables;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  // ---------------------------------------------------------------------------
  // Part 1 — Rollups & basic SWITCH/IF
  // The ops team wants a dashboard showing warehouse size classifications.
  // ---------------------------------------------------------------------------

  // Warehouse size label based on product count (Rollup).
  // Before fix: fnName='SWITCH' fell through to STRING_AGG -> "text = integer".
  it('Warehouse size label: SWITCH on numeric Rollup with integer WHENs', async () => {
    const source = (await _base.getSources())[0];

    await createColumn(_context, _tables.table1, {
      title: 'StatusCode',
      column_name: 'status_code',
      uidt: UITypes.Number,
    });

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'T1Count',
      rollupFunction: 'count',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'Title',
      ltarColumnId: t2_HM_t1.id,
    });

    // "0 products = Empty, 3 = Standard, 6 = Large, else Other"
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'StatusLabel',
      uidt: UITypes.Formula,
      formula: 'SWITCH({T1Count}, 0, "None", 3, "Some", 6, "Many", "Other")',
      formula_raw:
        'SWITCH({T1Count}, 0, "None", 3, "Some", 6, "Many", "Other")',
    });

    expect(formulaCol).to.exist;
    expect(formulaCol.uidt).to.equal(UITypes.Formula);

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1 & 2 each stock 3 products -> "Some"
    expect(rows[0].StatusLabel).to.equal('Some');
    expect(rows[1].StatusLabel).to.equal('Some');
    // Warehouse 3 stocks 1 product -> "Other"
    expect(rows[2].StatusLabel).to.equal('Other');
  });

  // Longest product-name length across a warehouse's products.
  // Rollup of Formula child column — before fix, extractColumnIdentifierType
  // returned undefined dataType for Formula children -> validation error.
  it('Max product-name length: Rollup of Formula child resolves type', async () => {
    const source = (await _base.getSources())[0];

    // Formula on Products: LEN({Title}) -> numeric
    await createColumn(_context, _tables.table1, {
      title: 'TitleLen',
      uidt: UITypes.Formula,
      formula: 'LEN({Title})',
      formula_raw: 'LEN({Title})',
    });

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'MaxTitleLen',
      rollupFunction: 'max',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'TitleLen',
      ltarColumnId: t2_HM_t1.id,
    });

    // +1 to use the rollup in an arithmetic formula
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'MaxTitleLenPlus1',
      uidt: UITypes.Formula,
      formula: '{MaxTitleLen} + 1',
      formula_raw: '{MaxTitleLen} + 1',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // LEN("T1_001") = 6, MAX across linked products = 6, +1 = 7
    expect(rows[0].MaxTitleLenPlus1).to.equal(7);
  });

  // ---------------------------------------------------------------------------
  // Part 2 — Multi-value fields (Links, Lookups)
  // The inventory team needs formulas that work on linked product lists.
  // ---------------------------------------------------------------------------

  // "Does this warehouse have any products?"
  // HM Link returns multiple values; SWITCH must aggregate to a scalar.
  it('Inventory check: SWITCH on HM Links field', async () => {
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LinkSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({T1s}, "", "Empty", "Has Links")',
      formula_raw: 'SWITCH({T1s}, "", "Empty", "Has Links")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1 stocks products 1,2,3 -> "Has Links"
    expect(rows[0].LinkSwitch).to.equal('Has Links');
  });

  // "Does this warehouse have inventory?" using IF truthiness on a link field.
  it('Inventory flag: IF on HM Links field', async () => {
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LinkIf',
      uidt: UITypes.Formula,
      formula: 'IF({T1s}, "Has Links", "No Links")',
      formula_raw: 'IF({T1s}, "Has Links", "No Links")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    expect(rows[0].LinkIf).to.equal('Has Links');
  });

  // "Does this warehouse share products across the network?" (MM link)
  // MM links also return multiple values; tests aggregation on MM specifically.
  it('Shared products flag: SWITCH on MM Links field', async () => {
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'MMSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({T1_MMs}, "", "No Shared", "Has Shared")',
      formula_raw: 'SWITCH({T1_MMs}, "", "No Shared", "Has Shared")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1 shares products 1,2 via MM -> "Has Shared"
    expect(rows[0].MMSwitch).to.equal('Has Shared');
  });

  // "Label the warehouse by its first product" using a Lookup.
  // Lookup returns string values; SWITCH matches against string literals.
  it('First-product label: SWITCH on Lookup field with matching types', async () => {
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LookupSwitch',
      uidt: UITypes.Formula,
      formula:
        'SWITCH({table1Name}, "T1_001", "First", "T1_002", "Second", "Other")',
      formula_raw:
        'SWITCH({table1Name}, "T1_001", "First", "T1_002", "Second", "Other")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;
    // Result depends on MIN aggregate of linked product titles
    expect(rows[0]).to.have.property('LookupSwitch');
  });

  // "Are product names populated for this warehouse?" using LEN on a Lookup.
  // Lookup returns multi-value data; LEN aggregates to scalar, then IF evaluates.
  it('Product-name check: IF with LEN on multi-value Lookup', async () => {
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LookupLenIf',
      uidt: UITypes.Formula,
      formula: 'IF(LEN({table1Name}) > 0, "Names Present", "No Names")',
      formula_raw:
        'IF(LEN({table1Name}) > 0, "Names Present", "No Names")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1 has linked products with titles -> LEN > 0
    expect(rows[0].LookupLenIf).to.equal('Names Present');
  });

  // "Label the region by its flagship product" (OO link — single value, not array).
  // Verifies SWITCH handles non-array link types (no aggregation needed).
  it('Flagship label: SWITCH on OO Link field', async () => {
    const formulaCol = await createColumn(_context, _tables.table3, {
      title: 'OOSwitch',
      uidt: UITypes.Formula,
      formula:
        'SWITCH({T1_OO}, "T1_001", "Alpha", "T1_002", "Beta", "Other")',
      formula_raw:
        'SWITCH({T1_OO}, "T1_001", "Alpha", "T1_002", "Beta", "Other")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table3 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Region 1 flagship = Product 1 -> "Alpha"
    expect(rows[0].OOSwitch).to.equal('Alpha');
    // Region 2 flagship = Product 2 -> "Beta"
    expect(rows[1].OOSwitch).to.equal('Beta');
    // Region 3 flagship = Product 3 -> "Other"
    expect(rows[2].OOSwitch).to.equal('Other');
  });

  // "Classify regions by nested product data" — Lookup through two link levels.
  // table2_table1s on Region looks up T1s (HM) through T2s (HM) — deeply nested.
  it('Nested inventory: SWITCH on two-level nested Lookup', async () => {
    const formulaCol = await createColumn(_context, _tables.table3, {
      title: 'NestedLookupSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({table2_table1s}, "", "No Products", "Has Products")',
      formula_raw:
        'SWITCH({table2_table1s}, "", "No Products", "Has Products")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table3 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Region 1 -> Warehouses 1,2 -> Products 1-6 -> "Has Products"
    expect(rows[0]).to.have.property('NestedLookupSwitch');
  });

  // ---------------------------------------------------------------------------
  // Part 3 — Type mismatches & BLANK handling
  // The data team imports messy data; formulas must handle type conflicts.
  // ---------------------------------------------------------------------------

  // Product code is text but WHEN values are numbers — PG type mismatch.
  // Before fix: PG errored with "operator does not exist: text = integer".
  it('Product code classifier: SWITCH with type mismatch casts to string', async () => {
    const formulaCol = await createColumn(_context, _tables.table1, {
      title: 'TypeMismatchSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({Title}, 0, "Zero", 1, "One", "Other")',
      formula_raw: 'SWITCH({Title}, 0, "Zero", 1, "One", "Other")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Title is "T1_001" etc — never matches 0 or 1, so all rows get "Other"
    expect(rows[0].TypeMismatchSwitch).to.equal('Other');
    expect(rows[1].TypeMismatchSwitch).to.equal('Other');
  });

  // Handle products with missing data — BLANK() as the only WHEN value.
  // Before fix: generated invalid SQL (CASE expr ELSE ... END without WHEN).
  it('Missing data handler: SWITCH with BLANK-only WHEN clause', async () => {
    const formulaCol = await createColumn(_context, _tables.table1, {
      title: 'BlankSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({Title}, BLANK(), "Empty", "Has Value")',
      formula_raw: 'SWITCH({Title}, BLANK(), "Empty", "Has Value")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Title is always populated -> "Has Value"
    expect(rows[0].BlankSwitch).to.equal('Has Value');
  });

  // Warehouse classification with null-safe fallback.
  // Mixes BLANK() (null check) with regular numeric WHENs in the same SWITCH.
  it('Null-safe classifier: SWITCH with mixed BLANK and numeric WHENs', async () => {
    const source = (await _base.getSources())[0];

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'T1Sum',
      rollupFunction: 'count',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'Title',
      ltarColumnId: t2_HM_t1.id,
    });

    // "null = No Data, 1 = Single item, 3 = Standard, else Other"
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'MixedBlankSwitch',
      uidt: UITypes.Formula,
      formula:
        'SWITCH({T1Sum}, BLANK(), "No Data", 1, "Single", 3, "Triple", "Other")',
      formula_raw:
        'SWITCH({T1Sum}, BLANK(), "No Data", 1, "Single", 3, "Triple", "Other")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1: count=3 -> "Triple", Warehouse 2: count=3 -> "Triple"
    expect(rows[0].MixedBlankSwitch).to.equal('Triple');
    expect(rows[1].MixedBlankSwitch).to.equal('Triple');
    // Warehouse 3: count=1 -> "Single"
    expect(rows[2].MixedBlankSwitch).to.equal('Single');
  });

  // ---------------------------------------------------------------------------
  // Part 4 — Composed & nested formulas
  // The analytics team builds complex dashboard formulas combining SWITCH/IF.
  // ---------------------------------------------------------------------------

  // "Is this a high-volume warehouse?" — arithmetic on rollup count in IF.
  it('Volume tier: IF with arithmetic on Rollup count', async () => {
    const source = (await _base.getSources())[0];

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'T1RollupCount',
      rollupFunction: 'count',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'Title',
      ltarColumnId: t2_HM_t1.id,
    });

    // count * 2 > 4 means "high volume" (3*2=6 > 4 yes, 1*2=2 > 4 no)
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'ArithLinkIf',
      uidt: UITypes.Formula,
      formula: 'IF({T1RollupCount} * 2 > 4, "High Volume", "Low Volume")',
      formula_raw:
        'IF({T1RollupCount} * 2 > 4, "High Volume", "Low Volume")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1: 3*2=6 > 4 -> "High Volume"
    expect(rows[0].ArithLinkIf).to.equal('High Volume');
    // Warehouse 3: 1*2=2, not > 4 -> "Low Volume"
    expect(rows[2].ArithLinkIf).to.equal('Low Volume');
  });

  // Detailed warehouse classification: IF checks for activity, then SWITCH
  // categorises by product count. Tests nested SWITCH inside IF.
  it('Detailed classification: nested SWITCH inside IF', async () => {
    const source = (await _base.getSources())[0];

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'T1LinkCount',
      rollupFunction: 'count',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'Title',
      ltarColumnId: t2_HM_t1.id,
    });

    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'NestedFormula',
      uidt: UITypes.Formula,
      formula:
        'IF({T1LinkCount}, SWITCH({T1LinkCount}, 1, "Single", 3, "Triple", "Multiple"), "None")',
      formula_raw:
        'IF({T1LinkCount}, SWITCH({T1LinkCount}, 1, "Single", 3, "Triple", "Multiple"), "None")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1: count=3 -> "Triple"
    expect(rows[0].NestedFormula).to.equal('Triple');
    expect(rows[1].NestedFormula).to.equal('Triple');
    // Warehouse 3: count=1 -> "Single"
    expect(rows[2].NestedFormula).to.equal('Single');
  });

  // Status report string: CONCAT wraps a SWITCH to build a human-readable label.
  // Tests that SWITCH output composes cleanly as a scalar inside string functions.
  it('Status report: CONCAT wrapping SWITCH on Rollup', async () => {
    const source = (await _base.getSources())[0];

    const t2_HM_t1 = (await _tables.table2.getColumns(_ctx)).find(
      (c) => c.title === 'T1s',
    );
    await createRollupColumn(_context, {
      base: _base,
      title: 'T1CountForConcat',
      rollupFunction: 'count',
      table: await Model.getByIdOrName(_ctx, {
        base_id: _base.id,
        source_id: source.id!,
        id: _tables.table2.id,
      }),
      relatedTableName: _tables.table1.table_name,
      relatedTableColumnTitle: 'Title',
      ltarColumnId: t2_HM_t1.id,
    });

    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'ConcatSwitch',
      uidt: UITypes.Formula,
      formula:
        'CONCAT("Status: ", SWITCH({T1CountForConcat}, 0, "Empty", 1, "Single", 3, "Standard", "Custom"))',
      formula_raw:
        'CONCAT("Status: ", SWITCH({T1CountForConcat}, 0, "Empty", 1, "Single", 3, "Standard", "Custom"))',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Warehouse 1: count=3 -> "Status: Standard"
    expect(rows[0].ConcatSwitch).to.equal('Status: Standard');
    // Warehouse 3: count=1 -> "Status: Single"
    expect(rows[2].ConcatSwitch).to.equal('Status: Single');
  });
}

export function formulaSwitchIfTest() {
  if (isEE()) {
    describe('FormulaSwitchIfTest', formulaSwitchIfTests);
  }
}
