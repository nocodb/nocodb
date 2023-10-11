import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { SignupPage } from '../../../pages/SignupPage';
import { ProjectsPage } from '../../../pages/ProjectsPage';
import { getDefaultPwd } from '../../../tests/utils/general';
import { isEE } from '../../../setup/db';

const roleDb = [
  { email: 'creator@nocodb.com', role: 'creator', url: '' },
  { email: 'editor@nocodb.com', role: 'editor', url: '' },
  { email: 'commenter@nocodb.com', role: 'commenter', url: '' },
  { email: 'viewer@nocodb.com', role: 'viewer', url: '' },
];

test.describe.skip('User roles', () => {
  if (isEE()) {
    test.skip();
  }
  let dashboard: DashboardPage;
  let signupPage: SignupPage;
  let projectsPage: ProjectsPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    signupPage = new SignupPage(page);
    projectsPage = new ProjectsPage(page);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create role', async () => {
    test.slow();

    for (let i = 0; i < roleDb.length; i++) {
      await dashboard.baseView.btn_share.click();
      roleDb[i].url = await settings.teams.invite({
        email: roleDb[i].email,
        role: roleDb[i].role,
      });
      console.log(roleDb[i].url);
    }

    // Role test
    for (let i = 0; i < roleDb.length; i++) {
      await roleTest(i);
    }
  });

  async function roleTest(roleIdx: number) {
    await roleSignup(roleIdx);
    await dashboard.validateWorkspaceMenu({
      role: roleDb[roleIdx].role,
    });

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.viewSidebar.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.toolbar.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.treeView.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyRoleAccess({
      role: roleDb[roleIdx].role,
    });

    // Access control validation
    await dashboard.treeView.verifyTable({
      title: 'Language',
      exists: roleDb[roleIdx].role === 'creator' ? true : false,
    });
    await dashboard.treeView.verifyTable({
      title: 'CustomerList',
      exists: roleDb[roleIdx].role === 'creator' ? true : false,
    });

    // Base page validation
    await dashboard.clickHome();
    await projectsPage.validateRoleAccess({
      role: roleDb[roleIdx].role,
    });

    await projectsPage.openProject({
      title: context.base.title,
      waitForAuthTab: roleDb[roleIdx].role === 'creator',
      withoutPrefix: true,
    });
  }

  async function roleSignup(roleIdx: number) {
    await dashboard.signOut();

    await dashboard.rootPage.goto(roleDb[roleIdx].url);
    await signupPage.signUp({
      email: roleDb[roleIdx].email,
      password: getDefaultPwd(),
    });

    await workspacePage.baseOpen({ title: context.base.title });

    // close 'Team & Auth' tab
    if (roleDb[roleIdx].role === 'creator') {
      await dashboard.closeTab({ title: 'Team & Auth' });
    }
  }
});
