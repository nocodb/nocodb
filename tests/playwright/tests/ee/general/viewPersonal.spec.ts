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
import { WorkspacePage } from '../../../pages/WorkspacePage';

test.describe('Grid view personal', () => {
  const user1 = {
    email: 'view-test-user1@nocodb.com',
    password: getDefaultPwd(),
    role: 'creator',
  };
  const user2 = {
    email: 'view-test-user2@nocodb.com',
    password: getDefaultPwd(),
    role: 'viewer',
  };

  const users = [user1, user2];
  let loginPage;
  let api: Api<any>;
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
    loginPage = new LoginPage(page);

    // create users if not exists
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

  test.afterEach(async () => {
    await unsetup(context);
  });
  test('Personal mode', async () => {
    test.slow();
    const workspacePage = new WorkspacePage(dashboard.rootPage);
    const collaborationPage = workspacePage.collaboration;

    await dashboard.leftSidebar.clickTeamAndSettings();
    for (let i = 0; i < users.length; i++) {
      // add all users as WS viewers
      await collaborationPage.addUsers(loginPage.prefixEmail(users[i].email), users[i].role);
    }
    await dashboard.treeView.openTable({ title: 'Country' });

    // create a grid view since the default view cannot be marked as personal
    await dashboard.viewSidebar.createGridView({ title: 'CountryGrid' });
    await dashboard.viewSidebar.verifyView({ title: 'CountryGrid', index: 0 });

    // copy current page url
    const url = dashboard.rootPage.url();

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

    // open the copied url
    await dashboard.rootPage.goto(url);

    await dashboard.viewSidebar.verifyView({ title: 'CountryGrid', index: 0 });

    // verify view lock
    await dashboard.grid.verifyPersonalMode();
  });
});
