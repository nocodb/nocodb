import { expect, test } from '@playwright/test';
import setup from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { DashboardPage } from '../../pages/Dashboard';
import { isEE } from '../../setup/db';

test.describe('DashboardBasicTests', () => {
  if (!isEE()) {
    test.skip();
    return;
  }

  let wsPage: WorkspacePage;
  let dashboardPage: DashboardPage;
  let context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true, url: '/#/' });
    wsPage = new WorkspacePage(page);
    dashboardPage = new DashboardPage(page, context.project);
  });

  test('Page load & static configurations verification', async () => {
    await wsPage.waitFor({ state: 'visible' });
    await wsPage.workspaceOpen({ title: context.workspace.title });

    // verify static elements : fixed menu items, buttons, etc.
    await wsPage.verifyStaticElements();

    // verify run-time elements : dynamic menu items
    await wsPage.LeftSideBar.verifyDynamicElements([{ title: context.workspace.title, role: 'owner' }]);

    // first row
    await wsPage.Container.verifyDynamicElements({
      title: context.project.title,
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // TODO: Once implemented, verify page navigation & page specific elements
    //
    // await wsPage.Header.openMenu({ title: 'Workspaces' });
    // await wsPage.Header.openMenu({ title: 'Explore' });
    // await wsPage.Header.openMenu({ title: 'Help' });
    // await wsPage.Header.openMenu({ title: 'Community' });
  });

  test('Workspace Basic CRUD', async () => {
    const ws2Title = context.workspace.title + '1';
    const leftPanel = await wsPage.LeftSideBar;
    await wsPage.workspaceCreate({
      title: ws2Title,
    });
    await leftPanel.verifyDynamicElements([
      { title: ws2Title, role: 'owner' },
      { title: ws2Title, role: 'owner' },
    ]);

    // await leftPanel.workspaceList();

    await wsPage.workspaceRename({ title: ws2Title, newTitle: ws2Title + '2' });
    await leftPanel.verifyDynamicElements([
      { title: ws2Title, role: 'owner' },
      { title: ws2Title + '2', role: 'owner' },
    ]);

    await wsPage.workspaceDelete({ title: ws2Title + '2' });
    await leftPanel.verifyDynamicElements([{ title: context.workspace.title, role: 'owner' }]);
  });

  test.skip('Cmd K : Quick action menu', async () => {
    const header = await wsPage.Header;
    await header.navigateUsingCmdK({
      keySequence: ['Enter', 'ArrowDown', 'ArrowDown', 'Enter'],
      url: 'http://localhost:3000/#/account/apps',
    });

    await header.navigateUsingCmdK({
      keySequence: ['ArrowDown', 'Enter'],
      url: 'http://localhost:3000/#/account/tokens',
    });

    await header.navigateUsingCmdK({
      searchInput: 'License',
      url: 'http://localhost:3000/#/account/license',
    });
  });

  test.skip('Project CRUD + Move', async ({ page }) => {
    const container = await wsPage.Container;

    // create a db project
    // go back to dashboard; verify project creation
    await wsPage.projectCreate({ title: 'db-created-using-ui', type: 'db' });
    await dashboardPage.clickHome();

    expect(await container.getProjectRowData({ index: 1, skipWs: false })).toEqual({
      icon: 'database',
      title: 'db-created-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // create a docs project
    // go back to dashboard; verify project creation
    await wsPage.projectCreate({ title: 'docs-created-using-ui', type: 'docs' });
    await dashboardPage.clickHome();

    expect(await container.getProjectRowData({ index: 2, skipWs: false })).toEqual({
      icon: 'menu_book',
      title: 'docs-created-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // rename db project
    await wsPage.projectRename({ title: 'db-created-using-ui', newTitle: 'db-renamed-using-ui' });

    // move db project to another workspace
    // create another workspace to verify project move
    await wsPage.workspaceCreate({ title: 'test' });
    // go back to ws_pgExtREST0 workspace
    await wsPage.workspaceOpen({ title: context.workspace.title });
    // trigger move
    await wsPage.projectMove({ title: 'db-renamed-using-ui', newWorkspace: 'test' });

    // post move, project list in 'test' workspace
    expect(await container.getProjectRowData({ index: 0, skipWs: false })).toEqual({
      icon: 'database',
      title: 'db-renamed-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });
    // await (await leftPanel.workspaceGetLocator('test')).click();
    expect(await container.getProjectRowCount()).toEqual(1);

    // delete project
    await wsPage.projectDelete({ title: 'db-renamed-using-ui' });
    expect(await container.getProjectRowCount()).toEqual(0);

    // in ws_pgExtREST0 workspace, project count is still 2
    await wsPage.workspaceOpen({ title: context.workspace.title });
    // add delay to wait for project list to load
    await page.waitForTimeout(1000);
    expect(await container.getProjectRowCount()).toEqual(2);
  });

  test.skip('WS Quick access: Recent, Shared, Favourites', async () => {
    const dbInfo = {
      icon: 'database',
      title: context.project.title,
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    };

    await wsPage.openQuickAccess('Recent');
    expect(await wsPage.Container.getProjectRowData({ index: 0, skipWs: true })).toEqual(dbInfo);
    expect(await wsPage.Container.getProjectRowCount()).toEqual(1);

    await wsPage.openQuickAccess('Shared with me');
    expect(await wsPage.Container.getProjectRowCount()).toEqual(0);

    await wsPage.openQuickAccess('Favourites');
    expect(await wsPage.Container.getProjectRowCount()).toEqual(0);

    await wsPage.workspaceOpen({ title: context.workspace.title });
    // mark current project as favourite
    await wsPage.projectAddToFavourites({ title: context.project.title });

    await wsPage.openQuickAccess('Favourites');
    expect(await wsPage.Container.getProjectRowData({ index: 0, skipWs: true })).toEqual(dbInfo);
    expect(await wsPage.Container.getProjectRowCount()).toEqual(1);
  });

  test('Accounts menu', async () => {
    const header = await wsPage.Header;
    await header.accountMenuOpen({ title: 'user-settings' });
    expect(dashboardPage.rootPage.url()).toBe('http://localhost:3000/#/account/users');

    await wsPage.rootPage.goto('http://localhost:3000/#/');
    await header.accountMenuOpen({ title: 'sign-out' });
    expect(dashboardPage.rootPage.url()).toBe('http://localhost:3000/#/signin');
  });
});
