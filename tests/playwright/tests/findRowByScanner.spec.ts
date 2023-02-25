import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { FormPage } from '../pages/Dashboard/Form';
import setup from '../setup';

test.describe.only('Find row by scanner', () => {
  let dashboard: DashboardPage;
  let context: any;
  let toolbar: ToolbarPage;
  let form: FormPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    form = dashboard.form;
    toolbar = dashboard.grid.toolbar;
  });

  test.describe('clicking on the toolbars scanner button', async () => {
    test.beforeEach(async () => {
      // close 'Team & Auth' tab
      await dashboard.closeTab({ title: 'Team & Auth' });
      await dashboard.treeView.openTable({ title: 'Country' });
      await toolbar.clickFindRowByScanButton();
      await dashboard.rootPage.pause();
    });
    test('opens the scanner overlay', async () => {
      expect(2 + 2).toBe(6);
    });
  });
});
