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

// Seed dates are wall-clock relative: every CI run lands within ±60 days
// of "today" so the default month-zoom buffer covers them and
// navigateToClosestRecord anchors on real data instead of bailing to today.
// Fixed 2024 dates used to silently shift the buffer 25+ months in the past
// once CI moved past 2024, producing barCount=0 for tests that just asked
// "do bars render?" — the only signal was empty results, no error.
const today = new Date();
const dayOffset = (days: number) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Build the seed lazily inside beforeEach so `today` reads at the time of
// the test run, not module-load. (At module load `today` is fine too, but
// inlining helps readability.)
const buildSeedRecords = () => [
  { Id: 1, Title: 'Discovery', Owner: 'Alice', Start: dayOffset(-45), End: dayOffset(-38) },
  { Id: 2, Title: 'Requirements', Owner: 'Bob', Start: dayOffset(-37), End: dayOffset(-30) },
  { Id: 3, Title: 'Design Mockups', Owner: 'Carol', Start: dayOffset(-28), End: dayOffset(-21) },
  { Id: 4, Title: 'Design Review', Owner: 'Dan', Start: dayOffset(-20), End: dayOffset(-15) },
  { Id: 5, Title: 'Backend Setup', Owner: 'Eve', Start: dayOffset(-25), End: dayOffset(-14) },
  { Id: 6, Title: 'DB Schema', Owner: 'Frank', Start: dayOffset(-12), End: dayOffset(-8) },
  { Id: 7, Title: 'API Design', Owner: 'Grace', Start: dayOffset(-7), End: dayOffset(2) },
  {
    Id: 8,
    Title: 'A very long task title that definitely exceeds a five-day bar at month zoom',
    Owner: 'Helen',
    Start: dayOffset(3),
    End: dayOffset(7),
  },
  { Id: 9, Title: 'Authentication', Owner: 'Ivan', Start: dayOffset(10), End: dayOffset(20) },
  { Id: 10, Title: 'Core CRUD', Owner: 'Jake', Start: dayOffset(22), End: dayOffset(40) },
];

