import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import setup, { unsetup } from '../../../setup';

// Skip for now as it is not working in CI atm
test.describe.skip('Find row by scanner', () => {
  let dashboard: DashboardPage;
  let context: any;
  let toolbar: ToolbarPage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.describe('clicking on the toolbars scanner button', async () => {
    test.beforeEach(async () => {
      await dashboard.closeTab({ title: 'Team & Auth' });
      await dashboard.treeView.openTable({ title: 'Country' });
      await toolbar.clickFindRowByScanButton();
    });
    test('opens the scanner overlay', async () => {
      expect(await dashboard.findRowByScanOverlay.isVisible()).toBeTruthy();
    });
  });
});
