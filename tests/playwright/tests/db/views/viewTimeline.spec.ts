import { expect, test } from '@playwright/test';
import { Api, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { TimelinePage } from '../../../pages/Dashboard/Timeline';
import setup, { NcContext, unsetup } from '../../../setup';
import { isEE } from '../../../setup/db';

/**
 * Timeline view spec — covers the behaviours specific to this view type:
 *
 *  - Creating a timeline view (TIMELINE = ViewTypes.TIMELINE = 8) lands
 *    on the timeline UI with the configured range and renders bars.
 *  - Default Fields-menu visibility on a fresh timeline is minimal:
 *    only the display value (pv) and the configured range columns are
 *    visible; non-range non-pv fields stay hidden until the user opts
 *    them in. Pairs with the windowed-fetch payload reduction.
 *  - The windowed fetch refetches when the buffer slides — clicking the
 *    next/prev arrow updates the active date label and issues a request
 *    whose `filterArrJson` carries the overlap predicate (not "first
 *    page" repeats anchored on the original buffer start).
 */

const columns = [
  { column_name: 'Id', title: 'Id', uidt: UITypes.ID, ai: 1, pk: 1 },
  { column_name: 'Title', title: 'Title', uidt: UITypes.SingleLineText },
  { column_name: 'Owner', title: 'Owner', uidt: UITypes.SingleLineText },
  { column_name: 'Notes', title: 'Notes', uidt: UITypes.LongText },
  { column_name: 'StartDate', title: 'StartDate', uidt: UITypes.Date },
  { column_name: 'EndDate', title: 'EndDate', uidt: UITypes.Date },
];

// Records spread across a few months so the default ±30-day buffer at
// month zoom covers some bars without saturating the 400-record cap.
const seedRecords = [
  {
    Id: 1,
    Title: 'Sprint Planning',
    Owner: 'Alice',
    Notes: 'Q1 kickoff',
    StartDate: '2024-01-15',
    EndDate: '2024-01-19',
  },
  { Id: 2, Title: 'Design Review', Owner: 'Bob', Notes: '', StartDate: '2024-01-22', EndDate: '2024-01-26' },
  { Id: 3, Title: 'Engineering Sync', Owner: 'Carol', Notes: 'Weekly', StartDate: '2024-02-05', EndDate: '2024-02-09' },
  { Id: 4, Title: 'Customer Demo', Owner: 'Dan', Notes: 'Acme', StartDate: '2024-02-12', EndDate: '2024-02-14' },
  { Id: 5, Title: 'Launch Prep', Owner: 'Eve', Notes: '', StartDate: '2024-02-26', EndDate: '2024-03-08' },
  {
    Id: 6,
    Title: 'Postmortem',
    Owner: 'Frank',
    Notes: 'Incident review',
    StartDate: '2024-03-11',
    EndDate: '2024-03-12',
  },
  { Id: 7, Title: 'Roadmap Workshop', Owner: 'Grace', Notes: '', StartDate: '2024-03-18', EndDate: '2024-03-22' },
  { Id: 8, Title: 'Hiring Loop', Owner: 'Helen', Notes: 'Senior eng', StartDate: '2024-04-01', EndDate: '2024-04-05' },
];

test.describe('Timeline View', () => {
  // Timeline is gated behind FEATURE_TIMELINE_VIEW — EE only.
  test.skip(!isEE(), 'Timeline view is EE-only');

  let dashboard: DashboardPage;
  let timeline: TimelinePage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    timeline = dashboard.timeline;

    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: { 'xc-auth': context.token },
    });

    const base = await api.base.read(context.base.id);
    const table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
      table_name: 'TimelineSeed',
      title: 'TimelineSeed',
      columns,
    });

    await api.dbTableRow.bulkCreate('noco', context.base.id!, (table as any).id, seedRecords);

    await page.reload({ waitUntil: 'networkidle' });
    await dashboard.rootPage.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('creates a timeline view and renders bars', async () => {
    await dashboard.treeView.openTable({ title: 'TimelineSeed' });
    await dashboard.viewSidebar.createTimelineView({ title: 'TL' });
    await dashboard.viewSidebar.verifyView({ title: 'TL', index: 1 });
    await dashboard.viewSidebar.openView({ title: 'TL' });

    await timeline.waitLoading();
    await expect(timeline.get()).toBeVisible();

    // The default range auto-picks the first date column for `from`.
    // `navigateToClosestRecord` re-anchors the buffer on the closest
    // record to today on initial load, so the seed window must produce
    // visible bars (otherwise the closest-record path is broken).
    const barCount = await timeline.getBarCount();
    expect(barCount).toBeGreaterThan(0);
  });

  test('default Fields-menu visibility is minimal — display + range only', async () => {
    await dashboard.treeView.openTable({ title: 'TimelineSeed' });
    await dashboard.viewSidebar.createTimelineView({ title: 'TLDefaults' });
    await dashboard.viewSidebar.openView({ title: 'TLDefaults' });
    await timeline.waitLoading();

    // Title is the primary value (pv). StartDate / EndDate are the range
    // columns. Owner / Notes are non-pv non-range — they should default
    // to hidden.
    await timeline.toolbar.fields.verify({ title: 'Title', checked: true });
    await timeline.toolbar.fields.verify({ title: 'StartDate', checked: true });
    await timeline.toolbar.fields.verify({ title: 'EndDate', checked: true });
    await timeline.toolbar.fields.verify({ title: 'Owner', checked: false });
    await timeline.toolbar.fields.verify({ title: 'Notes', checked: false });
  });

  test('clicking next slides the buffer and issues a windowed fetch', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'TimelineSeed' });
    await dashboard.viewSidebar.createTimelineView({ title: 'TLSlide' });
    await dashboard.viewSidebar.openView({ title: 'TLSlide' });
    await timeline.waitLoading();

    const before = await timeline.getActiveDateLabel();

    // Match the dedicated timeline endpoint URL — every fetch lands on
    // /api/v1/db/timeline-data/... with from_date/to_date query params.
    // The server builds the overlap predicate and applies a 400-record
    // limitOverride that bypasses the deployment's NC_DB_QUERY_LIMIT_MAX.
    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/v1/db/timeline-data/') &&
        req.url().includes('from_date=') &&
        req.url().includes('to_date='),
      { timeout: 5000 }
    );

    await timeline.clickNext();
    // Strict — if the navigation stops issuing the windowed fetch this throws.
    const req = await requestPromise;
    const after = await timeline.getActiveDateLabel();

    // Active-date label must shift after a navigation click.
    expect(after).not.toEqual(before);

    // We don't assert specific dates — they depend on the test wall
    // clock — only that both the from_date and to_date params are
    // present and look like ISO dates (YYYY-MM-DD prefix).
    const url = decodeURIComponent(req.url());
    expect(url).toMatch(/from_date=\d{4}-\d{2}-\d{2}/);
    expect(url).toMatch(/to_date=\d{4}-\d{2}-\d{2}/);
  });
});
