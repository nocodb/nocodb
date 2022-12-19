import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { SettingsPage, SettingTab } from '../pages/Dashboard/Settings';

const roles = ['Editor', 'Commenter', 'Viewer'];

test.describe('Preview Mode', () => {
  test.slow();

  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let settings: SettingsPage;

  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    toolbar = dashboard.grid.toolbar;
    settings = dashboard.settings;
  });

  test('Preview Mode', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    // configure ACL
    // configure access control
    await dashboard.gotoSettings();
    await settings.selectTab({
      tab: SettingTab.DataSources,
    });
    await settings.dataSources.openAcl();
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'editor' });
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'commenter' });
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'viewer' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'editor' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'commenter' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'viewer' });
    await settings.dataSources.acl.save();
    await settings.close();

    // Role test
    for (let i = 0; i < roles.length; i++) {
      await roleTest(roles[i]);
    }
  });

  async function roleTest(role: string) {
    await dashboard.grid.projectMenu.toggle();
    await dashboard.grid.projectMenu.click({
      menu: 'Preview as',
      subMenu: role,
    });

    // wait for preview mode to be enabled
    await dashboard.rootPage.locator('.nc-preview-btn-exit-to-app').waitFor();
    // todo: Otherwise grid will be stuck at loading even tho the data is loaded
    await dashboard.rootPage.waitForTimeout(2500);

    await dashboard.validateProjectMenu({
      role: role.toLowerCase(),
    });

    await dashboard.rootPage.waitForTimeout(1500);

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await toolbar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.treeView.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.validateRoleAccess({
      role: role.toLowerCase(),
    });

    // Access control validation
    await dashboard.treeView.verifyTable({
      title: 'Language',
      exists: role.toLowerCase() === 'creator' ? true : false,
    });
    await dashboard.treeView.verifyTable({
      title: 'CustomerList',
      exists: role.toLowerCase() === 'creator' ? true : false,
    });

    // close preview mode
    await dashboard.rootPage.locator('.nc-preview-btn-exit-to-app').click();
  }
});
