import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { unsetup } from '../../setup';

test.describe('Command Shortcuts', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false, isSuperUser: true });
    dashboard = new DashboardPage(page, context.project);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Verify Command J Docs', async ({ page }) => {
    await page.waitForTimeout(1000);
    await dashboard.cmdJ.openCmdJ();

    expect(await dashboard.cmdJ.isCmdJVisible()).toBe(1);

    await dashboard.cmdJ.searchText('Column');
    await page.keyboard.press('Escape');
    expect(await dashboard.cmdJ.isCmdJVisible()).toBe(0);

    await dashboard.signOut();

    await page.waitForTimeout(1000);

    await dashboard.cmdJ.openCmdJ();
    expect(await dashboard.cmdJ.isCmdJVisible()).toBe(0);
  });

  test('Verify Command K', async ({ page }) => {
    await page.waitForTimeout(1000);
    await dashboard.cmdK.openCmdK();

    expect(await dashboard.cmdK.isCmdKVisible()).toBe(1);

    await page.keyboard.press('Escape');
    expect(await dashboard.cmdK.isCmdKVisible()).toBe(0);

    await dashboard.cmdK.openCmdK();

    await dashboard.cmdK.searchText('CustomerList');

    const text = await dashboard.get().locator('.nc-active-view-title').innerText();

    expect(text).toBe('Default View');

    await dashboard.signOut();

    await page.waitForTimeout(1000);

    await dashboard.cmdK.openCmdK();
    expect(await dashboard.cmdK.isCmdKVisible()).toBe(0);
  });

  test('Verify Command L Recent Switch', async ({ page }) => {
    await page.waitForTimeout(1000);
    await dashboard.cmdL.openCmdL();

    expect(await dashboard.cmdL.isCmdLVisible()).toBe(1);

    await page.keyboard.press('Escape');
    expect(await dashboard.cmdL.isCmdLVisible()).toBe(0);

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
    expect(await dashboard.cmdL.isCmdLVisible()).toBe(0);
  });
});
