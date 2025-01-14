import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

test.describe('Grid pagination', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Access next page, prev page & offset page', async () => {
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country' });
    // click ">" to go to next page
    await dashboard.grid.clickPagination({ type: 'next-page' });
    await dashboard.grid.verifyActivePage({ pageNumber: '2' });
    // click "<" to go to prev page
    await dashboard.grid.clickPagination({ type: 'prev-page' });
    await dashboard.grid.verifyActivePage({ pageNumber: '1' });
  });
});
