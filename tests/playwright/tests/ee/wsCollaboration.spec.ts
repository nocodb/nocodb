import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { unsetup } from '../../setup';
import { getDefaultPwd } from '../../tests/utils/general';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../pages/LoginPage';

const roleDb = [
  { email: 'ws_creator@nocodb.com', role: 'creator' },
  { email: 'ws_editor@nocodb.com', role: 'editor' },
  { email: 'ws_commenter@nocodb.com', role: 'commenter' },
  { email: 'ws_viewer@nocodb.com', role: 'viewer' },
];

test.describe('Collaborators', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    workspacePage = new WorkspacePage(page);
    collaborationPage = workspacePage.collaboration;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    for (let i = 0; i < roleDb.length; i++) {
      try {
        await api.auth.signup({
          email: roleDb[i].email,
          password: getDefaultPwd(),
        });
      } catch (e) {
        // ignore error even if user already exists
      }
    }
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('WS role access validation', async ({ page }) => {
    await dashboard.leftSidebar.clickTeamAndSettings();

    for (let i = 0; i < roleDb.length; i++) {
      await collaborationPage.addUsers(roleDb[i].email, roleDb[i].role);
    }

    for (let i = 0; i < roleDb.length; i++) {
      await dashboard.signOut();

      const loginPage = new LoginPage(page);
      await loginPage.signIn({
        email: roleDb[i].email,
        password: getDefaultPwd(),
        withoutPrefix: true,
        skipReload: true,
      });

      await dashboard.treeView.openProject({ title: context.project.title });

      // wait for render
      await dashboard.rootPage.waitForTimeout(1000);

      if (roleDb[i].role.toLowerCase() === 'creator') {
        await expect(dashboard.leftSidebar.btn_teamAndSettings).toBeVisible();
        await expect(dashboard.leftSidebar.btn_newProject).toBeVisible();

        await dashboard.leftSidebar.clickTeamAndSettings();
        await workspacePage.verifyAccess(roleDb[i].role.toLowerCase());
      } else {
        await expect(dashboard.leftSidebar.btn_teamAndSettings).toBeVisible({ visible: false });
        await expect(dashboard.leftSidebar.btn_newProject).toBeVisible({ visible: false });
      }

      // Needs license key; hence disabled
      // await workspacePage.verifyAccess(roleDb[i].role);
    }
  });
});
