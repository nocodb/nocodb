import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup, { unsetup } from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';

test.describe.only('Test block name', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Test case name', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });
  });
});
