import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { getDefaultPwd } from '../../utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../../pages/LoginPage';

let api: Api<any>;

const roleDb = [
  { email: 'pjt_creator@nocodb.com', role: 'creator' },
  { email: 'pjt_editor@nocodb.com', role: 'editor' },
  { email: 'pjt_commenter@nocodb.com', role: 'commenter' },
  { email: 'pjt_viewer@nocodb.com', role: 'viewer' },
];

test.describe.only('Project Collaboration', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;
  let context: any;

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

  test('Project role access validation', async ({ page }) => {
    await workspacePage.Container.collaborators.click();

    // add all users as WS viewers
    for (let i = 0; i < roleDb.length; i++) {
      await collaborationPage.addUsers(roleDb[i].email, 'viewer');
    }

    await workspacePage.Container.projects.click();
    await workspacePage.projectOpen(context.project.title);

    await dashboard.projectView.tab_accessSettings.click();

    for (let i = 0; i < roleDb.length; i++) {
      await dashboard.signOut();

      const loginPage = new LoginPage(page);
      await loginPage.signIn({
        email: roleDb[i].email,
        password: getDefaultPwd(),
        withoutPrefix: true,
        skipReload: true,
      });

      await workspacePage.workspaceOpen({ title: context.workspace.title });
      await workspacePage.projectOpen({ title: context.project.title });
      await dashboard.projectView.verifyAccess(roleDb[i].role);
    }
  });
});
