import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

test.describe('Command Shortcuts', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false, isSuperUser: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify Command J Docs', async ({ page }) => {
    await page.waitForTimeout(1000);
    await dashboard.cmdJ.openCmdJ();

    await expect(dashboard.cmdJ.get()).toBeVisible();

    await dashboard.cmdJ.searchText('Column');
    await page.keyboard.press('Escape');
    await expect(dashboard.cmdJ.get()).toBeHidden();

    await dashboard.signOut();

    await page.waitForTimeout(2000);

    await dashboard.cmdJ.openCmdJ();
    await expect(dashboard.cmdJ.get()).toBeHidden();
  });

  test('Verify Command K', async ({ page }) => {
    await page.waitForTimeout(1000);
    await dashboard.cmdK.openCmdK();

    await expect(dashboard.cmdK.get()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dashboard.cmdK.get()).toBeHidden();

    await dashboard.cmdK.openCmdK();

    await dashboard.cmdK.searchText('CustomerList');

    await page.waitForTimeout(1000);
    await dashboard.get().locator('.nc-active-view-title').waitFor({ state: 'visible' });
    await expect(dashboard.get().locator('.nc-active-view-title')).toContainText('Default View');

    await dashboard.signOut();

    await page.waitForTimeout(1000);

    await dashboard.cmdK.openCmdK();
    await expect(dashboard.cmdK.get()).toBeHidden();
  });

  test('Verify Command L Recent Switch', async ({ page }) => {
    await page.waitForTimeout(1000);

    await dashboard.cmdL.openCmdL();

    await dashboard.cmdL.isCmdLVisible();

    await page.keyboard.press('Escape');

    await dashboard.cmdL.isCmdLNotVisible();

    await dashboard.treeView.openTable({ title: 'Actor' });
    await dashboard.treeView.openTable({ title: 'Address' });
    await dashboard.treeView.openTable({ title: 'Category' });
    await dashboard.treeView.openTable({ title: 'City' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await page.waitForTimeout(1000);

    await dashboard.cmdL.openCmdL();

    await page.waitForTimeout(1000);
    await dashboard.cmdL.moveDown();
    await dashboard.cmdL.moveDown();
    await dashboard.cmdL.moveDown();

    await dashboard.cmdL.openRecent();

    await page.waitForTimeout(1000);

    expect(await dashboard.cmdL.getActiveViewTitle()).toBe('Default View');

    expect(await dashboard.cmdL.getActiveTableTitle()).toBe('Address');

    await dashboard.signOut();

    await dashboard.cmdL.openCmdL();
    await dashboard.cmdL.isCmdLNotVisible();
  });
});
