import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { Api } from 'nocodb-sdk';
import { AccountUsersPage } from '../../../pages/Account/Users';
import { AccountPage } from '../../../pages/Account';
import { LoginPage } from '../../../pages/LoginPage';
import { isEE } from '../../../setup/db';
import { DataSourcePage } from '../../../pages/Dashboard/ProjectView/DataSourcePage';
let api: Api<any>;

const roles = ['Editor', 'Commenter', 'Viewer'];

test.describe('Preview Mode', () => {
  test.slow();

  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let dataSources: DataSourcePage;
  let accountPage: AccountPage;
  let accountUsersPage: AccountUsersPage;
  let loginPage: LoginPage;

  let context: any;
  let userEmail = '';

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
    dataSources = dashboard.baseView.dataSources;
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
    // configure ACL
    // configure access control
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.tab_dataSources.click();

    await dataSources.openAcl({ dataSourceName: 'Default' });
    await dataSources.acl.toggle({ table: 'Language', role: 'editor' });
    await dataSources.acl.toggle({ table: 'Language', role: 'commenter' });
    await dataSources.acl.toggle({ table: 'Language', role: 'viewer' });
    await dataSources.acl.toggle({ table: 'CustomerList', role: 'editor' });
    await dataSources.acl.toggle({ table: 'CustomerList', role: 'commenter' });
    await dataSources.acl.toggle({ table: 'CustomerList', role: 'viewer' });
    await dataSources.acl.save();
    await dataSources.closeDsDetailsModal();

    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.tab_dataSources.click();

    await dataSources.openAcl({ dataSourceName: 'Default' });

    await dataSources.acl.verify({ table: 'Language', role: 'editor', expectedValue: false });
    await dataSources.acl.verify({ table: 'Language', role: 'commenter', expectedValue: false });
    await dataSources.acl.verify({ table: 'Language', role: 'viewer', expectedValue: false });
    await dataSources.acl.verify({ table: 'CustomerList', role: 'editor', expectedValue: false });
    await dataSources.acl.verify({ table: 'CustomerList', role: 'commenter', expectedValue: false });
    await dataSources.acl.verify({ table: 'CustomerList', role: 'viewer', expectedValue: false });

    await dataSources.closeDsDetailsModal();
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
