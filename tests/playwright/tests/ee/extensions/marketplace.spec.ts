import test, { expect } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../../setup';

test.describe('Extension', () => {
  let dashboard: DashboardPage;
  let context: NcContext;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Marketplace', async () => {
    await dashboard.treeView.createTable({ title: 'ExtensionTestSheet', baseTitle: context.base.title });
    await dashboard.treeView.openTable({ title: 'ExtensionTestSheet', baseTitle: context.base.title });
    await dashboard.extensions.toggleExtensionButton();
    const extensionPane = dashboard.extensions.getExtensionPane();
    await expect(extensionPane).toBeVisible();

    const addExtensionButton = extensionPane.locator('button.ant-btn.ant-btn-primary');
    await expect(addExtensionButton).toBeVisible();

    await addExtensionButton.click();

    const extensionMarketModal = dashboard.get().locator('div.nc-modal-extension-market');
    await expect(extensionMarketModal).toBeVisible();

    const availableExtensions = await extensionMarketModal.locator('.nc-market-extension-item').count();
    expect(availableExtensions).toBeGreaterThan(0);
  });

  test('Add Extension', async () => {
    await dashboard.treeView.createTable({ title: 'ExtensionTestSheet', baseTitle: context.base.title });
    await dashboard.treeView.openTable({ title: 'ExtensionTestSheet', baseTitle: context.base.title });
    await dashboard.extensions.addFirstExtension();

    const extension = await dashboard.extensions.getFirstInstalledExtension();
    await expect(extension).toBeVisible();
  });
});
