import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { getDefaultPwd } from '../../utils/general';
import { WorkspacePage } from '../../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../../pages/LoginPage';
import { ProjectViewPage } from '../../../pages/Dashboard/ProjectView';

let api: Api<any>;

const roleDb = [
  { email: 'pjt_creator@nocodb.com', role: 'Creator' },
  { email: 'pjt_editor@nocodb.com', role: 'Editor' },
  { email: 'pjt_commenter@nocodb.com', role: 'Commenter' },
  { email: 'pjt_viewer@nocodb.com', role: 'Viewer' },
];

test.describe('Project Collaboration', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;
  let projectViewPage: ProjectViewPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    workspacePage = new WorkspacePage(page);
    collaborationPage = workspacePage.collaboration;
    projectViewPage = dashboard.projectView;

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

    // tab access validation
    await projectViewPage.verifyAccess('Owner');

    await projectViewPage.tab_accessSettings.click();

    // update roles
    for (let i = 0; i < roleDb.length; i++) {
      await projectViewPage.accessSettings.setRole(roleDb[i].email, roleDb[i].role);
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

      await workspacePage.workspaceOpen({ title: context.workspace.title });
      await workspacePage.projectOpen({ title: context.project.title });
      await dashboard.projectView.verifyAccess(roleDb[i].role);

      await dashboard.treeView.openTable({ title: 'Country' });
      await dashboard.treeView.validateRoleAccess({ role: roleDb[i].role });
      await dashboard.viewSidebar.validateRoleAccess({ role: roleDb[i].role });

      await dashboard.grid.validateRoleAccess({ role: roleDb[i].role });

      // await dashboard.grid.toolbar.validateRoleAccess({ role: roleDb[i].role });
      //
      // await dashboard.grid.openExpandedRow({ index: 0 });
      // await dashboard.expandedForm.validateRoleAccess({ role: roleDb[i].role });
    }
  });
});
