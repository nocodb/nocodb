import { test } from '@playwright/test';
import setup from '../../setup';
import { WorkspacePage } from '../../pages/WorkspacePage';

test.describe('DashboardBasicTests', () => {
  let workspacePage: WorkspacePage;
  test.beforeEach(async ({ page }) => {
    await setup({ page, isEmptyProject: true, url: '/#/' });
    workspacePage = new WorkspacePage(page);
  });

  test('default workspace and home page links', async () => {
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
});
