import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { unsetup } from '../../setup';

test.describe('Snapshots', () => {
  let dashboard: DashboardPage, context: any;

  // Enable of Feature Release
  test.skip();

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create Snapshot', async ({ page }) => {
    await dashboard.gotoSettings();

    await dashboard.baseView.settings.changeTab('snapshots');

    await dashboard.baseView.settings.createSnapshot({ snapshotName: 'Test Snapshot' });

    await dashboard.baseView.settings.verifySnapshot({ snapshotName: 'Test Snapshot', isVisible: true });
  });

  test('Restore Snapshot', async ({ page }) => {
    await dashboard.gotoSettings();

    await dashboard.baseView.settings.changeTab('snapshots');

    await dashboard.baseView.settings.createSnapshot({ snapshotName: 'Test Snapshot' });

    await dashboard.baseView.settings.verifySnapshot({ snapshotName: 'Test Snapshot', isVisible: true });

    await dashboard.baseView.settings.restoreSnapshot({ snapshotName: 'Test Snapshot' });
  });

  test('Delete Snapshot', async ({ page }) => {
    await dashboard.gotoSettings();

    await dashboard.baseView.settings.changeTab('snapshots');

    await dashboard.baseView.settings.createSnapshot({ snapshotName: 'Test Snapshot' });

    await page.waitForTimeout(3000);

    await dashboard.baseView.settings.deleteSnapshot({ snapshotName: 'Test Snapshot' });

    await dashboard.baseView.settings.verifySnapshot({ snapshotName: 'Test Snapshot', isVisible: false });
  });
});