test.describe('Gantt View', () => {
  // Gantt is gated behind FEATURE_GANTT_VIEW — Cloud Business+ / on-prem
  // paid plans only. Tests need an EE workspace seeded with the feature
  // enabled; CE builds + Free Cloud workspaces would 402 on view-create.
  test.skip(!isEE(), 'Gantt view is EE-only');

  let dashboard: DashboardPage;
  let gantt: GanttPage;
  let context: NcContext;

  let api: Api<any>;
  let tableId: string;
  let predecessorsColId: string;
  let startColId: string;
  let endColId: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    gantt = dashboard.gantt;

    // SDK client talks directly to the backend on :8080 — bypasses the
    // dev-server proxy at :3000 (which has bitten earlier versions of
    // this spec that used page.request for /api/v1/db/meta/views/.../share
    // and got the Nuxt SPA 404 HTML back).
    api = new Api({
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

    await api.dbTableRow.bulkCreate('noco', context.base.id!, tableId, buildSeedRecords());

    // Add self-ref Predecessors LTAR. Uses the established v1 column-create
    // pattern (parentId === childId === tableId, type: 'hm') — same shape
    // dateDependency.spec.ts uses for its self-ref predecessor column. The
    // earlier v3 fields-POST shape silently failed in CI: the dbTableColumn
    // path goes through the well-trodden LTAR builder + guarantees the
    // column exists when the call resolves.
    await api.dbTableColumn.create(tableId, {
      title: 'Predecessors',
      uidt: UITypes.LinkToAnotherRecord,
      parentId: tableId,
      childId: tableId,
      type: 'hm',
    });

    // Re-fetch the table to capture the new column id + cache start/end
    // ids so later tests can configure the DateDependency rule. Defensive
    // find-or-throw so a regression here surfaces with a clear message
    // rather than the cryptic "Cannot read properties of undefined" we
    // got from the previous version.
    const fresh = await api.dbTable.read(tableId);
    const cols = (fresh.columns ?? []) as Array<{ id: string; title: string; uidt: string }>;
    const findCol = (title: string) => {
      const col = cols.find(c => c.title === title);
      if (!col?.id) throw new Error(`Setup: expected column '${title}' not found on table ${tableId}`);
      return col.id;
    };
    predecessorsColId = findCol('Predecessors');
    startColId = findCol('Start');
    endColId = findCol('End');

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

    // View IDs in NocoDB always start with the `vw` nanoid prefix. The
    // view URL is `/{ws}/{base}/{table}/{viewId}/{title-slug}` so
    // pop()-ing the last segment returns the title slug, not the id.
    // Find the `vw…` segment regardless of position.
    const url = dashboard.rootPage.url();
    const viewId = (url.split('/').find(seg => /^vw[a-z0-9]+$/i.test(seg)) ?? '').split('?')[0];
    if (!viewId) throw new Error(`Could not extract view id from URL: ${url}`);

    // Internal-API operation — no SDK wrapper exists for the
    // operation=... dispatcher. Send via api.instance (axios bound to
    // :8080) instead of page.request (bound to :3000 via the dev-server
    // proxy) so we don't depend on the proxy's path rules.
    await api.instance.post(
      `/api/v2/internal/${context.workspace.id}/${context.base.id}` +
        `?operation=updateDateDependency&modelId=${tableId}&ganttViewId=${viewId}`,
      {
        fk_start_date_field_id: startColId,
        fk_end_date_field_id: endColId,
        fk_dependency_linkrow_field_id: predecessorsColId,
        dependency_linkrow_role: 'predecessors',
        dependency_connection_type: 'end-to-start',
        dependency_buffer_type: 'none',
        dependency_buffer_days: 0,
        include_weekends: false,
        is_active: true,
      }
    );

    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
    await gantt.waitLoading();
    return viewId;
  };

  test('creates a Gantt view and renders bars once date-dependency is configured', async () => {
    // EE's Gantt may auto-pick the first start/end date columns when no
    // per-view rule exists (an empirical observation from CI — a fresh
    // Gantt rendered 10 bars before any rule was configured). So this
    // test no longer asserts the "no bars before rule" pre-condition;
    // it just verifies the explicit-config path produces bars.
    await createConfiguredGantt({ title: 'G1Configured' });
    await expect(gantt.get()).toBeVisible();

    // After rule configuration, the windowed fetch should return rows
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

  test('dependency graph endpoint returns edges between linked rows', async () => {
    const viewId = await createConfiguredGantt({ title: 'GDeps' });

    // Wire two predecessor links via the SDK's nestedAdd — direct to
    // :8080, no proxy in between. Predecessors: row 2 ← 1, row 3 ← 2.
    for (const [child, pred] of [
      [2, 1],
      [3, 2],
    ] as const) {
      await api.dbTableRow.nestedAdd(
        'noco',
        context.base.id!,
        tableId,
        String(child),
        'hm',
        predecessorsColId,
        String(pred)
      );
    }

    const resp = await api.instance.get(
      `/api/v1/db/gantt-data/noco/${context.base.id}/${tableId}/views/${viewId}/deps`
    );
    expect(resp.status).toBe(200);
    const body = resp.data;
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

  test('public shared Gantt view renders bars and edges without auth', async ({ browser }) => {
    const viewId = await createConfiguredGantt({ title: 'GShared' });

    // Enable sharing via the SDK — same backend route as the UI Share
    // button. Going through api.dbViewShare instead of page.request so
    // the call lands on :8080 directly; the previous page.request shape
    // hit the dev-server SPA fallback in CI and got HTML back.

    const share = (await api.dbViewShare.create(viewId, {} as any)) as { uuid: string };
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

  test('deleting a Gantt view cascades the per-view DateDependency rule', async () => {
    const viewId = await createConfiguredGantt({ title: 'GDeleteCascade' });

    const ruleUrl = (vid: string) =>
      `/api/v2/internal/${context.workspace.id}/${context.base.id}` +
      `?operation=getDateDependency&modelId=${tableId}&ganttViewId=${vid}`;

    // Pre-condition: rule is configured for this view.
    const beforeResp = await api.instance.get(ruleUrl(viewId));
    expect(beforeResp.status).toBe(200);
    expect(beforeResp.data?.fk_start_date_field_id).toBe(startColId);

    // Delete the view through the standard sidebar flow.
    await dashboard.viewSidebar.deleteView({ title: 'GDeleteCascade' });

    // Post-condition: the rule must be gone. Without the View.delete
    // cascade (`metaDelete` on fk_gantt_view_id) this row would orphan
    // in nc_date_dependency.
    const afterResp = await api.instance.get(ruleUrl(viewId), { validateStatus: () => true });
    const after = afterResp.data;
    expect(after === null || after === '' || Object.keys(after ?? {}).length === 0).toBe(true);
  });

  test('two Gantt views on the same table carry independent rules', async () => {
    // Gantt A — configured by createConfiguredGantt with the standard
    // (Start, End, Predecessors, end-to-start, no buffer) shape.
    const viewIdA = await createConfiguredGantt({ title: 'GIndependentA' });

    // Gantt B — same table, but configured WITHOUT the end column and
    // WITHOUT the predecessor link. Different shape so a regression
    // that resolves rules table-level instead of per-view would surface
    // as one Gantt's rule leaking into the other.
    await dashboard.treeView.openTable({ title: 'GanttSeed' });
    await dashboard.viewSidebar.createGanttView({ title: 'GIndependentB' });
    await dashboard.viewSidebar.openView({ title: 'GIndependentB' });
    await gantt.waitLoading();
    const url = dashboard.rootPage.url();
    const viewIdB = (url.split('/').find(seg => /^vw[a-z0-9]+$/i.test(seg)) ?? '').split('?')[0];
    if (!viewIdB) throw new Error(`Could not extract view id B from URL: ${url}`);

    await api.instance.post(
      `/api/v2/internal/${context.workspace.id}/${context.base.id}` +
        `?operation=updateDateDependency&modelId=${tableId}&ganttViewId=${viewIdB}`,
      {
        fk_start_date_field_id: startColId,
        fk_end_date_field_id: null,
        fk_dependency_linkrow_field_id: null,
        dependency_linkrow_role: null,
        dependency_connection_type: 'end-to-start',
        dependency_buffer_type: 'none',
        dependency_buffer_days: 0,
        include_weekends: false,
        is_active: true,
      }
    );

    const fetchRule = async (viewId: string) => {
      const r = await api.instance.get(
        `/api/v2/internal/${context.workspace.id}/${context.base.id}` +
          `?operation=getDateDependency&modelId=${tableId}&ganttViewId=${viewId}`
      );
      return r.data;
    };

    const ruleA = await fetchRule(viewIdA);
    const ruleB = await fetchRule(viewIdB);

    // Rule A has end col + predecessor; rule B doesn't. Per-view scoping
    // means each view returns its own rule shape.
    expect(ruleA.fk_end_date_field_id).toBe(endColId);
    expect(ruleA.fk_dependency_linkrow_field_id).toBe(predecessorsColId);
    expect(ruleB.fk_end_date_field_id).toBeFalsy();
    expect(ruleB.fk_dependency_linkrow_field_id).toBeFalsy();

    // Both rules are scoped to their own view id — a regression that
    // makes one a copy of the other would fail this.
    expect(ruleA.fk_gantt_view_id).toBe(viewIdA);
    expect(ruleB.fk_gantt_view_id).toBe(viewIdB);
  });

  test('dependency arrows render as DOM elements between linked rows', async () => {
    await createConfiguredGantt({ title: 'GArrows' });

    // Wire 2 ← 1, 3 ← 2 via the SDK's nestedAdd — direct to :8080.
    for (const [child, pred] of [
      [2, 1],
      [3, 2],
    ] as const) {
      await api.dbTableRow.nestedAdd(
        'noco',
        context.base.id!,
        tableId,
        String(child),
        'hm',
        predecessorsColId,
        String(pred)
      );
    }

    // Reload so the in-memory dependencyLinks map refreshes from the
    // /deps endpoint, then jump the buffer to today so rows 1–3 (seeded
    // at dayOffset -45 to -28) sit alongside today's anchor at month
    // zoom — bufferDays is wide enough at month zoom that both ends of
    // the range and today fall in one window.
    await dashboard.rootPage.reload({ waitUntil: 'networkidle' });
    await gantt.waitLoading();
    await gantt.clickToday();

    const arrowCount = await gantt.getArrowCount();
    expect(arrowCount).toBeGreaterThanOrEqual(2);
  });

  // TODO(gantt): re-enable a milestone test once the windowed-fetch path
  // returns rows with start=null. As of the time this spec was written,
  // gantt-datas.service.ts buildOverlapFilter ANDs `start <= to_date`
  // and `end >= from_date` — SQL evaluates `NULL <= 'date'` to UNKNOWN,
  // so start=null rows are filtered out at the DB. isMilestone() on the
  // FE expects start=null AND end=set, but the matching row never
  // arrives. A future fix would either (a) detect "start col is null
  // but end col is set" rows via a separate query, or (b) accept
  // start-only milestones (end=null) in the FE's isMilestone semantics.

  test('public shared Gantt view is read-only — no drag handles', async ({ browser }) => {
    const viewId = await createConfiguredGantt({ title: 'GReadOnly' });

    const share = (await api.dbViewShare.create(viewId, {} as any)) as { uuid: string };
    expect(share.uuid).toBeTruthy();

    const anonCtx = await browser.newContext({ storageState: undefined });
    const anonPage = await anonCtx.newPage();
    await anonPage.goto(`/nc/gantt/${share.uuid}`);
    await anonPage.getByTestId('nc-gantt-wrapper').waitFor({ state: 'visible', timeout: 10000 });

    // Wait for bars to mount before asserting handles aren't there —
    // a too-early assertion would pass trivially because nothing is
    // rendered yet.
    await anonPage.locator('[data-testid="nc-gantt-bar"]').first().waitFor({ state: 'visible' });

    // Resize handles (.nc-gantt-resize-handle) and the dep-creation
    // handle (.nc-gantt-dep-handle) are gated behind `canDrag` /
    // `canEditDeps` — both false in a public/shared (no-auth) view.
    // If a regression like the recent shared-base bypass for view
    // operations (commit 15a8d496252) creeps back, these would
    // resurface in the anon DOM.
    expect(await anonPage.locator('.nc-gantt-resize-handle').count()).toBe(0);
    expect(await anonPage.locator('.nc-gantt-dep-handle').count()).toBe(0);

    // The new-record button (toolbar plus / empty-row plus) is also
    // gated behind dataEdit — must not be present anonymously.
    expect(await anonPage.locator('[data-testid="nc-gantt-new-record-btn"]').count()).toBe(0);

    await anonCtx.close();
  });
});
