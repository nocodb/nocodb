import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { isPg } from '../../../setup/db';

test.describe('Grid view locked', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('ReadOnly lock & collaboration mode', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.verifyCollaborativeMode();

    // enable view lock
    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'View Mode',
      subMenu: 'Locked',
    });

    // verify view lock
    await dashboard.grid.verifyLockMode();

    // enable collaborative view
    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'View Mode',
      subMenu: 'Collaborative',
    });

    await dashboard.grid.verifyCollaborativeMode();
  });

  test('Download CSV', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.toolbar.clickFields();
    // Hide 'LastUpdate' column
    await dashboard.grid.toolbar.fields.click({
      title: 'LastUpdate',
    });

    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'Download',
      subMenu: 'CSV',
      verificationInfo: {
        verificationFile: isPg(context) ? './fixtures/expectedBaseDownloadDataPg.txt' : null,
      },
    });
  });

  test('Download XLSX', async () => {
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.toolbar.clickFields();
    // Hide 'LastUpdate' column
    await dashboard.grid.toolbar.fields.click({
      title: 'LastUpdate',
    });

    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'Download',
      subMenu: 'Excel',
      verificationInfo: {
        verificationFile: isPg(context) ? './fixtures/expectedBaseDownloadDataPg.txt' : null,
      },
    });
  });
});
