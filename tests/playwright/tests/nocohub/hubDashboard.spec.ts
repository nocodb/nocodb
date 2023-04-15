import { expect, Locator, test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { NcContext } from '../../setup';
import setup from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';

test.describe('DashboardBasicTests', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  // let projectPage: ProjectsPage;
  let workspacePage: WorkspacePage;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    // projectPage = new ProjectsPage(page);
    workspacePage = new WorkspacePage(page);
  });

  test('default workspace and home page links', async () => {
    await dashboard.clickHome();
    // TODO: check for any errors in console or there should be no toast (error on screen)
    // currently there is an error: "Cannot set properties of null (setting 'meta')"
    // TODO: drop shadow on home button is empty (oss has version)

    // workspaces, explore, help, community, favorites, sharedWithMe, Recent, Notifications - links not functional.
    // add tests for existing behaviour and associated issues
    const urlBeforeClickEvent: string = dashboard.rootPage.url();
    await workspacePage.checkVisibleAndClick('nc-dash-nav-workspaces');
    await workspacePage.checkVisibleAndClick('nc-dash-nav-explore');
    await workspacePage.checkVisibleAndClick('nc-dash-nav-help');
    await workspacePage.checkVisibleAndClick('nc-dash-nav-community');

    // no change in url as these header links are not functional
    // TODO: once the implementation of these links are done, these tests has
    // to be fixed accordingly. tip: check for visibility only and add different
    // tests for click
    await expect(dashboard.rootPage).toHaveURL(urlBeforeClickEvent);

    // check for existence of default workspace
    await dashboard.rootPage.getByTitle(context.workspace.title, { exact: true }).click();
    await dashboard.rootPage.getByText(context.project.title, { exact: true }).click();

    // add expectations
  });

  // test.only('quick actions and shortcuts / search bar', async() => {
  //   await dashboard.clickHome();

  // });

  test.only('create new project and navigation', async () => {
    await dashboard.clickHome();
    // - create project, Load product page to project page
    // - go to home page / dashboard and check for project_name, color, last accessed, my role, actions
  });

  // test.only('project collabarators, preferences', async() => {
  //   //
  // });
});
