import { expect, test } from '@playwright/test';
import setup, { unsetup } from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';
import { DashboardPage } from '../../pages/Dashboard';

test.describe('DashboardBasicTests', () => {
  let wsPage: WorkspacePage;
  let dashboard: DashboardPage;
  let context: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    wsPage = new WorkspacePage(page);
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('Page load & static configurations verification', async () => {
    await wsPage.waitFor({ state: 'visible' });
    await wsPage.workspaceOpen({ title: context.workspace.title });

    // verify static elements : fixed menu items, buttons, etc.
    await wsPage.verifyStaticElements();

    // verify run-time elements : dynamic menu items
    await wsPage.leftSideBar.verifyDynamicElements([{ title: context.workspace.title, role: 'owner' }]);

    // first row
    await wsPage.container.verifyDynamicElements({
      title: context.base.title,
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
    const ws2Title = context.workspace.title;

    await dashboard.leftSidebar.createWorkspace({ title: ws2Title });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.leftSidebar.verifyWorkspaceName({
      title: ws2Title,
    });

    await dashboard.workspaceSettings.open();
    await dashboard.workspaceSettings.renameWorkspace({ newTitle: ws2Title + '2' });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.leftSidebar.verifyWorkspaceName({
      title: ws2Title + 2,
    });

    await dashboard.leftSidebar.verifyWorkspaceCount({
      count: 3,
    });

    // tbd
    // await dashboard.leftSidebar.clickTeamAndSettings();
    // await wsPage.container.settings.click();
    // await wsPage.container.deleteWorkspace({ title: ws2Title + '2' });
  });

  test.skip('Cmd K : Quick action menu', async () => {
    const header = await wsPage.header;
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

  test.skip('Base CRUD + Move', async ({ page }) => {
    const container = await wsPage.container;

    // create a db base
    // go back to dashboard; verify base creation
    await wsPage.baseCreate({ title: 'db-created-using-ui', type: 'db' });
    await dashboard.clickHome();

    expect(await container.getProjectRowData({ index: 1, skipWs: false })).toEqual({
      icon: 'database',
      title: 'db-created-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // create a docs base
    // go back to dashboard; verify base creation
    await wsPage.baseCreate({ title: 'docs-created-using-ui', type: 'docs' });
    await dashboard.clickHome();

    expect(await container.getProjectRowData({ index: 2, skipWs: false })).toEqual({
      icon: 'menu_book',
      title: 'docs-created-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // rename db base
    await wsPage.baseRename({ title: 'db-created-using-ui', newTitle: 'db-renamed-using-ui' });

    // move db base to another workspace
    // create another workspace to verify base move
    await wsPage.workspaceCreate({ title: 'test' });
    // go back to ws_pgExtREST0 workspace
    await wsPage.workspaceOpen({ title: context.workspace.title });
    // trigger move
    await wsPage.baseMove({ title: 'db-renamed-using-ui', newWorkspace: 'test' });

    // post move, base list in 'test' workspace
    expect(await container.getProjectRowData({ index: 0, skipWs: false })).toEqual({
      icon: 'database',
      title: 'db-renamed-using-ui',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });
    // await (await leftPanel.workspaceGetLocator('test')).click();
    expect(await container.getProjectRowCount()).toEqual(1);

    // delete base
    await wsPage.baseDelete({ title: 'db-renamed-using-ui' });
    expect(await container.getProjectRowCount()).toEqual(0);

    // in ws_pgExtREST0 workspace, base count is still 2
    await wsPage.workspaceOpen({ title: context.workspace.title });
    // add delay to wait for base list to load
    await page.waitForTimeout(1000);
    expect(await container.getProjectRowCount()).toEqual(2);
  });

  test.skip('WS Quick access: Recent, Shared, Favourites', async () => {
    const dbInfo = {
      icon: 'database',
      title: context.base.title,
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    };

    await wsPage.openQuickAccess('Recent');
    expect(await wsPage.container.getProjectRowData({ index: 0, skipWs: true })).toEqual(dbInfo);
    expect(await wsPage.container.getProjectRowCount()).toEqual(1);

    await wsPage.openQuickAccess('Shared with me');
    expect(await wsPage.container.getProjectRowCount()).toEqual(0);

    await wsPage.openQuickAccess('Favourites');
    expect(await wsPage.container.getProjectRowCount()).toEqual(0);

    await wsPage.workspaceOpen({ title: context.workspace.title });
    // mark current base as favourite
    await wsPage.baseAddToFavourites({ title: context.base.title });

    await wsPage.openQuickAccess('Favourites');
    expect(await wsPage.container.getProjectRowData({ index: 0, skipWs: true })).toEqual(dbInfo);
    expect(await wsPage.container.getProjectRowCount()).toEqual(1);
  });

  test.skip('Accounts menu', async () => {
    const header = await wsPage.header;
    await header.accountMenuOpen({ title: 'user-settings' });
    expect(dashboard.rootPage.url()).toBe('http://localhost:3000/#/account/users');

    await wsPage.rootPage.goto('http://localhost:3000/#/');
    await header.accountMenuOpen({ title: 'sign-out' });
    expect(dashboard.rootPage.url()).toBe('http://localhost:3000/#/signin');
  });
});
