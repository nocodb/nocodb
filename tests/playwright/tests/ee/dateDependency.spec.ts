import { expect, test } from '@playwright/test';
import { Api, UITypes } from 'nocodb-sdk';
import setup, { NcContext, unsetup } from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { enableQuickRun } from '../../setup/db';

/**
 * Date Dependency feature — EE only.
 *
 * Coverage matrix:
 *  - Dialog: open / configure UI / save / delete
 *  - Field sync: start+end→duration, start+duration→end, end+duration→start
 *  - Propagation connection types: end-to-start, end-to-end, start-to-start, start-to-end
 *  - Buffer types: none, flexible, fixed
 *  - Include weekends toggle
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

async function configureDateDependency(
  api: Api<any>,
  context: NcContext,
  tableId: string,
  cols: Record<string, string>,
  overrides: Record<string, any> = {}
) {
  await api.internal.postOperation(
    context.workspace.id,
    context.base.id,
    { operation: 'updateDateDependency', fk_model_id: tableId },
    {
      is_active: true,
      fk_start_date_field_id: cols['StartDate'],
      fk_end_date_field_id: cols['EndDate'],
      fk_duration_field_id: cols['Duration'],
      dependency_buffer_type: 'none',
      ...overrides,
    }
  );
}

async function readRow(api: Api<any>, context: NcContext, tableId: string, rowId: number) {
  return api.dbTableRow.read('noco', context.base.id, tableId, rowId);
}

async function updateRow(api: Api<any>, context: NcContext, tableId: string, rowId: number, data: Record<string, any>) {
  return api.dbTableRow.update('noco', context.base.id, tableId, rowId, data);
}

// ─── Dialog tests ────────────────────────────────────────────────────────────

test.describe('Date Dependency — Dialog', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  let tableId: string;
  let cols: Record<string, string>;
  const tableName = 'DateDepDialog';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: 'http://localhost:8080/',
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: tableName,
      title: tableName,
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        { column_name: 'StartDate', title: 'StartDate', uidt: UITypes.Date },
        { column_name: 'EndDate', title: 'EndDate', uidt: UITypes.Date },
        { column_name: 'Duration', title: 'Duration', uidt: UITypes.Number },
      ],
    });

    tableId = table.id;
    cols = {};
    for (const c of table.columns ?? []) {
      if (c.title && c.id) cols[c.title] = c.id;
    }

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('open dialog from context menu', async () => {
    await dashboard.treeView.openTable({ title: tableName, baseTitle: context.base.title });
    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: tableName });

    const menuItem = dashboard.rootPage.getByTestId(`sidebar-table-date-dependency-${tableName}`);
    await expect(menuItem).toBeVisible();
    await menuItem.click();

    await expect(dashboard.rootPage.locator('.nc-modal-date-dependency')).toBeVisible();
  });

  test('configure via UI, save, and verify persistence', async () => {
    await dashboard.treeView.openTable({ title: tableName, baseTitle: context.base.title });
    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: tableName });
    await dashboard.rootPage.getByTestId(`sidebar-table-date-dependency-${tableName}`).click();

    const modal = dashboard.rootPage.locator('.nc-modal-date-dependency');
    await expect(modal).toBeVisible();

    // Turn on active toggle if needed
    const activeSwitch = modal.locator('.ant-switch').first();
    if ((await activeSwitch.getAttribute('aria-checked')) !== 'true') {
      await activeSwitch.click();
    }

    // Select fields via dropdowns.
    // Wait for each dropdown to close before opening the next to avoid
    // stale dropdown panels causing strict-mode violations.
    const selects = modal.locator('.ant-select');
    const pickOption = async (idx: number, label: string) => {
      await selects.nth(idx).click();
      const dropdown = dashboard.rootPage.locator('.ant-select-dropdown:visible').last();
      await dropdown.getByText(label, { exact: true }).click();
    };

    await pickOption(0, 'StartDate');
    await pickOption(1, 'EndDate');
    await pickOption(2, 'Duration');

    // Save — modal auto-closes on success
    await modal.locator('button').filter({ hasText: /save/i }).click();
    await modal.waitFor({ state: 'hidden' });

    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: tableName });
    await dashboard.rootPage.getByTestId(`sidebar-table-date-dependency-${tableName}`).click();

    const m2 = dashboard.rootPage.locator('.nc-modal-date-dependency');
    await expect(m2).toBeVisible();

    // Verify persisted selections
    await expect(m2.locator('.ant-select').nth(0).locator('.ant-select-selection-item')).toContainText('StartDate');
    await expect(m2.locator('.ant-select').nth(1).locator('.ant-select-selection-item')).toContainText('EndDate');
    await expect(m2.locator('.ant-select').nth(2).locator('.ant-select-selection-item')).toContainText('Duration');
  });

  test('deactivate rule via toggle', async () => {
    // Pre-configure via API
    await configureDateDependency(api, context, tableId, cols);

    await dashboard.treeView.openTable({ title: tableName, baseTitle: context.base.title });
    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: tableName });
    await dashboard.rootPage.getByTestId(`sidebar-table-date-dependency-${tableName}`).click();

    const modal = dashboard.rootPage.locator('.nc-modal-date-dependency');
    await expect(modal).toBeVisible();

    // Toggle off
    const activeSwitch = modal.locator('.ant-switch').first();
    await activeSwitch.click();

    // Save
    await modal.locator('button').filter({ hasText: /save/i }).click();
    await modal.waitFor({ state: 'hidden' });

    // Reopen and verify toggle is off
    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: tableName });
    await dashboard.rootPage.getByTestId(`sidebar-table-date-dependency-${tableName}`).click();

    const m2 = dashboard.rootPage.locator('.nc-modal-date-dependency');
    await expect(m2).toBeVisible();
    const switch2 = m2.locator('.ant-switch').first();
    await expect(switch2).toHaveAttribute('aria-checked', 'false');
  });

  test('toggle is_active off disables field sync', async () => {
    await configureDateDependency(api, context, tableId, cols);

    // Insert a row
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { StartDate: '2025-06-01', EndDate: '2025-06-10', Duration: 10 },
    ]);

    // Deactivate the rule
    await configureDateDependency(api, context, tableId, cols, { is_active: false });

    // Update row — duration should NOT be recomputed
    await updateRow(api, context, tableId, 1, { StartDate: '2025-06-01', EndDate: '2025-06-20' });
    const row = await readRow(api, context, tableId, 1);

    // Duration stays at 10 (not recomputed to 20) because rule is inactive
    expect(row['Duration']).toBe(10);
  });
});

// ─── Field sync tests ───────────────────────────────────────────────────────

test.describe('Date Dependency — Field Sync', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  let tableId: string;
  let cols: Record<string, string>;
  const tableName = 'DateDepSync';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: 'http://localhost:8080/',
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: tableName,
      title: tableName,
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        { column_name: 'StartDate', title: 'StartDate', uidt: UITypes.Date },
        { column_name: 'EndDate', title: 'EndDate', uidt: UITypes.Date },
        { column_name: 'Duration', title: 'Duration', uidt: UITypes.Number },
      ],
    });

    tableId = table.id;
    cols = {};
    for (const c of table.columns ?? []) {
      if (c.title && c.id) cols[c.title] = c.id;
    }

    await configureDateDependency(api, context, tableId, cols);

    // Seed row
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
    ]);

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('start + end → compute duration', async () => {
    // Change EndDate, only send StartDate + EndDate → Duration auto-computed
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-01',
      EndDate: '2025-01-20',
    });

    const row = await readRow(api, context, tableId, 1);
    // daysBetween(Jan 1, Jan 20) + 1 = 20
    expect(row['Duration']).toBe(20);
  });

  test('start + duration → compute end', async () => {
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-03-01',
      Duration: 5,
    });

    const row = await readRow(api, context, tableId, 1);
    // addDays(Mar 1, 5-1=4) → Mar 5
    expect(row['EndDate']).toBe('2025-03-05');
  });

  test('end + duration → compute start', async () => {
    await updateRow(api, context, tableId, 1, {
      EndDate: '2025-04-30',
      Duration: 10,
    });

    const row = await readRow(api, context, tableId, 1);
    // subtractDays(Apr 30, 10-1=9) → Apr 21
    expect(row['StartDate']).toBe('2025-04-21');
  });

  test('all three sent → duration recalculated from start+end', async () => {
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-05-01',
      EndDate: '2025-05-10',
      Duration: 999, // explicitly wrong — should be overridden
    });

    const row = await readRow(api, context, tableId, 1);
    // daysBetween(May 1, May 10) + 1 = 10
    expect(row['Duration']).toBe(10);
  });

  test('duration=1 means start equals end', async () => {
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-07-15',
      Duration: 1,
    });

    const row = await readRow(api, context, tableId, 1);
    // addDays(Jul 15, 0) → Jul 15
    expect(row['EndDate']).toBe('2025-07-15');
  });

  test('verify data in grid after field sync', async () => {
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-02-01',
      EndDate: '2025-02-15',
    });

    await dashboard.treeView.openTable({ title: tableName, baseTitle: context.base.title });

    // Verify cells show correct values
    await dashboard.grid.cell.verify({ index: 0, columnHeader: 'Duration', value: '15' });
  });
});

// ─── Include weekends tests ─────────────────────────────────────────────────

test.describe('Date Dependency — Include Weekends', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  let tableId: string;
  let cols: Record<string, string>;
  const tableName = 'DateDepWeekend';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: 'http://localhost:8080/',
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: tableName,
      title: tableName,
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        { column_name: 'StartDate', title: 'StartDate', uidt: UITypes.Date },
        { column_name: 'EndDate', title: 'EndDate', uidt: UITypes.Date },
        { column_name: 'Duration', title: 'Duration', uidt: UITypes.Number },
      ],
    });

    tableId = table.id;
    cols = {};
    for (const c of table.columns ?? []) {
      if (c.title && c.id) cols[c.title] = c.id;
    }

    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { StartDate: '2025-01-06', EndDate: '2025-01-12', Duration: 7 },
    ]);

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('include_weekends=true counts all days', async () => {
    await configureDateDependency(api, context, tableId, cols, { include_weekends: true });

    // Jan 6 (Mon) to Jan 12 (Sun) → 7 calendar days → duration = 7
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-06',
      EndDate: '2025-01-12',
    });

    const row = await readRow(api, context, tableId, 1);
    expect(row['Duration']).toBe(7);
  });

  test('include_weekends=false skips weekends', async () => {
    await configureDateDependency(api, context, tableId, cols, { include_weekends: false });

    // Jan 6 (Mon) to Jan 12 (Sun): weekdays = Mon–Fri = 5 business days + 1 = 5
    // daysBetween(Jan6, Jan12, skipWeekends) counts Mon,Tue,Wed,Thu,Fri = 5, + 1 = 6
    // Actually: daysBetween iterates from start to end, counting non-weekend days
    // Mon→Tue→Wed→Thu→Fri = 5 weekdays between Jan6–Jan12 (not counting Jan12 itself)
    // Then duration = daysBetween + 1 = 6
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-06',
      EndDate: '2025-01-12',
    });

    const row = await readRow(api, context, tableId, 1);
    expect(row['Duration']).toBe(6);
  });

  test('include_weekends=false: start + duration → end skips weekends', async () => {
    await configureDateDependency(api, context, tableId, cols, { include_weekends: false });

    // Start: Mon Jan 6, Duration: 6 → add 5 business days → Fri Jan 10? No:
    // addDays(Jan 6, 6-1=5, skipWeekends) → Mon+1=Tue, +2=Wed, +3=Thu, +4=Fri, +5=nextMon=Jan 13
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-06',
      Duration: 6,
    });

    const row = await readRow(api, context, tableId, 1);
    expect(row['EndDate']).toBe('2025-01-13');
  });
});

// ─── Propagation tests ──────────────────────────────────────────────────────
// These test cross-row cascading via the recursive CTE.
// Requires self-referencing HM link + connection type config.

test.describe('Date Dependency — Propagation', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  let tableId: string;
  let cols: Record<string, string>;
  const tableName = 'DateDepProp';

  async function createSelfLinkAndGetId(): Promise<string> {
    // Create a self-referencing HM link column (API returns void)
    await api.dbTableColumn.create(tableId, {
      title: 'Predecessor',
      uidt: UITypes.Links,
      parentId: tableId,
      childId: tableId,
      type: 'hm',
    });

    // Fetch columns to find the created link column's ID
    const tableMeta = await api.dbTable.read(tableId);
    const linkCol = tableMeta.columns?.find(c => c.title === 'Predecessor' && c.uidt === UITypes.Links);
    if (!linkCol?.id) throw new Error('Failed to find Predecessor link column after creation');
    return linkCol.id;
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

    api = new Api({
      baseURL: 'http://localhost:8080/',
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: tableName,
      title: tableName,
      columns: [
        { column_name: 'Id', title: 'Id', uidt: UITypes.ID },
        { column_name: 'Name', title: 'Name', uidt: UITypes.SingleLineText },
        { column_name: 'StartDate', title: 'StartDate', uidt: UITypes.Date },
        { column_name: 'EndDate', title: 'EndDate', uidt: UITypes.Date },
        { column_name: 'Duration', title: 'Duration', uidt: UITypes.Number },
      ],
    });

    tableId = table.id;
    cols = {};
    for (const c of table.columns ?? []) {
      if (c.title && c.id) cols[c.title] = c.id;
    }

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // ── Connection type matrix (fixed, buffer=0) ──────────────────────────
  //
  // Uses fixed + buffer=0 so every connection type ALWAYS shifts B.
  // Each test sets up overlapping dates so the shift actually happens.

  test('propagation: end-to-start (fixed, 0 buffer)', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 1-10 (dur=10), B: Jan 5-8 (dur=4, overlaps A)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-05', EndDate: '2025-01-08', Duration: 4 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-start',
      dependency_buffer_type: 'fixed',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's end to Jan 15
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-01', EndDate: '2025-01-15' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    // B.start = A.end + 0 + 1 = Jan 16; B.end = Jan 16 + (Jan 8 − Jan 5) = Jan 19
    expect(rowB['StartDate']).toBe('2025-01-16');
    expect(rowB['EndDate']).toBe('2025-01-19');
  });

  test('propagation: end-to-end (fixed, 0 buffer)', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 1-10, B: Jan 5-8 (B.end=8 < A.end=10)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-05', EndDate: '2025-01-08', Duration: 4 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-end',
      dependency_buffer_type: 'fixed',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's end to Jan 15
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-01', EndDate: '2025-01-15' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    // B.end = A.end + 0 = Jan 15; dur_diff = Jan 8 − Jan 5 = 3; B.start = Jan 15 − 3 = Jan 12
    expect(rowB['EndDate']).toBe('2025-01-15');
    expect(rowB['StartDate']).toBe('2025-01-12');
  });

  test('propagation: start-to-start (fixed, 0 buffer)', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 1-10, B: Jan 1-4 (same start — fixed will re-set)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-01', EndDate: '2025-01-04', Duration: 4 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'start-to-start',
      dependency_buffer_type: 'fixed',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's start to Jan 6
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-06', EndDate: '2025-01-15' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    // B.start = A.start + 0 = Jan 6; dur_diff = Jan 4 − Jan 1 = 3; B.end = Jan 6 + 3 = Jan 9
    expect(rowB['StartDate']).toBe('2025-01-06');
    expect(rowB['EndDate']).toBe('2025-01-09');
  });

  test('propagation: start-to-end (fixed, 0 buffer)', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 10-19, B: Jan 1-5 (B.end < A.start — will get aligned)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-10', EndDate: '2025-01-19', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-01', EndDate: '2025-01-05', Duration: 5 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'start-to-end',
      dependency_buffer_type: 'fixed',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's start to Jan 15
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-15', EndDate: '2025-01-24' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    // B.end = A.start + 0 = Jan 15; dur_diff = Jan 5 − Jan 1 = 4; B.start = Jan 15 − 4 = Jan 11
    expect(rowB['EndDate']).toBe('2025-01-15');
    expect(rowB['StartDate']).toBe('2025-01-11');
  });

  // ── Flexible mode tests — verify shift vs no-shift ───────────────────

  test('propagation: flexible no-shift when gap exists', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 1-10, B: Jan 20-25 (plenty of gap)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-20', EndDate: '2025-01-25', Duration: 6 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-start',
      dependency_buffer_type: 'flexible',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's end to Jan 15 — B.start=Jan 20 > Jan 15 → no shift
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-01', EndDate: '2025-01-15' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    expect(rowB['StartDate']).toBe('2025-01-20');
    expect(rowB['EndDate']).toBe('2025-01-25');
  });

  test('propagation: flexible shift when overlap exists', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A: Jan 1-10, B: Jan 8-12 (overlaps A.end)
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
      { Name: 'B', StartDate: '2025-01-08', EndDate: '2025-01-12', Duration: 5 },
    ]);
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-start',
      dependency_buffer_type: 'flexible',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Extend A's end to Jan 15 — B.start=Jan 8 ≤ Jan 15 → shift
    await updateRow(api, context, tableId, 1, { StartDate: '2025-01-01', EndDate: '2025-01-15' });
    await dashboard.rootPage.waitForTimeout(2000);

    const rowB = await readRow(api, context, tableId, 2);
    // B.start = Jan 16; dur_diff = Jan 12 − Jan 8 = 4; B.end = Jan 16 + 4 = Jan 20
    expect(rowB['StartDate']).toBe('2025-01-16');
    expect(rowB['EndDate']).toBe('2025-01-20');
  });

  // Buffer type tests
  for (const bufferType of ['flexible', 'fixed'] as const) {
    test(`propagation: end-to-start with ${bufferType} buffer (3 days)`, async () => {
      const linkColId = await createSelfLinkAndGetId();

      await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
        { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-10', Duration: 10 },
        { Name: 'B', StartDate: '2025-01-20', EndDate: '2025-01-25', Duration: 6 },
      ]);

      await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

      await configureDateDependency(api, context, tableId, cols, {
        fk_dependency_linkrow_field_id: linkColId,
        dependency_connection_type: 'end-to-start',
        dependency_buffer_type: bufferType,
        dependency_buffer_days: 3,
        include_weekends: true,
      });

      // Trigger propagation by updating A
      await updateRow(api, context, tableId, 1, {
        StartDate: '2025-01-01',
        EndDate: '2025-01-10',
      });

      await dashboard.rootPage.waitForTimeout(2000);

      const rowB = await readRow(api, context, tableId, 2);

      if (bufferType === 'fixed') {
        // Fixed: B.start = A.end + buffer + 1 = Jan 10 + 3 + 1 = Jan 14
        // B.end = Jan 14 + 5 = Jan 19
        expect(rowB['StartDate']).toBe('2025-01-14');
        expect(rowB['EndDate']).toBe('2025-01-19');
      } else {
        // Flexible: B.start (Jan 20) is already > A.end (Jan 10) + 3 buffer
        // So no shift needed
        expect(rowB['StartDate']).toBe('2025-01-20');
        expect(rowB['EndDate']).toBe('2025-01-25');
      }
    });
  }

  test('propagation: chain of 3 rows cascades through', async () => {
    const linkColId = await createSelfLinkAndGetId();

    // A → B → C chain
    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-05', Duration: 5 },
      { Name: 'B', StartDate: '2025-01-06', EndDate: '2025-01-10', Duration: 5 },
      { Name: 'C', StartDate: '2025-01-11', EndDate: '2025-01-15', Duration: 5 },
    ]);

    // A → B, B → C
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');
    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 2, 'hm', 'Predecessor', '3');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-start',
      dependency_buffer_type: 'flexible',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Move A's end forward by 5 days
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-01',
      EndDate: '2025-01-10',
    });

    await dashboard.rootPage.waitForTimeout(3000);

    const rowB = await readRow(api, context, tableId, 2);
    const rowC = await readRow(api, context, tableId, 3);

    // B should start after A ends (Jan 10) → Jan 11
    expect(rowB['StartDate']).toBe('2025-01-11');
    expect(rowB['EndDate']).toBe('2025-01-15');

    // C should start after B ends (Jan 15) → Jan 16
    expect(rowC['StartDate']).toBe('2025-01-16');
    expect(rowC['EndDate']).toBe('2025-01-20');
  });

  test('propagation: verify data visible in grid', async () => {
    const linkColId = await createSelfLinkAndGetId();

    await api.dbTableRow.bulkCreate('noco', context.base.id, tableId, [
      { Name: 'A', StartDate: '2025-01-01', EndDate: '2025-01-05', Duration: 5 },
      { Name: 'B', StartDate: '2025-01-02', EndDate: '2025-01-04', Duration: 3 },
    ]);

    await api.dbTableRow.nestedAdd('noco', context.base.id, tableId, 1, 'hm', 'Predecessor', '2');

    await configureDateDependency(api, context, tableId, cols, {
      fk_dependency_linkrow_field_id: linkColId,
      dependency_connection_type: 'end-to-start',
      dependency_buffer_type: 'fixed',
      dependency_buffer_days: 0,
      include_weekends: true,
    });

    // Trigger propagation
    await updateRow(api, context, tableId, 1, {
      StartDate: '2025-01-01',
      EndDate: '2025-01-05',
    });

    await dashboard.rootPage.waitForTimeout(2000);

    // Open the table and verify grid shows updated B
    await dashboard.treeView.openTable({ title: tableName, baseTitle: context.base.title });

    // Row B (index 1): start=Jan 6, end=Jan 8 (3 day duration preserved)
    await dashboard.grid.cell.verify({ index: 1, columnHeader: 'Name', value: 'B' });

    const rowB = await readRow(api, context, tableId, 2);
    expect(rowB['StartDate']).toBe('2025-01-06');
    expect(rowB['EndDate']).toBe('2025-01-08');
  });
});
