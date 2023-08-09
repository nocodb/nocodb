import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { getDefaultPwd } from '../../../tests/utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../../pages/LoginPage';
import { isEE } from '../../../setup/db';

const roleDb = [
  { email: 'ws_creator@nocodb.com', role: 'creator' },
  { email: 'ws_editor@nocodb.com', role: 'editor' },
  { email: 'ws_commenter@nocodb.com', role: 'commenter' },
  { email: 'ws_viewer@nocodb.com', role: 'viewer' },
];

test.describe('Collaborators', () => {
  if (!isEE()) {
    test.skip();
    return;
  }

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

    await dashboard.leftSidebar.home.click();
  });

  test('WS role access validation', async ({ page }) => {
    await workspacePage.Container.collaborators.click();

    for (let i = 0; i < roleDb.length; i++) {
      await collaborationPage.addUsers(roleDb[i].email, roleDb[i].role);
    }

    for (let i = 0; i < roleDb.length; i++) {
      await workspacePage.Header.accountMenuOpen({ title: 'sign-out' });

      const loginPage = new LoginPage(page);
      await loginPage.signIn({
        email: roleDb[i].email,
        password: getDefaultPwd(),
        withoutPrefix: true,
        skipReload: true,
      });

      await workspacePage.waitFor({ state: 'visible' });

      await workspacePage.workspaceOpen({ title: context.workspace.title });
      await workspacePage.verifyAccess(roleDb[i].role);
    }
  });
});
