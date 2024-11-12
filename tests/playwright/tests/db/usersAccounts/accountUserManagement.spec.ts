import { expect, test } from '@playwright/test';
import { AccountPage } from '../../../pages/Account';
import { AccountUsersPage } from '../../../pages/Account/Users';
import { SignupPage } from '../../../pages/SignupPage';
import setup, { unsetup } from '../../../setup';
import { getDefaultPwd } from '../../../tests/utils/general';
import { Api } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { LoginPage } from '../../../pages/LoginPage';
import { isEE } from '../../../setup/db';
let api: Api<any>;

const roleDb = [
  { email: `org_creator_@nocodb.com`, role: 'Organization Level Creator', url: '' },
  { email: `org_viewer_@nocodb.com`, role: 'Organization Level Viewer', url: '' },
];

test.describe('User roles', () => {
  // Org level roles are not available in EE
  if (isEE()) {
    test.skip();
  }

  let accountUsersPage: AccountUsersPage;
  let accountPage: AccountPage;
  let signupPage: SignupPage;
  let loginPage: LoginPage;
  let dashboard: DashboardPage;
  // @ts-ignore
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, isSuperUser: true });
    dashboard = new DashboardPage(page, context.base);
    accountPage = new AccountPage(page);
    accountUsersPage = new AccountUsersPage(accountPage);
    signupPage = new SignupPage(accountPage.rootPage);
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

    // check if user already exists; if so- remove them
    for (let i = 0; i < roleDb.length; i++) {
      const user = await api.orgUsers.list();
      if (user.list.length > 0) {
        // const u = user.list.find((u: any) => u.email === roleDb[i].email);
        const u = user.list.find((u: any) => u.email === accountUsersPage.prefixEmail(roleDb[i].email));
        if (u) await api.orgUsers.delete(u.id);
      }
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Invite user, update role and delete user', async () => {
    test.slow();

    await accountUsersPage.goto({ waitForResponse: true });

    // invite user
    for (let i = 0; i < roleDb.length; i++) {
      roleDb[i].url = await accountUsersPage.invite({
        email: roleDb[i].email,
        role: roleDb[i].role,
      });
      await accountUsersPage.closeInvite();
    }

    await signupAndVerify(0);
    await accountUsersPage.goto({ waitForResponse: true });
    await signupAndVerify(1);

    await dashboard.signOut();
    await loginPage.signIn({
      email: 'user@nocodb.com',
      password: getDefaultPwd(),
      withoutPrefix: true,
    });

    await accountUsersPage.goto({ waitForResponse: true });
    // change role
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.updateRole({
        email: roleDb[i].email,
        role: 'Organization Level Viewer',
      });
    }

    // delete user
    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.deleteUser({
        email: roleDb[i].email,
      });
    }
  });

  // signup and verify create base button exist or not based on role
  async function signupAndVerify(roleIdx: number) {
    await accountPage.signOut();

    await accountPage.rootPage.goto(roleDb[roleIdx].url);

    await signupPage.signUp({
      email: roleDb[roleIdx].email,
      password: getDefaultPwd(),
    });

    // wait for page rendering to complete after sign up
    await dashboard.rootPage.waitForTimeout(1000);

    if (roleDb[roleIdx].role === 'Organization Level Creator') {
      await expect(dashboard.leftSidebar.btn_newProject).toBeVisible();
    } else {
      await expect(dashboard.leftSidebar.btn_newProject).toHaveCount(0);
    }
  }
});
