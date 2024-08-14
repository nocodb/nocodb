import { expect, Page, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup, { NcContext, unsetup } from '../../setup';
import { getDefaultPwd } from '../../tests/utils/general';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { Api, ProjectTypes } from 'nocodb-sdk';
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
  let context: NcContext;
  let api: Api<any>;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
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

  const testUserAccess = async (page: Page, user: { email: string; role: string }) => {
    await dashboard.leftSidebar.clickTeamAndSettings();

    await collaborationPage.addUsers(user.email, user.role);

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
    // wait for render
    await dashboard.rootPage.waitForTimeout(1000);

    if (user.role.toLowerCase() === 'creator') {
      await expect(dashboard.leftSidebar.btn_newProject).toBeVisible();
      await dashboard.leftSidebar.clickTeamAndSettings();
      await workspacePage.verifyAccess(user.role.toLowerCase());
    } else {
      await expect(dashboard.leftSidebar.btn_newProject).toBeVisible({ visible: false });
    }

    // Needs license key; hence disabled
    // await workspacePage.verifyAccess(roleDb[i].role);
  };

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('WS role access validation: creator', async ({ page }) => {
    await testUserAccess(page, roleDb[0]);

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

    await dashboard.sidebar.createProject({ title: 'test', type: ProjectTypes.DATABASE });
    await baseNode.clickOptions({ baseTitle: 'test' });
    await baseNode.verifyProjectOptions({
      baseTitle: 'test',
      deleteVisible: true,
      duplicateVisible: true,
      importVisible: true,
      renameVisible: true,
      restApisVisible: true,
      settingsVisible: true,
      starredVisible: true,
      relationsVisible: true,
    });

    await dashboard.sidebar.verifyQuickActions({ isVisible: true });
    await dashboard.sidebar.verifyTeamAndSettings({ isVisible: true });
    await dashboard.sidebar.verifyCreateProjectBtn({ isVisible: true });

    await dashboard.sidebar.tableNode.clickOptions({ tableTitle: 'Features' });
    await dashboard.sidebar.tableNode.verifyTableOptions({
      tableTitle: 'Features',
      isVisible: true,
      deleteVisible: true,
      duplicateVisible: true,
      renameVisible: true,
    });
  });

  test('WS role access validation: editor', async ({ page }) => {
    await testUserAccess(page, roleDb[1]);

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

    await dashboard.sidebar.verifyQuickActions({ isVisible: true });
    await dashboard.sidebar.verifyTeamAndSettings({ isVisible: true });
    await dashboard.sidebar.verifyCreateProjectBtn({ isVisible: false });

    await dashboard.sidebar.tableNode.verifyTableOptions({
      tableTitle: 'Features',
      isVisible: false,
    });
  });

  test('WS role access validation: commenter', async ({ page }) => {
    await testUserAccess(page, roleDb[2]);

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

    await dashboard.sidebar.verifyQuickActions({ isVisible: true });
    await dashboard.sidebar.verifyTeamAndSettings({ isVisible: true });
    await dashboard.sidebar.verifyCreateProjectBtn({ isVisible: false });

    await dashboard.sidebar.tableNode.verifyTableOptions({
      tableTitle: 'Features',
      isVisible: false,
    });
  });

  test('WS role access validation: viewer', async ({ page }) => {
    await testUserAccess(page, roleDb[3]);

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

    await dashboard.sidebar.verifyQuickActions({ isVisible: true });
    await dashboard.sidebar.verifyTeamAndSettings({ isVisible: true });
    await dashboard.sidebar.verifyCreateProjectBtn({ isVisible: false });

    await dashboard.sidebar.tableNode.verifyTableOptions({
      tableTitle: 'Features',
      isVisible: false,
    });
  });
});
