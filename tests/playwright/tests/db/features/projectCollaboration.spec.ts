import { Page, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { getDefaultPwd } from '../../../tests/utils/general';

import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../../pages/LoginPage';
import { ProjectViewPage } from '../../../pages/Dashboard/ProjectView';
import { AccountUsersPage } from '../../../pages/Account/Users';
import { AccountPage } from '../../../pages/Account';

const roleDb = [
  { email: 'pjt_creator@nocodb.com', role: 'Creator' },
  { email: 'pjt_editor@nocodb.com', role: 'Editor' },
  { email: 'pjt_commenter@nocodb.com', role: 'Commenter' },
  { email: 'pjt_viewer@nocodb.com', role: 'Viewer' },
];

test.describe('Project Collaboration', () => {
  let dashboard: DashboardPage;
  let accountsPage: AccountPage;
  let collaborationPage: CollaborationPage;
  let projectViewPage: ProjectViewPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.project);
    accountsPage = new AccountPage(page);
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
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  const projectCollabVerify = async (
    page: Page,
    user: {
      email: string;
      role: string;
    }
  ) => {
    await dashboard.leftSidebar.clickTeamAndSettings();

    // add all users as WS viewers

    await accountsPage.users.invite({
      email: user.email,
      role: 'viewer',
    });

    await dashboard.rootPage.goBack();

    await dashboard.treeView.openProject({ title: context.project.title });

    // tab access validation
    await projectViewPage.verifyAccess('Owner');

    await projectViewPage.tab_accessSettings.click();

    // update roles

    await projectViewPage.accessSettings.setRole(user.email, user.role);

    await dashboard.signOut();

    const loginPage = new LoginPage(page);
    await loginPage.signIn({
      email: user.email,
      password: getDefaultPwd(),
      withoutPrefix: true,
      skipReload: true,
    });

    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.projectView.verifyAccess(user.role);

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.treeView.validateRoleAccess({
      role: user.role,
      projectTitle: context.project.title,
      tableTitle: 'Country',
    });
    await dashboard.viewSidebar.validateRoleAccess({ role: user.role });

    await dashboard.grid.verifyRoleAccess({ role: user.role });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyRoleAccess({ role: user.role });

    await dashboard.sidebar.projectNode.click({
      projectTitle: context.project.title,
    });
  };

  test('Project role access validation: Creator', async ({ page }) => {
    await projectCollabVerify(page, roleDb[0]);

    const projectNode = dashboard.sidebar.projectNode;
    await projectNode.verifyTableAddBtn({ projectTitle: context.project.title, visible: true });

    await projectNode.clickOptions({ projectTitle: context.project.title });
    await projectNode.verifyProjectOptions({
      projectTitle: context.project.title,
      deleteVisible: false,
      duplicateVisible: true,
      importVisible: true,
      renameVisible: true,
      restApisVisible: true,
      settingsVisible: true,
      starredVisible: false,
      relationsVisible: true,
      copyProjectInfoVisible: true,
    });
  });

  test('Project role access validation: Editor', async ({ page }) => {
    await projectCollabVerify(page, roleDb[1]);

    const projectNode = dashboard.sidebar.projectNode;
    await projectNode.verifyTableAddBtn({ projectTitle: context.project.title, visible: false });

    await projectNode.clickOptions({ projectTitle: context.project.title });
    await projectNode.verifyProjectOptions({
      projectTitle: context.project.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: false,
      relationsVisible: true,
      copyProjectInfoVisible: true,
    });
  });

  test('Project role access validation: Commentor', async ({ page }) => {
    await projectCollabVerify(page, roleDb[2]);

    const projectNode = dashboard.sidebar.projectNode;
    await projectNode.verifyTableAddBtn({ projectTitle: context.project.title, visible: false });

    await projectNode.clickOptions({ projectTitle: context.project.title });
    await projectNode.verifyProjectOptions({
      projectTitle: context.project.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: false,
      relationsVisible: true,
      copyProjectInfoVisible: true,
    });
  });

  test('Project role access validation: Viewer', async ({ page }) => {
    await projectCollabVerify(page, roleDb[3]);

    const projectNode = dashboard.sidebar.projectNode;
    await projectNode.verifyTableAddBtn({ projectTitle: context.project.title, visible: false });

    await projectNode.clickOptions({ projectTitle: context.project.title });
    await projectNode.verifyProjectOptions({
      projectTitle: context.project.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: false,
      relationsVisible: true,
      copyProjectInfoVisible: true,
    });
  });
});
