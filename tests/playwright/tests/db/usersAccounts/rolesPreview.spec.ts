import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { SettingsPage, SettingTab } from '../../../pages/Dashboard/Settings';
import { Api } from 'nocodb-sdk';
import { AccountUsersPage } from '../../../pages/Account/Users';
import { AccountPage } from '../../../pages/Account';
import { LoginPage } from '../../../pages/LoginPage';
import { isEE } from '../../../setup/db';
let api: Api<any>;

const roles = ['Editor', 'Commenter', 'Viewer'];

test.describe('Preview Mode', () => {
  test.slow();

  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let settings: SettingsPage;
  let accountPage: AccountPage;
  let accountUsersPage: AccountUsersPage;
  let loginPage: LoginPage;

  let context: any;
  let userEmail = '';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    settings = dashboard.settings;
    accountPage = new AccountPage(page);
    accountUsersPage = new AccountUsersPage(accountPage);
    loginPage = new LoginPage(accountPage.rootPage);

    try {
      api = new Api({
        baseURL: `http://localhost:8080/`,
        headers: {
          'xc-auth': context.token,
        },
      });
    } catch (e) {
      console.log(e);
    }

    userEmail = accountUsersPage.prefixEmail('uiACL@nocodb.com');

    try {
      // check if user already exists; if so- remove them
      const user = await api.auth.baseUserList(context.base.id);
      if (user.users.list.length > 0) {
        const u = user.users.list.find((u: any) => u.email === userEmail);
        if (u) {
          await api.auth.baseUserRemove(context.base.id, u.id);
        }
      }

      // create user if not exists
      try {
        await api.auth.signup({
          email: userEmail,
          password: '12345678',
        });
      } catch (e) {
        console.log(e);
      }

      await api.auth.baseUserAdd(context.base.id, {
        roles: 'editor',
        email: userEmail,
      });
    } catch (e) {
      // ignore error
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Preview Mode', async () => {
    if (!isEE()) test.skip();

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    // configure ACL
    // configure access control
    await dashboard.gotoSettings();
    await settings.selectTab({
      tab: SettingTab.DataSources,
    });
    await settings.dataSources.openAcl({ dataSourceName: 'Default' });
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'editor' });
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'commenter' });
    await settings.dataSources.acl.toggle({ table: 'Language', role: 'viewer' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'editor' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'commenter' });
    await settings.dataSources.acl.toggle({ table: 'CustomerList', role: 'viewer' });
    await settings.dataSources.acl.save();
    await settings.close();

    await dashboard.gotoSettings();
    await settings.selectTab({
      tab: SettingTab.DataSources,
    });
    await settings.dataSources.openAcl({ dataSourceName: 'Default' });

    await settings.dataSources.acl.verify({ table: 'Language', role: 'editor', expectedValue: false });
    await settings.dataSources.acl.verify({ table: 'Language', role: 'commenter', expectedValue: false });
    await settings.dataSources.acl.verify({ table: 'Language', role: 'viewer', expectedValue: false });
    await settings.dataSources.acl.verify({ table: 'CustomerList', role: 'editor', expectedValue: false });
    await settings.dataSources.acl.verify({ table: 'CustomerList', role: 'commenter', expectedValue: false });
    await settings.dataSources.acl.verify({ table: 'CustomerList', role: 'viewer', expectedValue: false });

    await settings.close();
    await dashboard.signOut();

    await loginPage.signIn({
      email: userEmail,
      password: '12345678',
      withoutPrefix: true,
    });

    await dashboard.treeView.verifyTable({
      title: 'Actor',
      exists: true,
    });
    await dashboard.treeView.verifyTable({
      title: 'Language',
      exists: false,
    });
    await dashboard.treeView.verifyTable({
      title: 'CustomerList',
      exists: false,
    });
  });
});
