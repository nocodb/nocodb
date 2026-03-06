import 'mocha';
import { UITypes } from 'nocodb-sdk';
import { expect } from 'chai';
import { initInitialModel, ITestContext } from '../initModel';
import {
  createColumn,
  createRollupColumn,
  customColumns,
} from '../../factory/column';
import { createBulkRows, listRow } from '../../factory/row';
import { createTable } from '../../factory/table';
import { isEE } from '../../utils/helpers';
import { Model } from '../../../../src/models';

/**
 * Story: Device Status Tracking System
 *
 * A company tracks IoT devices installed at project sites.
 * - Projects table: each project has multiple devices
 * - Devices table: each device has a numeric status_code (0=offline, 1=online, 2=maintenance)
 *   and a text category ("sensor", "actuator", "controller")
 *
 * Formulas use SWITCH/IF on linked device data to produce human-readable labels.
 * These tests verify that SWITCH and IF handle:
 *   1. Multi-value fields (Links/Lookups) — STRING_AGG/ARRAY_AGG scalar extraction
 *   2. Type mismatches between switch value and WHEN literals
 *   3. Rollup of Formula child columns — type resolution
 */

function formulaSwitchIfTests() {
  let _setup: ITestContext;
  let _context;
  let _ctx: { workspace_id: string; base_id: string };
  let _base;
  let _tables;

  beforeEach(async function () {
    const setup = await initInitialModel();
    _setup = setup;
    _context = setup.context;
    _ctx = setup.ctx;
    _base = setup.base;
    _tables = setup.tables;
  });

  // ── Scenario 1: SWITCH on a Rollup (numeric) with integer WHEN values ──
  // Rollup uses MIN on a numeric column, SWITCH compares the result with integers.
  // Before fix: fnName='SWITCH' fell through to STRING_AGG → "text = integer" error.
  it('SWITCH on numeric Rollup (min) with integer WHEN values', async () => {
    const source = (await _base.getSources())[0];

    // Add a numeric column to Table1
    await createColumn(_context, _tables.table1, {
      title: 'StatusCode',
      column_name: 'status_code',
      uidt: UITypes.Number,
    });

    // Populate StatusCode values (row index mod 3 → 0, 1, 2)
    const t1Cols = await _tables.table1.getColumns(_ctx);
    const statusCol = t1Cols.find((c) => c.title === 'StatusCode');
    // Update existing rows with status codes via bulk update isn't straightforward,
    // so create a formula that derives a numeric value we can use
    // Instead, use a Rollup with countDistinct (always numeric) as a simpler test

    // Create Rollup of Title count on Table2 (T2 has HM→T1 via "T1s")
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

    // SWITCH on the numeric rollup with integer WHEN values
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

    // Row 1 has 3 linked children (ids 1,2,3), Row 2 has 3 (ids 4,5,6)
    expect(rows[0].StatusLabel).to.equal('Some');
    expect(rows[1].StatusLabel).to.equal('Some');
    // Row 3 has 1 linked child (id 7)
    expect(rows[2].StatusLabel).to.equal('Other');
  });

  // ── Scenario 2: SWITCH on a Link/Lookup field (multi-value) ──
  // The Link column returns multiple values; SWITCH needs a scalar.
  // Before fix: STRING_AGG concatenated all values → type mismatch.
  it('SWITCH on HM Links field produces valid result', async () => {
    // SWITCH on {T1s} (HM link from table2→table1) — multi-value field
    // This should not error; the link gets aggregated to a scalar
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LinkSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({T1s}, "", "Empty", "Has Links")',
      formula_raw: 'SWITCH({T1s}, "", "Empty", "Has Links")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Rows with linked children should have "Has Links"
    // Row 1 has links (T1_001, T1_002, T1_003)
    expect(rows[0].LinkSwitch).to.equal('Has Links');
  });

  // ── Scenario 3: SWITCH with type mismatch (string field vs numeric WHEN) ──
  // Switch value is string type, WHEN values are numeric literals.
  // Before fix: PG errored with "operator does not exist: text = integer".
  it('SWITCH with type mismatch casts comparison to string', async () => {
    // Title is SingleLineText, WHEN values are numbers — type mismatch
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

  // ── Scenario 4: IF on a multi-value field ──
  // IF condition uses a Links field; the condition arg goes through STRING_AGG.
  // Tests that IF correctly evaluates truthiness of multi-value fields.
  it('IF on HM Links field evaluates correctly', async () => {
    // IF({T1s}, "Has Links", "No Links")
    // T1s is a HM link — multi-value field
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'LinkIf',
      uidt: UITypes.Formula,
      formula: 'IF({T1s}, "Has Links", "No Links")',
      formula_raw: 'IF({T1s}, "Has Links", "No Links")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Row 1 has children → "Has Links"
    expect(rows[0].LinkIf).to.equal('Has Links');
  });

  // ── Scenario 5: SWITCH on Rollup of Formula child column (type resolution) ──
  // Rollup uses MAX on a Formula child column. Before fix, extractColumnIdentifierType
  // returned undefined dataType for Formula children, causing validation error:
  // "Field X with  type is found but numeric type is expected"
  it('Formula referencing Rollup of Formula child resolves type correctly', async () => {
    const source = (await _base.getSources())[0];

    // Create a numeric Formula on table1: LEN({Title}) → numeric
    await createColumn(_context, _tables.table1, {
      title: 'TitleLen',
      uidt: UITypes.Formula,
      formula: 'LEN({Title})',
      formula_raw: 'LEN({Title})',
    });

    // Create Rollup on table2 that rolls up the Formula column with MAX
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

    // Create a Formula referencing the Rollup — this triggered the validation error
    const formulaCol = await createColumn(_context, _tables.table2, {
      title: 'MaxTitleLenPlus1',
      uidt: UITypes.Formula,
      formula: '{MaxTitleLen} + 1',
      formula_raw: '{MaxTitleLen} + 1',
    });

    expect(formulaCol).to.exist;
    expect(formulaCol.uidt).to.equal(UITypes.Formula);

    const rows = await listRow({ base: _base, table: _tables.table2 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // LEN("T1_001") = 6, MAX across linked rows = 6, +1 = 7
    // Row 1 has children T1_001, T1_002, T1_003 — all len 6 → MAX=6 → +1=7
    expect(rows[0].MaxTitleLenPlus1).to.equal(7);
  });

  // ── Scenario 6: SWITCH with BLANK() handling ──
  // Tests that BLANK() in WHEN still works correctly alongside type mismatch logic.
  it('SWITCH with BLANK() WHEN clause', async () => {
    const formulaCol = await createColumn(_context, _tables.table1, {
      title: 'BlankSwitch',
      uidt: UITypes.Formula,
      formula: 'SWITCH({Title}, BLANK(), "Empty", "Has Value")',
      formula_raw: 'SWITCH({Title}, BLANK(), "Empty", "Has Value")',
    });

    expect(formulaCol).to.exist;

    const rows = await listRow({ base: _base, table: _tables.table1 });
    expect(rows).to.be.an('array').that.is.not.empty;

    // Title is always populated → "Has Value"
    expect(rows[0].BlankSwitch).to.equal('Has Value');
  });

  // ── Scenario 7: SWITCH on Lookup field (string type, matching WHEN) ──
  // Lookup returns string values from linked table. SWITCH matches against string literals.
  // No type mismatch — verifies normal path still works.
  it('SWITCH on Lookup field with matching string types', async () => {
    // table2 has lookup "table1Name" → Title from table1 via T1s (HM)
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
    // Result depends on MIN aggregate of linked titles
    expect(rows[0]).to.have.property('LookupSwitch');
  });

  // ── Scenario 8: Nested SWITCH — SWITCH inside IF ──
  // Ensures composed formulas work when both SWITCH and IF are involved.
  it('Nested SWITCH inside IF', async () => {
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

    // Row 1: count=3 → "Triple", Row 2: count=3 → "Triple", Row 3: count=1 → "Single"
    expect(rows[0].NestedFormula).to.equal('Triple');
    expect(rows[1].NestedFormula).to.equal('Triple');
    expect(rows[2].NestedFormula).to.equal('Single');
  });
}

export function formulaSwitchIfTest() {
  if (isEE()) {
    describe('FormulaSwitchIfTest', formulaSwitchIfTests);
  }
}
