import { expect, test } from '@playwright/test';
import axios from 'axios';
import { AccountPage } from '../../../pages/Account';
import { AccountUsersPage } from '../../../pages/Account/Users';
import { SignupPage } from '../../../pages/SignupPage';
import setup, { unsetup } from '../../../setup';
import { getDefaultPwd } from '../../../tests/utils/general';
import { Api, WorkspaceUserRoles } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { LoginPage } from '../../../pages/LoginPage';
let api: Api<any>;

const roleDb = [
  { email: `ws_creator_@nocodb.com`, role: 'creator', url: '' },
  { email: `ws_viewer_@nocodb.com`, role: 'viewer', url: '' },
];

test.describe('User roles', () => {
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
        const u = user.list.find((u: any) => u.email === accountUsersPage.prefixEmail(roleDb[i].email));
        if (u) await api.orgUsers.delete(u.id);
      }
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Invite user, assign workspace role, verify access and delete user', async () => {
    test.slow();

    // Step 1: Navigate to account users page and invite users (no role — org roles are deprecated)
    await accountUsersPage.goto({ waitForResponse: true });

    for (let i = 0; i < roleDb.length; i++) {
      roleDb[i].url = await accountUsersPage.invite({
        email: roleDb[i].email,
      });
      await accountUsersPage.closeInvite();
    }

    // Step 2: Sign up as each invited user
    for (let i = 0; i < roleDb.length; i++) {
      // First iteration: on account page; subsequent iterations: on dashboard after signup
      if (i === 0) {
        await accountPage.signOut();
      } else {
        await dashboard.signOut();
      }
      await accountPage.rootPage.goto(roleDb[i].url);

      await signupPage.signUp({
        email: roleDb[i].email,
        password: getDefaultPwd(),
      });

      // wait for page rendering to complete after sign up
      await dashboard.rootPage.waitForTimeout(1000);
    }

    // Step 3: Sign back in as super admin
    await dashboard.signOut();
    await loginPage.signIn({
      email: 'user@nocodb.com',
      password: getDefaultPwd(),
      withoutPrefix: true,
    });

    // Step 4: Assign workspace-level roles via API
    // Get fresh token since original was invalidated during sign-out/sign-in cycles
    const signInRes = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
      email: 'user@nocodb.com',
      password: getDefaultPwd(),
    });
    const freshToken = signInRes.data.token;

    const wsRoleMap: Record<string, string> = {
      creator: WorkspaceUserRoles.CREATOR,
      viewer: WorkspaceUserRoles.VIEWER,
    };

    // Get workspace ID from appInfo or context
    const appInfoRes = await axios.get('http://localhost:8080/api/v1/meta/nocodb/info', {
      headers: { 'xc-auth': freshToken },
    });
    const workspaceId = appInfoRes.data.defaultWorkspaceId || context.base?.fk_workspace_id;

    for (let i = 0; i < roleDb.length; i++) {
      const email = accountUsersPage.prefixEmail(roleDb[i].email);
      const roles = wsRoleMap[roleDb[i].role];
      await axios.post(
        `http://localhost:8080/api/v1/workspaces/${workspaceId}/invitations`,
        { email, roles },
        { headers: { 'xc-auth': freshToken } }
      );
    }

    // Step 5: Verify access — log in as each user and check "Create Base" button visibility
    for (let i = 0; i < roleDb.length; i++) {
      await dashboard.signOut();
      await loginPage.signIn({
        email: accountUsersPage.prefixEmail(roleDb[i].email),
        password: getDefaultPwd(),
        withoutPrefix: true,
      });

      await dashboard.rootPage.waitForTimeout(1000);

      await dashboard.leftSidebar.verifyBaseListOpen(true);
      await dashboard.leftSidebar.openBaseListModal();

      if (roleDb[i].role === 'creator') {
        await expect(dashboard.leftSidebar.btn_newProject.last()).toBeVisible();
      } else {
        await expect(dashboard.leftSidebar.btn_newProject.last()).toHaveCount(0);
      }

      await dashboard.leftSidebar.closeBaseListModal();
    }

    // Step 6: Sign back in as super admin and delete users from account page
    await dashboard.signOut();
    await loginPage.signIn({
      email: 'user@nocodb.com',
      password: getDefaultPwd(),
      withoutPrefix: true,
    });

    await accountUsersPage.goto({ waitForResponse: true });

    for (let i = 0; i < roleDb.length; i++) {
      await accountUsersPage.deleteUser({
        email: roleDb[i].email,
      });
    }
  });
});
