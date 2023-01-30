import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';
import { LoginPage } from '../pages/LoginPage';
import { ProjectsPage } from '../pages/ProjectsPage';

test.describe('Shared base', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;
  let loginPage: LoginPage;
  let projectPage: ProjectsPage;

  async function roleTest(role: string) {
    // todo: Wait till the page is loaded
    await dashboard.rootPage.waitForTimeout(2000);

    await dashboard.validateProjectMenu({
      role: role.toLowerCase(),
      mode: 'shareBase',
    });

    await dashboard.treeView.openTable({ title: 'Country', mode: 'shareBase' });

    await dashboard.viewSidebar.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await toolbar.validateRoleAccess({
      role: role.toLowerCase(),
      mode: 'shareBase',
    });

    await dashboard.treeView.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.validateRoleAccess({
      role: role.toLowerCase(),
    });

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.validateRoleAccess({
      role: role.toLowerCase(),
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    projectPage = new ProjectsPage(page);
    toolbar = dashboard.grid.toolbar;
    loginPage = new LoginPage(page);
  });

  test('#1', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.gotoSettings();
    await dashboard.settings.teams.clickInviteTeamBtn();
    await dashboard.settings.teams.toggleSharedBase({ toggle: true });
    await dashboard.settings.teams.sharedBaseRole({ role: 'editor' });
    let url = await dashboard.settings.teams.getSharedBaseUrl();
    await dashboard.settings.teams.closeInvite();
    await dashboard.settings.close();

    await dashboard.rootPage.waitForTimeout(2000);
    // access shared base link
    await dashboard.signOut();
    await dashboard.rootPage.waitForTimeout(2000);
    // todo: Move this to a page object
    await dashboard.rootPage.goto(url);

    await roleTest('editor');

    await loginPage.signIn({
      email: 'user@nocodb.com',
      password: 'Password123.',
      withoutPrefix: true,
    });

    await projectPage.openProject({ title: context.project.title, withoutPrefix: true });
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.gotoSettings();
    await dashboard.settings.teams.clickInviteTeamBtn();
    await dashboard.settings.teams.toggleSharedBase({ toggle: true });
    await dashboard.settings.teams.sharedBaseRole({ role: 'viewer' });
    url = await dashboard.settings.teams.getSharedBaseUrl();
    await dashboard.settings.teams.closeInvite();
    await dashboard.settings.close();

    await dashboard.rootPage.waitForTimeout(2000);
    // access shared base link
    await dashboard.signOut();
    // todo: Move this to a page object
    await dashboard.rootPage.goto(url);

    await roleTest('viewer');
  });
});
