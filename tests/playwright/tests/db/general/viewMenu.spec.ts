import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { isPg } from '../../../setup/db';
import { getDefaultPwd } from '../../utils/general';
import { AccountPage } from '../../../pages/Account';
import { SignupPage } from '../../../pages/SignupPage';
import { Api } from 'nocodb-sdk';
import { LoginPage } from '../../../pages/LoginPage';
import { AccountUsersPage } from '../../../pages/Account/Users';

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

  test.describe('Personal mode', () => {
    const user1 = {
      email: 'view-test-user1@nocodb.com',
      password: getDefaultPwd(),
      role: 'Organization Level Creator',
    };
    const user2 = {
      email: 'view-test-user2@nocodb.com',
      password: getDefaultPwd(),
      role: 'Organization Level Viewer',
    };

    const users = [user1, user2];
    let loginPage;
    let accountPage;
    let accountUsersPage;
    let api: Api<any>;

    test.beforeEach(async ({ page }) => {
      api = new Api({
        baseURL: `http://localhost:8080/`,
        headers: {
          'xc-auth': context.token,
        },
      });
      loginPage = new LoginPage(page);
      accountPage = new AccountPage(page);
      accountUsersPage = new AccountUsersPage(accountPage);
      for (let i = 0; i < users.length; i++) {
        try {
          await api.auth.signup({
            email: loginPage.prefixEmail(users[i].email),
            password: users[i].password,
          });
        } catch (e) {
          // ignore error even if user already exists
        }
      }
    });

    test.only('Personal mode', async () => {
      await accountUsersPage.goto({ waitForResponse: true });

      // invite user
      for (let i = 0; i < users.length; i++) {
        users[i].url = await accountUsersPage.invite({
          email: users[i].email,
          role: users[i].role,
        });
        await accountUsersPage.closeInvite();
      }

      await dashboard.treeView.openTable({ title: 'Country' });

      // create a grid view since the default view cannot be marked as personal
      await dashboard.viewSidebar.createGridView({ title: 'CountryGrid' });
      await dashboard.viewSidebar.verifyView({ title: 'CountryGrid', index: 0 });

      await dashboard.grid.verifyCollaborativeMode();

      // enable personal view
      await dashboard.grid.toolbar.viewsMenu.click({
        menu: 'View Mode',
        subMenu: 'Personal',
      });

      await dashboard.treeView.openTable({ title: 'Country' });

      // create a grid view since the default view cannot be marked as personal
      await dashboard.viewSidebar.createGridView({ title: 'CountryGrid' });
      await dashboard.viewSidebar.verifyView({ title: 'CountryGrid', index: 0 });

      await dashboard.grid.verifyCollaborativeMode();

      // enable personal view
      await dashboard.grid.toolbar.viewsMenu.click({
        menu: 'View Mode',
        subMenu: 'Personal',
      });

      // verify view lock
      // await dashboard.grid.verifyPersonalMode();

      await dashboard.signOut();

      await loginPage.goto();

      await loginPage.signIn({
        email: user2.email,
        password: user2.password,
      });

      await dashboard.signOut();
      await dashboard.rootPage.goto('/#/signup');

      await loginPage.signIn({
        email: user1.email,
        password: user1.password,
      });

      // verify view lock
      await dashboard.grid.verifyPersonalMode();
    });
  });

  test('Download CSV', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.toolbar.clickFields();
    // Hide 'LastUpdate' column
    await dashboard.grid.toolbar.fields.click({
      title: 'LastUpdate',
    });

    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'Download',
      subMenu: 'Download CSV',
      verificationInfo: {
        verificationFile: isPg(context) ? './fixtures/expectedBaseDownloadDataPg.txt' : null,
      },
    });
  });

  test('Download XLSX', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.toolbar.clickFields();
    // Hide 'LastUpdate' column
    await dashboard.grid.toolbar.fields.click({
      title: 'LastUpdate',
    });

    await dashboard.grid.toolbar.viewsMenu.click({
      menu: 'Download',
      subMenu: 'Download Excel',
      verificationInfo: {
        verificationFile: isPg(context) ? './fixtures/expectedBaseDownloadDataPg.txt' : null,
      },
    });
  });
});
