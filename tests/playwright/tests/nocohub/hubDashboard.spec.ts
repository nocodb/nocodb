import { test } from '@playwright/test';
import setup from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';

test.describe('DashboardBasicTests', () => {
  let workspacePage: WorkspacePage;
  test.beforeEach(async ({ page }) => {
    await setup({ page, isEmptyProject: true, url: '/#/' });
    workspacePage = new WorkspacePage(page);
  });

  test('Page load & static configurations verification', async () => {
    // verify static elements : fixed menu items, buttons, etc.
    await workspacePage.verifyStaticElements();

    // verify run-time elements : dynamic menu items
    await workspacePage.LeftSideBar.verifyDynamicElements([{ title: 'ws_pgExtREST0', role: 'owner' }]);

    // first row
    await workspacePage.Container.verifyDynamicElements({
      title: 'pgExtREST0',
      lastAccessed: 'a few seconds ago',
      role: 'Workspace Owner',
    });

    // TODO: Once implemented, verify page navigation & page specific elements
    //
    await workspacePage.Header.openMenu({ title: 'Workspaces' });
    await workspacePage.Header.openMenu({ title: 'Explore' });
    await workspacePage.Header.openMenu({ title: 'Help' });
    await workspacePage.Header.openMenu({ title: 'Community' });
  });

  test('Workspace Basic CRUD', async () => {
    const leftPanel = await workspacePage.LeftSideBar;
    await leftPanel.workspaceCreate({
      title: 'ws_pgExtREST1',
      description: 'some project description',
    });
    await leftPanel.verifyDynamicElements([
      { title: 'ws_pgExtREST0', role: 'owner' },
      { title: 'ws_pgExtREST1', role: 'owner' },
    ]);

    await leftPanel.workspaceList();

    await leftPanel.workspaceRename({ title: 'ws_pgExtREST1', newTitle: 'ws_pgExtREST2' });
    await leftPanel.verifyDynamicElements([
      { title: 'ws_pgExtREST0', role: 'owner' },
      { title: 'ws_pgExtREST2', role: 'owner' },
    ]);

    await leftPanel.workspaceDelete({ title: 'ws_pgExtREST2' });
    await leftPanel.verifyDynamicElements([{ title: 'ws_pgExtREST0', role: 'owner' }]);
  });

  test('Cmd K : Quick action menu', async () => {
    const header = await workspacePage.Header;
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
});
