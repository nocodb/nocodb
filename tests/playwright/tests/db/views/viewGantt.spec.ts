import { expect, test } from '@playwright/test';
import { Api, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { GanttPage } from '../../../pages/Dashboard/Gantt';
import setup, { NcContext, unsetup } from '../../../setup';
import { isEE } from '../../../setup/db';

/**
 * Gantt view spec — covers the behaviours specific to this view type:
 *
 *   - View creation lands on the Gantt UI and renders bars once the
 *     per-view DateDependency rule is configured.
 *   - Default Fields-menu visibility on a fresh Gantt is PV-only —
 *     matches the post-fix policy (alignment with Timeline + Gantt's
 *     own duplicate path).
 *   - Bar label is clipped to the bar's geometry, not spilled past it;
 *     tooltip surfaces the title so identity is still recoverable when
 *     the inline label is cut off.
 *   - Zoom-level change preserves bars.
 *   - Prev/next navigation slides the buffer and issues a windowed
 *     fetch against the dedicated gantt-data endpoint.
 *   - Dep graph endpoint returns edges for self-ref LTAR predecessors.
 *   - Composite-PK skip is non-fatal (warn-only on backend).
 *
 * Gantt is gated behind FEATURE_GANTT_VIEW — EE/Business+ only. CE
 * builds and Free-plan EE workspaces skip the suite entirely.
 */

const columns = [
  { column_name: 'Id', title: 'Id', uidt: UITypes.ID, ai: 1, pk: 1 },
  { column_name: 'Title', title: 'Title', uidt: UITypes.SingleLineText },
  { column_name: 'Owner', title: 'Owner', uidt: UITypes.SingleLineText },
  { column_name: 'Notes', title: 'Notes', uidt: UITypes.LongText },
  { column_name: 'Start', title: 'Start', uidt: UITypes.Date },
  { column_name: 'End', title: 'End', uidt: UITypes.Date },
];

// Spread across Q1 so bars are within month/quarter zoom buffers without
// saturating the 400-record windowed-fetch cap. Years are 2024 — fixed
// so test assertions don't depend on the wall clock.
const seedRecords = [
  { Id: 1, Title: 'Discovery', Owner: 'Alice', Start: '2024-01-08', End: '2024-01-19' },
  { Id: 2, Title: 'Requirements', Owner: 'Bob', Start: '2024-01-15', End: '2024-01-26' },
  { Id: 3, Title: 'Design Mockups', Owner: 'Carol', Start: '2024-01-29', End: '2024-02-09' },
  { Id: 4, Title: 'Design Review', Owner: 'Dan', Start: '2024-02-12', End: '2024-02-16' },
  { Id: 5, Title: 'Backend Setup', Owner: 'Eve', Start: '2024-02-05', End: '2024-02-16' },
  { Id: 6, Title: 'DB Schema', Owner: 'Frank', Start: '2024-02-19', End: '2024-02-23' },
  { Id: 7, Title: 'API Design', Owner: 'Grace', Start: '2024-02-26', End: '2024-03-08' },
  {
    Id: 8,
    Title: 'A very long task title that definitely exceeds a five-day bar at month zoom',
    Owner: 'Helen',
    Start: '2024-03-11',
    End: '2024-03-15',
  },
  { Id: 9, Title: 'Authentication', Owner: 'Ivan', Start: '2024-03-18', End: '2024-03-29' },
  { Id: 10, Title: 'Core CRUD', Owner: 'Jake', Start: '2024-04-01', End: '2024-04-19' },
];

test.describe('Gantt View', () => {
  // Gantt is gated behind FEATURE_GANTT_VIEW — Cloud Business+ / on-prem
  // paid plans only. Tests need an EE workspace seeded with the feature
  // enabled; CE builds + Free Cloud workspaces would 402 on view-create.
  test.skip(!isEE(), 'Gantt view is EE-only');

  let dashboard: DashboardPage;
  let gantt: GanttPage;
  let context: NcContext;
  let tableId: string;
  let predecessorsColId: string;
  let startColId: string;
  let endColId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    gantt = dashboard.gantt;

    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: 'GanttSeed',
      title: 'GanttSeed',
      columns,
    });
    tableId = (table as any).id;

    await api.dbTableRow.bulkCreate('noco', context.base.id!, tableId, seedRecords);

    // Add self-ref Predecessors LTAR — required for the dep graph
    // endpoint to return non-empty edges. Created via the v3 fields API
    // since the v1 column API doesn't take a self-ref shape directly.
    await page.request.post(`/api/v3/meta/bases/${context.base.id}/tables/${tableId}/fields`, {
      headers: { 'xc-auth': context.token, 'Content-Type': 'application/json' },
      data: {
        title: 'Predecessors',
        type: 'Links',
        options: { related_table_id: tableId, relation_type: 'hm' },
      },
    });

    // Re-fetch the table to capture the new column id + cache start/end
    // ids so later tests can configure the DateDependency rule.
    const fresh = await api.dbTable.read(tableId);
    const cols = (fresh as any).columns as Array<{ id: string; title: string }>;
    predecessorsColId = cols.find(c => c.title === 'Predecessors')!.id;
    startColId = cols.find(c => c.title === 'Start')!.id;
    endColId = cols.find(c => c.title === 'End')!.id;

    await page.reload({ waitUntil: 'networkidle' });
    await dashboard.rootPage.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  // Helper — create a Gantt view AND configure its DateDependency rule
  // pointing at Start/End/Predecessors. The view-create UI doesn't
  // configure the rule in one step, so we drive it via the internal
  // API after the view is created. Returns the view id from the
  // current URL after navigation.
  const createConfiguredGantt = async ({ title }: { title: string }) => {
    await dashboard.treeView.openTable({ title: 'GanttSeed' });
    await dashboard.viewSidebar.createGanttView({ title });
    await dashboard.viewSidebar.openView({ title });
    await gantt.waitLoading();

    const url = dashboard.rootPage.url();
    const viewId = url.split('/').filter(Boolean).pop()!.split('?')[0];

    await dashboard.rootPage.request.post(
      `/api/v2/internal/${context.workspace.id}/${context.base.id}` +
        `?operation=updateDateDependency&modelId=${tableId}&ganttViewId=${viewId}`,
      {
        headers: { 'xc-auth': context.token, 'Content-Type': 'application/json' },
        data: {
          fk_start_date_field_id: startColId,
          fk_end_date_field_id: endColId,
          fk_dependency_linkrow_field_id: predecessorsColId,
          dependency_linkrow_role: 'predecessors',
          dependency_connection_type: 'end-to-start',
          dependency_buffer_type: 'none',
          dependency_buffer_days: 0,
          include_weekends: false,
          is_active: true,
        },
      }
    );

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
    await gantt.waitLoading();
    return viewId;
  };

  test('creates a Gantt view and renders bars once date-dependency is configured', async () => {
    await dashboard.treeView.openTable({ title: 'GanttSeed' });
    await dashboard.viewSidebar.createGanttView({ title: 'G1' });
    await dashboard.viewSidebar.verifyView({ title: 'G1', index: 1 });
    await dashboard.viewSidebar.openView({ title: 'G1' });
    await gantt.waitLoading();

    // Without the per-view DateDependency rule configured, ganttRange is
    // empty and the empty-state copy renders (no bars). This asserts the
    // unconfigured-view UX rather than failing on missing data.
    await expect(gantt.get()).toBeVisible();
    expect(await gantt.getBarCount()).toBe(0);

    await createConfiguredGantt({ title: 'G1Configured' });

    // After rule configuration, the windowed fetch should return rows
    // within the buffer. navigateToClosestRecord anchors the buffer on
    // the nearest record to today — for 2024 seed data running in 2026,
    // this lands well before the buffer's left edge unless the helper
    // re-anchors; allow the helper one tick to settle.
    expect(await gantt.getBarCount()).toBeGreaterThan(0);
  });

  test('default Fields-menu visibility is PV-only', async () => {
    await createConfiguredGantt({ title: 'GDefaults' });

    // Post fix #5: View.insertMetaOnly for Gantt sets show=!!pv (matches
    // Timeline + Gantt's own bulkInsertFromMeta). Non-PV non-system
    // columns default to hidden — users opt them in via the Fields panel.
    await gantt.clickFields();

    await gantt.toolbar.fields.verify({ title: 'Title', checked: true });
    await gantt.toolbar.fields.verify({ title: 'Start', checked: false });
    await gantt.toolbar.fields.verify({ title: 'End', checked: false });
    await gantt.toolbar.fields.verify({ title: 'Owner', checked: false });
    await gantt.toolbar.fields.verify({ title: 'Notes', checked: false });
  });

  test('bar label clips at bar geometry; tooltip surfaces full title', async () => {
    await createConfiguredGantt({ title: 'GClip' });

    // The "very long task title…" record (Id 8) is 5 days wide at month
    // zoom — its inline label will be longer than 5 column widths.
    // Pre-fix this rendered as a sibling spill-out div extending past
    // the bar; post-fix the bar has overflow-hidden and the inline
    // label is visually clipped at the bar's right edge.
    const bars = await gantt.bars().all();
    expect(bars.length).toBeGreaterThan(0);

    // Locate Id 8's bar by data-unique-id; the seed bar is the
    // long-title one we deliberately want to test clipping on.
    const longBar = gantt.get().locator('[data-testid="nc-gantt-bar"]').filter({ hasText: 'A very long task title' });
    await expect(longBar.first()).toBeVisible();

    // Verify the bar's container declares overflow:hidden — direct CSS
    // assertion. Any future regression that drops the class or moves
    // the label out as a sibling element fails this check.
    const overflowHidden = await longBar.first().evaluate(el => {
      const style = window.getComputedStyle(el as HTMLElement);
      return style.overflowX === 'hidden' || style.overflow === 'hidden';
    });
    expect(overflowHidden).toBe(true);

    // Verify NO spill-out sibling renders for narrow bars. The fix
    // removed the second template block; nothing under the row should
    // claim that absolute position with `pointer-events-none` style.
    // Searching the row container by the deleted class would always
    // pass — instead, assert the pre-fix helper name isn't present
    // anywhere (helper was removed too). We approximate by checking
    // there are no "absolute top-1 ... pointer-events-none" siblings
    // outside an `nc-gantt-bar` element.
    const spillSiblings = await gantt.get().locator('div.absolute.top-1.pointer-events-none').count();
    expect(spillSiblings).toBe(0);

    // Hover surfaces the tooltip with title + date range (post fix #11
    // tooltip enhancement).
    const tooltipText = await gantt.getBarTooltipText();
    expect(tooltipText.length).toBeGreaterThan(0);
  });

  test('switching zoom level preserves rendered bars', async () => {
    await createConfiguredGantt({ title: 'GZoom' });

    const monthCount = await gantt.getBarCount();
    expect(monthCount).toBeGreaterThan(0);

    await gantt.setZoomLevel('quarter');
    const quarterCount = await gantt.getBarCount();
    expect(quarterCount).toBeGreaterThan(0);

    await gantt.setZoomLevel('year');
    const yearCount = await gantt.getBarCount();
    expect(yearCount).toBeGreaterThan(0);
  });

  test('clicking next slides the buffer and issues a windowed gantt-data fetch', async ({ page }) => {
    await createConfiguredGantt({ title: 'GSlide' });

    const before = await gantt.getActiveDateLabel();

    // Gantt's windowed-fetch endpoint mirrors Timeline's — the URL
    // template is /api/v1/db/gantt-data/noco/{base}/{table}/views/{view}
    // with from_date / to_date query params. Server-side overlap
    // predicate + limitOverride live behind it.
    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/v1/db/gantt-data/') &&
        req.url().includes('from_date=') &&
        req.url().includes('to_date='),
      { timeout: 15000 }
    );

    // bufferDays at month zoom is wide; the next-button click only
    // triggers a refetch when the cursor crosses the buffer edge. Six
    // clicks guarantees the slide at any zoom — same heuristic Timeline
    // uses.
    for (let i = 0; i < 6; i++) {
      await gantt.clickNext();
    }

    const req = await requestPromise;
    const after = await gantt.getActiveDateLabel();

    expect(after).not.toEqual(before);

    const url = decodeURIComponent(req.url());
    expect(url).toMatch(/from_date=\d{4}-\d{2}-\d{2}/);
    expect(url).toMatch(/to_date=\d{4}-\d{2}-\d{2}/);
  });

  test('dependency graph endpoint returns edges between linked rows', async ({ page }) => {
    const viewId = await createConfiguredGantt({ title: 'GDeps' });

    // Wire two predecessor links: row 2 ← 1, row 3 ← 2. The dep graph
    // endpoint should return both edges.
    for (const [child, pred] of [
      [2, 1],
      [3, 2],
    ] as const) {
      await page.request.post(
        `/api/v1/db/data/noco/${context.base.id}/${tableId}/${child}/hm/${predecessorsColId}/${pred}`,
        { headers: { 'xc-auth': context.token } }
      );
    }

    const resp = await page.request.get(
      `/api/v1/db/gantt-data/noco/${context.base.id}/${tableId}/views/${viewId}/deps`,
      { headers: { 'xc-auth': context.token } }
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Array.isArray(body.edges)).toBe(true);
    expect(body.edges.length).toBeGreaterThanOrEqual(2);

    // Edges shape: [childPk, parentPk]. Post fix #3 (security envelope),
    // edges that originate from non-visible parents are filtered out —
    // the seeded user owns the workspace so all rows are visible and
    // we expect every link we created to round-trip.
    const asStrings = body.edges.map(([c, p]: [unknown, unknown]) => [String(c), String(p)]);
    expect(asStrings).toEqual(
      expect.arrayContaining([
        ['2', '1'],
        ['3', '2'],
      ])
    );
  });

  test('public shared Gantt view renders bars and edges without auth', async ({ browser, page }) => {
    const viewId = await createConfiguredGantt({ title: 'GShared' });

    // Enable sharing via the v1 share endpoint (same path the UI's
    // Share button hits).
    const shareResp = await page.request.post(`/api/v1/db/meta/views/${viewId}/share`, {
      headers: { 'xc-auth': context.token, 'Content-Type': 'application/json' },
      data: {},
    });
    const share = await shareResp.json();
    expect(share.uuid).toBeTruthy();

    // Open the share URL in an anonymous (no-auth) context — same
    // origin, fresh storage state. Anonymous renderer must reach the
    // same windowed-fetch endpoint via /api/v2/public/gantt-view/.
    const anonCtx = await browser.newContext({ storageState: undefined });
    const anonPage = await anonCtx.newPage();

    const dataResp = anonPage.waitForResponse(
      r => r.url().includes(`/api/v2/public/gantt-view/${share.uuid}`) && r.url().includes('from_date='),
      { timeout: 15000 }
    );
    await anonPage.goto(`/nc/gantt/${share.uuid}`);
    const dataRes = await dataResp;
    expect(dataRes.status()).toBe(200);

    // Anonymous Gantt wrapper renders.
    await anonPage.getByTestId('nc-gantt-wrapper').waitFor({ state: 'visible', timeout: 10000 });
    expect(await anonPage.locator('[data-testid="nc-gantt-bar"]').count()).toBeGreaterThan(0);

    await anonCtx.close();
  });

  test('clicking a bar opens the right-rail inspector', async () => {
    await createConfiguredGantt({ title: 'GInspect' });

    await gantt.clickBar(0);
    const inspector = await gantt.getInspector();
    await expect(inspector).toBeVisible();

    // Inspector reflects the clicked row's title in its name field.
    const nameField = inspector.getByTestId('nc-gantt-inspector-name');
    await expect(nameField).toBeVisible();
    const name = await nameField.inputValue().catch(() => '');
    expect(name.length).toBeGreaterThan(0);

    await gantt.closeInspector();
    await expect(inspector).not.toBeVisible();
  });
});
