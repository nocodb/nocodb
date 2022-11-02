import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

test.describe('Grid pagination', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Access next page, prev page & offset page', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'Country' });
    // click ">" to go to next page
    await dashboard.grid.clickPagination({ page: '>' });
    await dashboard.grid.verifyActivePage({ page: '2' });
    // click "<" to go to prev page
    await dashboard.grid.clickPagination({ page: '<' });
    await dashboard.grid.verifyActivePage({ page: '1' });
  });
});
