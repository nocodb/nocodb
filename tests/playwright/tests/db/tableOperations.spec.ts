import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { SettingsPage, SettingTab } from '../../pages/Dashboard/Settings';
import setup from '../../setup';

test.describe('Table Operations', () => {
  let dashboard: DashboardPage, settings: SettingsPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    settings = dashboard.settings;
  });

  test('Create, and delete table, verify in audit tab, rename City table, update icon and reorder tables', async () => {
    await dashboard.treeView.createTable({ title: 'tablex' });
    await dashboard.treeView.verifyTable({ title: 'tablex' });

    await dashboard.treeView.deleteTable({ title: 'tablex' });
    await dashboard.treeView.verifyTable({ title: 'tablex', exists: false });

    await dashboard.gotoSettings();
    await settings.selectTab({ tab: SettingTab.Audit });
    await settings.audit.verifyRow({
      index: 0,
      opType: 'TABLE',
      opSubtype: 'DELETE',
      user: 'user@nocodb.com',
    });
    await settings.audit.verifyRow({
      index: 1,
      opType: 'TABLE',
      opSubtype: 'CREATE',
      user: 'user@nocodb.com',
    });
    await settings.close();

    await dashboard.treeView.renameTable({ title: 'City', newTitle: 'Cityx' });
    await dashboard.treeView.verifyTable({ title: 'Cityx' });

    await dashboard.treeView.focusTable({ title: 'Actor' });
    await dashboard.treeView.verifyTable({ title: 'Actor', index: 0 });
    await dashboard.treeView.reorderTables({
      sourceTable: 'Actor',
      destinationTable: 'Address',
    });
    await dashboard.treeView.verifyTable({ title: 'Address', index: 0 });

    // verify table icon customization
    await dashboard.treeView.openTable({ title: 'Address' });
    await dashboard.treeView.changeTableIcon({ title: 'Address', icon: 'american-football' });
    await dashboard.treeView.verifyTabIcon({ title: 'Address', icon: 'american-football' });
  });
});
