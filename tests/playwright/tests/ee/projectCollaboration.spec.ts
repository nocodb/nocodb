import { Page, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { unsetup } from '../../setup';
import { getDefaultPwd } from '../../tests/utils/general';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { Api } from 'nocodb-sdk';
import { CollaborationPage } from '../../pages/WorkspacePage/CollaborationPage';
import { LoginPage } from '../../pages/LoginPage';
import { ProjectViewPage } from '../../pages/Dashboard/ProjectView';

const roleDb = [
  { email: 'pjt_creator@nocodb.com', role: 'Creator' },
  { email: 'pjt_editor@nocodb.com', role: 'Editor' },
  { email: 'pjt_commenter@nocodb.com', role: 'Commenter' },
  { email: 'pjt_viewer@nocodb.com', role: 'Viewer' },
];

test.describe('Base Collaboration', () => {
  let dashboard: DashboardPage;
  let workspacePage: WorkspacePage;
  let collaborationPage: CollaborationPage;
  let baseViewPage: ProjectViewPage;
  let context: any;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    workspacePage = new WorkspacePage(page);
    collaborationPage = workspacePage.collaboration;
    baseViewPage = dashboard.baseView;

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

  const baseCollabVerify = async (
    page: Page,
    user: {
      email: string;
      role: string;
    }
  ) => {
    await dashboard.leftSidebar.clickTeamAndSettings();

    // add all users as WS viewers

    await collaborationPage.addUsers(user.email, 'viewer');

    await dashboard.treeView.openProject({ title: context.base.title, context });

    // tab access validation
    await baseViewPage.verifyAccess('Owner');
    await baseViewPage.openOverview();

    await baseViewPage.tab_accessSettings.click();

    // update roles

    await baseViewPage.accessSettings.setRole(user.email, user.role);

    await dashboard.signOut();

    const loginPage = new LoginPage(page);
    await loginPage.signIn({
      email: user.email,
      password: getDefaultPwd(),
      withoutPrefix: true,
      skipReload: true,
    });

    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.leftSidebar.openWorkspace({ title: context.workspace.title });
    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.treeView.openProject({ title: context.base.title, context });
    await dashboard.baseView.verifyAccess(user.role);

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.treeView.validateRoleAccess({
      role: user.role,
      baseTitle: context.base.title,
      tableTitle: 'Country',
      context,
    });
    await dashboard.viewSidebar.validateRoleAccess({ role: user.role });

    await dashboard.grid.verifyRoleAccess({ role: user.role });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyRoleAccess({ role: user.role });

    await dashboard.sidebar.baseNode.click({
      baseTitle: context.base.title,
    });
  };

  test('EE: Base role access validation: Creator', async ({ page }) => {
    await baseCollabVerify(page, roleDb[0]);

    const baseNode = dashboard.sidebar.baseNode;
    await baseNode.verifyTableAddBtn({ baseTitle: context.base.title, visible: true });

    await baseNode.clickOptions({ baseTitle: context.base.title });
    await baseNode.verifyProjectOptions({
      baseTitle: context.base.title,
      deleteVisible: false,
      duplicateVisible: true,
      importVisible: true,
      renameVisible: true,
      restApisVisible: true,
      settingsVisible: true,
      starredVisible: true,
      relationsVisible: true,
    });
  });

  test('EE: Base role access validation: Editor', async ({ page }) => {
    await baseCollabVerify(page, roleDb[1]);

    const baseNode = dashboard.sidebar.baseNode;
    await baseNode.verifyTableAddBtn({ baseTitle: context.base.title, visible: false });

    await baseNode.clickOptions({ baseTitle: context.base.title });
    await baseNode.verifyProjectOptions({
      baseTitle: context.base.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: true,
      relationsVisible: true,
    });
  });

  test('EE: Base role access validation: Commentor', async ({ page }) => {
    await baseCollabVerify(page, roleDb[2]);

    const baseNode = dashboard.sidebar.baseNode;
    await baseNode.verifyTableAddBtn({ baseTitle: context.base.title, visible: false });

    await baseNode.clickOptions({ baseTitle: context.base.title });
    await baseNode.verifyProjectOptions({
      baseTitle: context.base.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: true,
      relationsVisible: true,
    });
  });

  test('EE: Base role access validation: Viewer', async ({ page }) => {
    await baseCollabVerify(page, roleDb[3]);

    const baseNode = dashboard.sidebar.baseNode;
    await baseNode.verifyTableAddBtn({ baseTitle: context.base.title, visible: false });

    await baseNode.clickOptions({ baseTitle: context.base.title });
    await baseNode.verifyProjectOptions({
      baseTitle: context.base.title,
      deleteVisible: false,
      duplicateVisible: false,
      importVisible: false,
      renameVisible: false,
      restApisVisible: true,
      settingsVisible: false,
      starredVisible: true,
      relationsVisible: true,
    });
  });
});
