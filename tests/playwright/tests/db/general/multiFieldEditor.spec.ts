import test from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import setup from '../../../setup';

test.describe('MultiFieldEditor', () => {
  let grid: GridPage, dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    await dashboard.treeView.createTable({ title: 'sheet1', baseTitle: context.base.title });
  });

  test.skip('Hide Columns', async () => {
    //
  });
});
